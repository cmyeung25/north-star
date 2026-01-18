import {
  normalizeScenarioList,
  useScenarioStore,
  type Scenario,
} from "./scenarioStore";
import type { EventDefinition } from "../domain/events/types";
import { SCHEMA_VERSION } from "./scenarioSchema";
import type { AppSettings, BudgetRule, ScenarioMember } from "./scenarioStore";

export type ScenarioStoreSnapshot = {
  scenarios: Scenario[];
  eventLibrary: EventDefinition[];
  activeScenarioId: string;
  appSettings?: AppSettings;
  members?: ScenarioMember[];
  budgetRules?: BudgetRule[];
  globalHorizonMonths?: number;
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
    eventLibrary: snapshot.eventLibrary,
    activeScenarioId: snapshot.activeScenarioId,
    appSettings: snapshot.appSettings,
    members: snapshot.members,
    budgetRules: snapshot.budgetRules,
    globalHorizonMonths: snapshot.appSettings.globalHorizonMonths,
  };
};

export const importScenarioState = (payload: ScenarioStatePayload) => {
  const normalizedScenarios = normalizeScenarioList(payload.scenarios);
  const normalizedActiveScenarioId = normalizeActiveScenarioId(
    normalizedScenarios,
    payload.activeScenarioId
  );
  const globalHorizonMonths =
    typeof payload.appSettings?.globalHorizonMonths === "number"
      ? payload.appSettings.globalHorizonMonths
      : typeof payload.globalHorizonMonths === "number"
      ? payload.globalHorizonMonths
      : useScenarioStore.getState().appSettings.globalHorizonMonths;
  const nextAppSettings =
    payload.appSettings ??
    ({
      ...useScenarioStore.getState().appSettings,
      globalHorizonMonths,
    } as AppSettings);

  useScenarioStore.setState({
    scenarios: normalizedScenarios,
    eventLibrary: payload.eventLibrary,
    activeScenarioId: normalizedActiveScenarioId,
    appSettings: nextAppSettings,
    members: payload.members ?? useScenarioStore.getState().members,
    budgetRules: payload.budgetRules ?? useScenarioStore.getState().budgetRules,
  });

  return {
    scenarios: normalizedScenarios,
    eventLibrary: payload.eventLibrary,
    activeScenarioId: normalizedActiveScenarioId,
    appSettings: nextAppSettings,
    members: payload.members ?? useScenarioStore.getState().members,
    budgetRules: payload.budgetRules ?? useScenarioStore.getState().budgetRules,
    globalHorizonMonths,
  } satisfies ScenarioStoreSnapshot;
};
