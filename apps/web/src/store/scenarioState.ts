import {
  normalizeScenarioList,
  useScenarioStore,
  type Scenario,
} from "./scenarioStore";
import type { EventDefinition } from "../domain/events/types";
import { SCHEMA_VERSION } from "./scenarioSchema";
import type { AppSettings, BudgetRule, ScenarioMember } from "./scenarioStore";
import { ensureEventsV2Marker } from "../../lib/scenario/ensureEventsV2Marker";

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
  stateVersion?: number;
  schemaVersion: number;
  meta?: {
    caseId?: string;
    scenarioId?: string;
    lastOpenedAt?: string;
    lastSavedAt?: string;
    schemaVersion?: number;
    onboarded?: boolean;
    onboardedAt?: string;
  };
  revision?: number;
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
    stateVersion: 1,
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
  const normalizedPayload = ensureEventsV2Marker(payload as unknown as Record<string, unknown>) as ScenarioStatePayload;
  const normalizedScenarios = normalizeScenarioList(normalizedPayload.scenarios);
  const normalizedActiveScenarioId = normalizeActiveScenarioId(
    normalizedScenarios,
    normalizedPayload.activeScenarioId
  );
  const globalHorizonMonths =
    typeof normalizedPayload.appSettings?.globalHorizonMonths === "number"
      ? normalizedPayload.appSettings.globalHorizonMonths
      : typeof normalizedPayload.globalHorizonMonths === "number"
      ? normalizedPayload.globalHorizonMonths
      : useScenarioStore.getState().appSettings.globalHorizonMonths;
  const nextAppSettings =
    normalizedPayload.appSettings ??
    ({
      ...useScenarioStore.getState().appSettings,
      globalHorizonMonths,
    } as AppSettings);

  useScenarioStore.setState({
    scenarios: normalizedScenarios,
    eventLibrary: normalizedPayload.eventLibrary,
    activeScenarioId: normalizedActiveScenarioId,
    appSettings: nextAppSettings,
    members: normalizedPayload.members ?? useScenarioStore.getState().members,
    budgetRules: normalizedPayload.budgetRules ?? useScenarioStore.getState().budgetRules,
  });

  return {
    scenarios: normalizedScenarios,
    eventLibrary: normalizedPayload.eventLibrary,
    activeScenarioId: normalizedActiveScenarioId,
    appSettings: nextAppSettings,
    members: normalizedPayload.members ?? useScenarioStore.getState().members,
    budgetRules: normalizedPayload.budgetRules ?? useScenarioStore.getState().budgetRules,
    globalHorizonMonths,
  } satisfies ScenarioStoreSnapshot;
};
