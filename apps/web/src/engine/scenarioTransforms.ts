// Shape note: Scenario positions.homes originally held price/mortgage/appreciation (+feesOneTime).
// Added fields: holdingCostMonthly + holdingCostAnnualGrowthPct (percent) for rent-vs-own comparisons.
// Back-compat: transform clears housing positions regardless of legacy home/home[] shapes.
import type { Scenario, TimelineEvent } from "../store/scenarioStore";
import {
  buildTemplateParams,
  getInsuranceTemplate,
} from "../insurance/templates";

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const cloneScenario = (scenario: Scenario): Scenario => {
  if (typeof structuredClone === "function") {
    return structuredClone(scenario);
  }

  return JSON.parse(JSON.stringify(scenario)) as Scenario;
};

const buildFallbackRentEvent = (scenario: Scenario): TimelineEvent | null => {
  const rentMonthly = scenario.assumptions.rentMonthly ?? 0;
  if (rentMonthly <= 0) {
    return null;
  }

  return {
    id: "rent-fallback",
    type: "rent",
    name: "Rent",
    startMonth: scenario.assumptions.baseMonth ?? getCurrentMonth(),
    endMonth: null,
    enabled: true,
    monthlyAmount: rentMonthly,
    oneTimeAmount: 0,
    annualGrowthPct: scenario.assumptions.rentAnnualGrowthPct ?? 0,
    currency: scenario.baseCurrency,
  };
};

const deriveInsuranceEvents = (event: TimelineEvent): TimelineEvent[] => {
  if (event.type !== "insurance_product" || !event.enabled) {
    return [];
  }

  const template = getInsuranceTemplate(event.templateId);
  const templateParams = buildTemplateParams(template, event.templateParams);
  const derivedEvents = template.buildEvents(event, templateParams);

  return derivedEvents.map((derivedEvent, index) => ({
    ...derivedEvent,
    id: `${event.id}-derived-${index}`,
    derived: true,
    sourceId: event.id,
    templateId: undefined,
    templateParams: undefined,
  }));
};

export const expandDerivedEvents = (baseScenario: Scenario): Scenario => {
  const scenario = cloneScenario(baseScenario);
  const events = scenario.events ?? [];
  const baseEvents = events.filter((event) => !event.derived);
  const derivedEvents = baseEvents.flatMap(deriveInsuranceEvents);

  scenario.events = [...baseEvents, ...derivedEvents];

  return scenario;
};

export const toRentComparisonScenario = (baseScenario: Scenario): Scenario => {
  const scenario = cloneScenario(baseScenario);

  if (scenario.positions) {
    delete scenario.positions.home;
    scenario.positions.homes = (scenario.positions.homes ?? []).filter(
      (home) => (home.usage ?? "primary") === "investment"
    );
  }

  const events = (scenario.events ?? []).filter(
    (event) => event.type !== "buy_home"
  );

  if (!events.some((event) => event.type === "rent")) {
    const fallbackEvent = buildFallbackRentEvent(scenario);
    if (fallbackEvent) {
      events.push(fallbackEvent);
    }
  }

  scenario.events = events;

  return scenario;
};
