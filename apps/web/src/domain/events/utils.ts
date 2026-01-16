import type { Scenario } from "../../store/scenarioStore";
import { normalizeEvent } from "../../features/timeline/schema";
import { buildDerivedEvents } from "../../insurance/templates";
import type { TimelineEvent } from "../../features/timeline/schema";
import type {
  EventDefinition,
  EventRule,
  ScenarioEventRef,
  ScenarioEventView,
} from "./types";

export const buildEventLibraryMap = (eventLibrary: EventDefinition[]) =>
  new Map(eventLibrary.map((definition) => [definition.id, definition]));

export const resolveEventRule = (
  definition: EventDefinition,
  ref: ScenarioEventRef
): EventRule => {
  const mergedRule = {
    ...definition.rule,
    ...ref.overrides,
  };
  return {
    ...mergedRule,
    mode: mergedRule.mode ?? "params",
  };
};

export const buildTimelineEventFromDefinition = (
  definition: EventDefinition,
  ref: ScenarioEventRef,
  options: { baseCurrency: string; fallbackMonth?: string | null }
): TimelineEvent => {
  const rule = resolveEventRule(definition, ref);

  return normalizeEvent(
    {
      id: definition.id,
      type: definition.type,
      name: definition.title,
      startMonth: rule.startMonth ?? "",
      endMonth: rule.endMonth ?? null,
      enabled: ref.enabled,
      monthlyAmount: Number(rule.monthlyAmount ?? 0),
      oneTimeAmount: Number(rule.oneTimeAmount ?? 0),
      annualGrowthPct: Number(rule.annualGrowthPct ?? 0),
      currency: definition.currency ?? options.baseCurrency,
      memberId: definition.memberId,
      templateId: definition.templateId,
      templateParams: definition.templateParams,
    },
    {
      baseCurrency: options.baseCurrency,
      fallbackMonth: options.fallbackMonth ?? rule.startMonth ?? null,
    }
  );
};

export const buildScenarioEventViews = (
  scenario: Scenario,
  eventLibrary: EventDefinition[]
): ScenarioEventView[] => {
  const libraryMap = buildEventLibraryMap(eventLibrary);

  return (scenario.eventRefs ?? []).flatMap((ref) => {
    const definition = libraryMap.get(ref.refId);
    if (!definition) {
      return [];
    }

    return [
      {
        definition,
        ref,
        rule: resolveEventRule(definition, ref),
      },
    ];
  });
};

export const buildScenarioTimelineEvents = (
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  options: { includeDerived?: boolean } = {}
): TimelineEvent[] => {
  const includeDerived = options.includeDerived ?? true;
  const baseCurrency = scenario.baseCurrency;
  const fallbackMonth = scenario.assumptions.baseMonth ?? null;

  const baseEvents = buildScenarioEventViews(scenario, eventLibrary)
    .filter((view) => view.definition.kind === "cashflow")
    .map((view) =>
      buildTimelineEventFromDefinition(view.definition, view.ref, {
        baseCurrency,
        fallbackMonth,
      })
    );

  if (!includeDerived) {
    return baseEvents;
  }

  const derivedEvents = baseEvents.flatMap((event) =>
    event.type === "insurance_product"
      ? buildDerivedEvents(event, scenario.assumptions)
      : []
  );

  return [...baseEvents, ...derivedEvents];
};

export const buildDefinitionFromTimelineEvent = (
  event: TimelineEvent
): EventDefinition => ({
  id: event.id,
  title: event.name,
  type: event.type,
  kind: "cashflow",
  rule: {
    mode: "params",
    startMonth: event.startMonth,
    endMonth: event.endMonth ?? null,
    monthlyAmount: Math.abs(event.monthlyAmount ?? 0),
    oneTimeAmount: Math.abs(event.oneTimeAmount ?? 0),
    annualGrowthPct: event.annualGrowthPct ?? 0,
  },
  currency: event.currency,
  memberId: event.memberId,
  templateId: event.templateId,
  templateParams: event.templateParams,
});
