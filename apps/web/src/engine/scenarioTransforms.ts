// Shape note: Scenario positions.homes originally held price/mortgage/appreciation (+feesOneTime).
// Added fields: holdingCostMonthly + holdingCostAnnualGrowthPct (percent) for rent-vs-own comparisons.
// Back-compat: transform clears housing positions regardless of legacy home/home[] shapes.
import type { Scenario } from "../store/scenarioStore";
import type { EventDefinition } from "../domain/events/types";
import type { TimelineEvent } from "../features/timeline/schema";
import { buildScenarioTimelineEvents } from "../domain/events/utils";

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
    memberId: scenario.members?.[0]?.id,
  };
};

export const buildRentComparisonEvents = (
  scenario: Scenario,
  eventLibrary: EventDefinition[]
): TimelineEvent[] => {
  const events = buildScenarioTimelineEvents(scenario, eventLibrary).filter(
    (event) => event.type !== "buy_home"
  );

  if (!events.some((event) => event.type === "rent")) {
    const fallbackEvent = buildFallbackRentEvent(scenario);
    if (fallbackEvent) {
      events.push(fallbackEvent);
    }
  }

  return events;
};

export const buildRentComparisonScenario = (baseScenario: Scenario): Scenario => {
  const scenario = cloneScenario(baseScenario);

  if (scenario.positions) {
    delete scenario.positions.home;
    scenario.positions.homes = (scenario.positions.homes ?? []).filter(
      (home) => (home.usage ?? "primary") === "investment"
    );
  }

  return scenario;
};
