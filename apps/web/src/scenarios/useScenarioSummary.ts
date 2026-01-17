import { useMemo } from "react";
import { computeProjection } from "@north-star/engine";
import type { ScenarioKpis } from "../store/scenarioStore";
import {
  getScenarioById,
  useScenarioStore,
} from "../store/scenarioStore";
import {
  mapScenarioToEngineInput,
  projectionToOverviewViewModel,
} from "../engine/adapter";

export type ScenarioSummary = {
  kpis: ScenarioKpis;
};

export const useScenarioSummary = (scenarioId?: string | null) => {
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);

  const scenario = useMemo(
    () => (scenarioId ? getScenarioById(scenarios, scenarioId) : null),
    [scenarioId, scenarios]
  );
  const scenarioKey = useMemo(
    () => (scenario ? `${scenario.id}:${scenario.updatedAt}` : null),
    [scenario]
  );

  const summary = useMemo(() => {
    if (!scenario || !scenarioKey) {
      return null;
    }

    const { input } = mapScenarioToEngineInput(scenario, eventLibrary, { strict: false });
    const projection = computeProjection(input);
    const overviewViewModel = projectionToOverviewViewModel(projection);

    return { kpis: overviewViewModel.kpis };
  }, [eventLibrary, scenario, scenarioKey]);

  return { scenario, summary };
};
