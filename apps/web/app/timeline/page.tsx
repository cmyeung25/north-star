"use client";

import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import TimelineDesktop from "../../components/timeline/TimelineDesktop";
import TimelineMobile from "../../components/timeline/TimelineMobile";
import { normalizeEvent } from "../../src/features/timeline/schema";
import {
  getScenarioById,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import {
  getScenarioIdFromSearchParams,
  resolveScenarioId,
} from "../../src/utils/scenarioContext";

export default function TimelinePage() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const searchParams = useSearchParams();
  const scenarioIdFromQuery = getScenarioIdFromSearchParams(searchParams);
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const upsertScenarioEvents = useScenarioStore(
    (state) => state.upsertScenarioEvents
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
    () => resolveScenarioId(searchParams, activeScenarioId, scenarios),
    [activeScenarioId, scenarios, searchParams]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const events = scenario?.events ?? [];
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
        baseCurrency={baseCurrency}
        baseMonth={baseMonth}
        onEventsChange={handleEventsChange}
      />
    );
  }

  return (
    <TimelineMobile
      events={events}
      baseCurrency={baseCurrency}
      baseMonth={baseMonth}
      onEventsChange={handleEventsChange}
    />
  );
}
