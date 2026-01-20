import { useMemo } from "react";
import type { ScenarioKpis } from "../store/scenarioStore";
import {
  getScenarioById,
  useScenarioStore,
} from "../store/scenarioStore";
import { projectionToOverviewViewModel } from "../engine/adapter";
import { computeProjectionWithSmartInvest } from "../engine/useProjectionWithLedger";

export type ScenarioSummary = {
  kpis: ScenarioKpis;
};

export const useScenarioSummary = (scenarioId?: string | null) => {
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);

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

    const { projection } = computeProjectionWithSmartInvest(
      scenario,
      eventLibrary,
      {
        members,
        budgetRules,
        maxPasses: 3,
      }
    );
    const overviewViewModel = projectionToOverviewViewModel(projection);

    return { kpis: overviewViewModel.kpis };
  }, [budgetRules, eventLibrary, members, scenario, scenarioKey]);

  return { scenario, summary };
};
