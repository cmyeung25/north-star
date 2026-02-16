export type ScenarioStateMeta = {
  caseId?: string;
  scenarioId?: string;
  lastOpenedAt?: string;
  lastSavedAt?: string;
  schemaVersion?: number;
  onboarded?: boolean;
};

export type ScenarioStatePayload = {
  stateVersion: number;
  schemaVersion: number;
  scenarios: unknown[];
  eventLibrary: unknown[];
  events?: unknown[];
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
  schemaVersion: 2,
  scenarios: [],
  eventLibrary: [],
  events: [],
  activeScenarioId: "",
  meta: {
    caseId: input?.caseId,
    scenarioId: input?.scenarioId,
    schemaVersion: 2,
    onboarded: false,
  },
  revision: 0,
});
