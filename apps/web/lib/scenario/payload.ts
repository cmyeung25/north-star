export type ScenarioStateMeta = {
  caseId?: string;
  scenarioId?: string;
  lastOpenedAt?: string;
  lastSavedAt?: string;
};

export type ScenarioStatePayload = {
  stateVersion: number;
  schemaVersion: number;
  scenarios: unknown[];
  eventLibrary: unknown[];
  activeScenarioId: string;
  members?: unknown[];
  budgetRules?: unknown[];
  appSettings?: Record<string, unknown>;
  globalHorizonMonths?: number;
  meta?: ScenarioStateMeta;
  revision?: number;
};

export const createEmptyScenarioStatePayload = (
  input?: Pick<ScenarioStateMeta, "caseId" | "scenarioId">
): ScenarioStatePayload => ({
  stateVersion: 1,
  schemaVersion: 1,
  scenarios: [],
  eventLibrary: [],
  activeScenarioId: "",
  meta: {
    caseId: input?.caseId,
    scenarioId: input?.scenarioId,
  },
  revision: 0,
});
