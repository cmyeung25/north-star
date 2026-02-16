"use client";

import { useEffect } from "react";
import { useScenarioStore } from "../src/store/scenarioStore";

type ScenarioRouteSyncProps = {
  scenarioId: string;
};

export default function ScenarioRouteSync({ scenarioId }: ScenarioRouteSyncProps) {
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);

  useEffect(() => {
    if (!scenarioId || activeScenarioId === scenarioId) {
      return;
    }

    setActiveScenario(scenarioId);
  }, [activeScenarioId, scenarioId, setActiveScenario]);

  return null;
}
