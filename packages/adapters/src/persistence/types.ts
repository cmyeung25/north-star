export type CaseSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioSummary = {
  id: string;
  caseId: string;
  title: string;
  schemaVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioPayload = Record<string, unknown>;

export type SaveScenarioResult = {
  revision: number;
  lastSavedAt: string;
};
