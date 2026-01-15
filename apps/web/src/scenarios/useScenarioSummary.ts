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

  const scenario = useMemo(
    () => (scenarioId ? getScenarioById(scenarios, scenarioId) : null),
    [scenarioId, scenarios]
  );

  const summary = useMemo(() => {
    if (!scenario) {
      return null;
    }

    const input = mapScenarioToEngineInput(scenario, { strict: false });
    const projection = computeProjection(input);
    const overviewViewModel = projectionToOverviewViewModel(projection);

    return { kpis: overviewViewModel.kpis };
  }, [scenario]);

  return { scenario, summary };
};
