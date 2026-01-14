"use client";

import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo } from "react";
import TimelineDesktop from "../../components/timeline/TimelineDesktop";
import TimelineMobile from "../../components/timeline/TimelineMobile";
import { normalizeEvent } from "../../src/features/timeline/schema";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../src/store/scenarioStore";

type TimelineClientProps = {
  scenarioId?: string;
};

export default function TimelineClient({ scenarioId }: TimelineClientProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const scenarioIdFromQuery = scenarioId ?? null;
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const upsertScenarioEvents = useScenarioStore(
    (state) => state.upsertScenarioEvents
  );
  const upsertHomePosition = useScenarioStore(
    (state) => state.upsertHomePosition
  );
  const clearHomePosition = useScenarioStore(
    (state) => state.clearHomePosition
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
  const events = scenario?.events ?? [];
  const homePosition = scenario?.positions?.home;
  const baseCurrency = scenario?.baseCurrency ?? "";
  const baseMonth = scenario?.assumptions.baseMonth ?? null;

  const handleEventsChange = (updatedEvents: typeof events) => {
    if (!scenario) {
      return;
    }
    const normalizedEvents = updatedEvents.map((event) =>
      normalizeEvent(event, {
        baseCurrency: scenario.baseCurrency,
        fallbackMonth: scenario.assumptions.baseMonth,
      })
    );
    upsertScenarioEvents(scenario.id, normalizedEvents);
  };

  if (!scenario) {
    return null;
  }

  if (isDesktop) {
    return (
      <TimelineDesktop
        events={events}
        homePosition={homePosition ?? null}
        baseCurrency={baseCurrency}
        baseMonth={baseMonth}
        scenarioId={scenario.id}
        onEventsChange={handleEventsChange}
        onHomePositionChange={(home) => upsertHomePosition(scenario.id, home)}
        onHomePositionClear={() => clearHomePosition(scenario.id)}
      />
    );
  }

  return (
    <TimelineMobile
      events={events}
      homePosition={homePosition ?? null}
      baseCurrency={baseCurrency}
      baseMonth={baseMonth}
      scenarioId={scenario.id}
      onEventsChange={handleEventsChange}
      onHomePositionChange={(home) => upsertHomePosition(scenario.id, home)}
      onHomePositionClear={() => clearHomePosition(scenario.id)}
    />
  );
}
