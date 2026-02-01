import type { Scenario } from "../../store/scenarioStore";
import type { ScenarioV2 } from "../../engine/scenarioV2Compiler";
import type { EventDefinition } from "../events/types";
import type { ScenarioEvent } from "../scenarioV2/events";
import { buildScenarioTimelineEvents } from "../events/utils";
import type { TimelineEvent } from "../../features/timeline/schema";

const incomeEventTypes = new Set([
  "salary",
  "bonus",
  "freelance",
  "rental",
  "dividend",
  "interest",
  "tax_benefit",
]);

const buildCashflowEvent = (event: TimelineEvent): ScenarioEvent => {
  const amount = event.oneTimeAmount > 0 ? event.oneTimeAmount : event.monthlyAmount;
  const cadence = event.oneTimeAmount > 0 ? "oneOff" : "monthly";
  return {
    id: event.id,
    type: "cashflow",
    kind: incomeEventTypes.has(event.type) ? "income" : "expense",
    cadence,
    amount: Math.abs(amount),
    startMonth: event.startMonth,
    endMonth: event.endMonth ?? undefined,
    occurrenceMonth: cadence === "oneOff" ? event.startMonth : undefined,
    label: event.name,
    memberId: event.memberId,
    tags: [event.type],
  };
};

const timelineEventsToScenarioEvents = (events: TimelineEvent[]): ScenarioEvent[] =>
  events.map(buildCashflowEvent);

export const buildScenarioV2FromScenario = (
  scenario: Scenario,
  eventLibrary: EventDefinition[]
): ScenarioV2 => {
  if (scenario.meta?.schemaVersion === 2 && scenario.events) {
    return {
      id: scenario.id,
      name: scenario.name,
      baseCurrency: scenario.baseCurrency,
      updatedAt: scenario.updatedAt,
      assumptions: scenario.assumptions,
      members: scenario.members,
      assets: scenario.assets,
      liabilities: scenario.liabilities,
      events: scenario.events,
      meta: scenario.meta,
    };
  }

  const timelineEvents = buildScenarioTimelineEvents(scenario, eventLibrary, {
    includeDerived: false,
  });

  return {
    id: scenario.id,
    name: scenario.name,
    baseCurrency: scenario.baseCurrency,
    updatedAt: scenario.updatedAt,
    assumptions: scenario.assumptions,
    members: scenario.members,
    assets: scenario.assets,
    liabilities: scenario.liabilities,
    events: timelineEventsToScenarioEvents(timelineEvents),
    meta: scenario.meta,
  };
};
