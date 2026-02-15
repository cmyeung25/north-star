import type { ScenarioStorePersistedState } from "../store/scenarioStore";
import {
  getActiveScenario,
  hydrateFromPersistedState,
  selectPersistedState,
  useScenarioStore,
} from "../store/scenarioStore";

export type ScenarioCloudPayload = ScenarioStorePersistedState;

export const exportScenarioPayload = (scenarioId: string): ScenarioCloudPayload => {
  const state = useScenarioStore.getState();
  const persisted = selectPersistedState(state);
  const scenario = persisted.scenarios.find((entry) => entry.id === scenarioId);

  if (!scenario) {
    throw new Error("Scenario not found");
  }

  return {
    ...persisted,
    scenarios: [scenario],
    activeScenarioId: scenario.id,
  };
};

export const importScenarioPayload = (payload: ScenarioCloudPayload) => {
  const hydrated = hydrateFromPersistedState(payload);
  const activeScenario = getActiveScenario(hydrated.scenarios, hydrated.activeScenarioId);
  return {
    scenarioId: activeScenario?.id ?? hydrated.activeScenarioId,
  };
};
