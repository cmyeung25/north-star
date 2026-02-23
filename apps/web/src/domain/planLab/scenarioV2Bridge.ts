import type { Scenario } from "../../store/scenarioStore";
import type { ScenarioV2 } from "../../engine/scenarioV2Compiler";
import type { EventDefinition } from "../events/types";
import type { ScenarioEvent } from "../scenarioV2/events";
import { buildScenarioTimelineEvents } from "../events/utils";
import { mapTimelineEventToScenarioCashflow } from "../events/eventMappingRegistry";
import type { TimelineEvent } from "../../features/timeline/schema";

const buildCashflowEvent = (event: TimelineEvent): ScenarioEvent => {
  const { mappingMetadata, ...mappedEvent } = mapTimelineEventToScenarioCashflow(event);

  return {
    ...mappedEvent,
    meta: {
      ...(mappedEvent.meta ?? {}),
      legacyType: mappingMetadata.legacyType,
    },
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
