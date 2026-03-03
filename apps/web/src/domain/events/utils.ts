import type { Scenario, ScenarioAssumptions, ScenarioMember } from "../../store/scenarioStore";
import { normalizeEvent } from "../../features/timeline/schema";
import { buildDerivedEvents } from "../../insurance/templates";
import type { TimelineEvent } from "../../features/timeline/schema";
import { DEFAULT_GROWTH_MODE } from "../growthMode";
import { buildMonthDateRef, resolveDateRef } from "../dateRef";
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
  ref: ScenarioEventRef,
  options: { members?: ScenarioMember[] } = {}
): EventRule => {
  const mergedRule = {
    ...definition.rule,
    ...ref.overrides,
  };
  const membersById = options.members
    ? Object.fromEntries(options.members.map((member) => [member.id, member]))
    : undefined;
  const resolvedStart = mergedRule.startAt
    ? resolveDateRef(mergedRule.startAt, membersById)
    : undefined;
  const resolvedEnd = mergedRule.endAt
    ? resolveDateRef(mergedRule.endAt, membersById)
    : undefined;
  return {
    ...mergedRule,
    startMonth:
      resolvedStart ??
      (mergedRule.startAt ? undefined : mergedRule.startMonth ?? undefined),
    endMonth:
      resolvedEnd ??
      (mergedRule.endAt ? undefined : mergedRule.endMonth ?? undefined),
    mode: mergedRule.mode ?? "params",
  };
};

const resolveGlobalGrowthPct = (
  definition: EventDefinition,
  assumptions?: ScenarioAssumptions
) => {
  if (!assumptions) {
    return 0;
  }
  if (definition.type === "rent" || definition.incomeSubtype === "rental") {
    return assumptions.rentAnnualGrowthPct ?? 0;
  }
  if (definition.incomeSubtype === "interest") {
    return assumptions.cashYieldPct ?? 0;
  }
  return 0;
};

export const buildTimelineEventFromDefinition = (
  definition: EventDefinition,
  ref: ScenarioEventRef,
  options: {
    baseCurrency: string;
    fallbackMonth?: string | null;
    assumptions?: ScenarioAssumptions;
    members?: ScenarioMember[];
  }
): TimelineEvent => {
  const rule = resolveEventRule(definition, ref, { members: options.members });
  const assumptions = options.assumptions;
  const annualGrowthPct =
    rule.growthMode === "GLOBAL"
      ? resolveGlobalGrowthPct(definition, assumptions)
      : Number(rule.annualGrowthPct ?? 0);

  return normalizeEvent(
    {
      id: definition.id,
      type: definition.type,
      name: definition.title,
      startMonth: rule.startMonth ?? "",
      endMonth: rule.endMonth ?? null,
      startAt: rule.startAt ?? buildMonthDateRef(rule.startMonth ?? undefined) ?? undefined,
      endAt:
        rule.endAt ??
        buildMonthDateRef(rule.endMonth ?? undefined) ??
        (rule.endMonth === null ? null : undefined),
      enabled: ref.enabled,
      monthlyAmount: Number(rule.monthlyAmount ?? 0),
      oneTimeAmount: Number(rule.oneTimeAmount ?? 0),
      annualGrowthPct,
      growthMode: rule.growthMode,
      currency: definition.currency ?? options.baseCurrency,
      memberId: definition.memberId,
      incomeSubtype: definition.incomeSubtype,
      endAtAgeYears: definition.endAtAgeYears,
      templateId: definition.templateId,
      templateParams: definition.templateParams,
      highlighted: ref.highlighted ?? false,
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
  const scenarioEventMap = new Map((scenario.events ?? []).map((event) => [event.id, event]));

  return (scenario.eventRefs ?? []).flatMap((ref) => {
    const definition = libraryMap.get(ref.refId);
    if (!definition) {
      return [];
    }

    const scenarioEvent = scenarioEventMap.get(definition.id);
    const resolvedMemberId =
      scenarioEvent?.type === "cashflow" ? scenarioEvent.memberId : definition.memberId;
    const resolvedDefinition =
      resolvedMemberId === definition.memberId
        ? definition
        : {
            ...definition,
            memberId: resolvedMemberId,
          };

    return [
      {
        definition: resolvedDefinition,
        ref,
        rule: resolveEventRule(resolvedDefinition, ref, { members: scenario.members }),
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
        assumptions: scenario.assumptions,
        members: scenario.members,
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
    startAt: event.startAt,
    endAt: event.endAt ?? null,
    monthlyAmount: Math.abs(event.monthlyAmount ?? 0),
    oneTimeAmount: Math.abs(event.oneTimeAmount ?? 0),
    annualGrowthPct: event.annualGrowthPct ?? 0,
    growthMode: event.growthMode ?? resolveDefaultGrowthMode(event),
  },
  currency: event.currency,
  memberId: event.memberId,
  incomeSubtype: event.incomeSubtype,
  endAtAgeYears: event.endAtAgeYears,
  templateId: event.templateId,
  templateParams: event.templateParams,
});

const resolveDefaultGrowthMode = (event: TimelineEvent) =>
  event.type === "rent" ||
  event.incomeSubtype === "rental" ||
  event.incomeSubtype === "interest"
    ? DEFAULT_GROWTH_MODE
    : undefined;
