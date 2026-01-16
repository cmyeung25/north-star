"use client";

import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo } from "react";
import TimelineDesktop from "../../../components/timeline/TimelineDesktop";
import TimelineMobile from "../../../components/timeline/TimelineMobile";
import { buildScenarioEventViews } from "../../../src/domain/events/utils";
import { compileAllBudgetRules } from "../../../src/domain/budget/compileBudgetRules";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../../src/store/scenarioStore";

type TimelineClientProps = {
  scenarioId?: string;
};

export default function TimelineClient({ scenarioId }: TimelineClientProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const scenarioIdFromQuery = scenarioId ?? null;
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const addEventDefinition = useScenarioStore((state) => state.addEventDefinition);
  const addEventToScenarios = useScenarioStore((state) => state.addEventToScenarios);
  const updateEventDefinition = useScenarioStore(
    (state) => state.updateEventDefinition
  );
  const addScenarioEventRef = useScenarioStore((state) => state.addScenarioEventRef);
  const updateScenarioEventRef = useScenarioStore(
    (state) => state.updateScenarioEventRef
  );
  const removeScenarioEventRef = useScenarioStore(
    (state) => state.removeScenarioEventRef
  );
  const mergeDuplicateEvents = useScenarioStore(
    (state) => state.mergeDuplicateEvents
  );
  const addHomePosition = useScenarioStore((state) => state.addHomePosition);
  const updateHomePosition = useScenarioStore(
    (state) => state.updateHomePosition
  );
  const removeHomePosition = useScenarioStore(
    (state) => state.removeHomePosition
  );

  useEffect(() => {
    if (
      scenarioIdFromQuery &&
      scenarioIdFromQuery !== activeScenarioId &&
      scenarios.some((scenario) => scenario.id === scenarioIdFromQuery)
    ) {
      setActiveScenario(scenarioIdFromQuery);
    }
  }, [activeScenarioId, scenarioIdFromQuery, scenarios, setActiveScenario]);

  const resolvedScenarioId = useMemo(
    () => resolveScenarioIdFromQuery(scenarioIdFromQuery, activeScenarioId, scenarios),
    [activeScenarioId, scenarioIdFromQuery, scenarios]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const eventViews = scenario ? buildScenarioEventViews(scenario, eventLibrary) : [];
  const budgetLedger = scenario ? compileAllBudgetRules(scenario) : [];
  const homePositions = scenario?.positions?.homes ?? [];
  const members = scenario?.members ?? [];
  const baseCurrency = scenario?.baseCurrency ?? "";
  const baseMonth = scenario?.assumptions.baseMonth ?? null;
  const assumptions = scenario?.assumptions ?? { baseMonth: null, horizonMonths: 0 };

  if (!scenario) {
    return null;
  }

  if (isDesktop) {
    return (
      <TimelineDesktop
        eventViews={eventViews}
        eventLibrary={eventLibrary}
        scenarios={scenarios}
        homePositions={homePositions}
        members={members}
        budgetLedger={budgetLedger}
        baseCurrency={baseCurrency}
        baseMonth={baseMonth}
        assumptions={assumptions}
        scenarioId={scenario.id}
        onAddDefinition={(definition, scenarioIds) => {
          if (scenarioIds.length <= 1 && scenarioIds[0] === scenario.id) {
            addEventDefinition(definition);
            addScenarioEventRef(scenario.id, { refId: definition.id, enabled: true });
            return;
          }
          addEventToScenarios(definition, scenarioIds);
        }}
        onUpdateDefinition={updateEventDefinition}
        onUpdateEventRef={(refId, patch) =>
          updateScenarioEventRef(scenario.id, refId, patch)
        }
        onHomePositionAdd={(home) => addHomePosition(scenario.id, home)}
        onHomePositionUpdate={(home) => updateHomePosition(scenario.id, home)}
        onHomePositionRemove={(homeId) => removeHomePosition(scenario.id, homeId)}
        onMergeDuplicates={(cluster, baseDefinitionId) =>
          mergeDuplicateEvents(cluster, baseDefinitionId)
        }
      />
    );
  }

  return (
    <TimelineMobile
      eventViews={eventViews}
      eventLibrary={eventLibrary}
      scenarios={scenarios}
      homePositions={homePositions}
      members={members}
      budgetLedger={budgetLedger}
      baseCurrency={baseCurrency}
      baseMonth={baseMonth}
      assumptions={assumptions}
      scenarioId={scenario.id}
      onAddDefinition={(definition, scenarioIds) => {
        if (scenarioIds.length <= 1 && scenarioIds[0] === scenario.id) {
          addEventDefinition(definition);
          addScenarioEventRef(scenario.id, { refId: definition.id, enabled: true });
          return;
        }
        addEventToScenarios(definition, scenarioIds);
      }}
      onUpdateDefinition={updateEventDefinition}
      onUpdateEventRef={(refId, patch) =>
        updateScenarioEventRef(scenario.id, refId, patch)
      }
      onRemoveEventRef={(refId) => removeScenarioEventRef(scenario.id, refId)}
      onHomePositionAdd={(home) => addHomePosition(scenario.id, home)}
      onHomePositionUpdate={(home) => updateHomePosition(scenario.id, home)}
      onHomePositionRemove={(homeId) => removeHomePosition(scenario.id, homeId)}
      onMergeDuplicates={(cluster, baseDefinitionId) =>
        mergeDuplicateEvents(cluster, baseDefinitionId)
      }
    />
  );
}
