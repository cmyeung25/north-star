import { useScenarioStore, type Scenario } from "./scenarioStore";
import { SCHEMA_VERSION } from "./scenarioSchema";

export type ScenarioStoreSnapshot = {
  scenarios: Scenario[];
  activeScenarioId: string;
};

export type ScenarioStatePayload = ScenarioStoreSnapshot & {
  schemaVersion: number;
};

export const normalizeActiveScenarioId = (
  scenarios: Scenario[],
  activeScenarioId: string
) => {
  if (scenarios.some((scenario) => scenario.id === activeScenarioId)) {
    return activeScenarioId;
  }

  return scenarios[0]?.id ?? "";
};

export const exportScenarioState = (): ScenarioStatePayload => {
  const snapshot = useScenarioStore.getState();

  return {
    schemaVersion: SCHEMA_VERSION,
    scenarios: snapshot.scenarios,
    activeScenarioId: snapshot.activeScenarioId,
  };
};

export const importScenarioState = (payload: ScenarioStatePayload) => {
  const normalizedActiveScenarioId = normalizeActiveScenarioId(
    payload.scenarios,
    payload.activeScenarioId
  );

  useScenarioStore.setState({
    scenarios: payload.scenarios,
    activeScenarioId: normalizedActiveScenarioId,
  });

  return {
    scenarios: payload.scenarios,
    activeScenarioId: normalizedActiveScenarioId,
  } satisfies ScenarioStoreSnapshot;
};
