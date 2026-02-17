"use client";

import { useEffect } from "react";
import { importScenarioState } from "../src/store/scenarioState";
import { useScenarioStore } from "../src/store/scenarioStore";

type ScenarioRouteSyncProps = {
  scenarioId: string;
  payload?: Record<string, unknown>;
};

export default function ScenarioRouteSync({ scenarioId, payload }: ScenarioRouteSyncProps) {
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const scenarios = useScenarioStore((state) => state.scenarios);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);

  useEffect(() => {
    if (!scenarioId || !payload) {
      return;
    }

    const hasScenario = scenarios.some((entry) => entry.id === scenarioId);
    if (hasScenario) {
      return;
    }

    importScenarioState(payload as never);
  }, [payload, scenarioId, scenarios]);

  useEffect(() => {
    if (!scenarioId || activeScenarioId === scenarioId) {
      return;
    }

    setActiveScenario(scenarioId);
  }, [activeScenarioId, scenarioId, setActiveScenario]);

  return null;
}
