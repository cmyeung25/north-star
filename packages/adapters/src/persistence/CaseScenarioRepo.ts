import type { CaseSummary, SaveScenarioResult, ScenarioPayload, ScenarioSummary } from "./types";

export type CreateCaseInput = { title: string };
export type CreateScenarioInput = { title: string; payload: ScenarioPayload; schemaVersion?: number };

export class RevisionConflictError extends Error {
  constructor(message = "Scenario revision conflict") {
    super(message);
    this.name = "RevisionConflictError";
  }
}

export interface CaseScenarioRepo {
  listCases(): Promise<CaseSummary[]>;
  createCase(input: CreateCaseInput): Promise<CaseSummary>;
  renameCase(caseId: string, title: string): Promise<void>;
  deleteCase(caseId: string): Promise<void>;
  listScenarios(caseId: string): Promise<ScenarioSummary[]>;
  createScenario(caseId: string, input: CreateScenarioInput): Promise<ScenarioSummary>;
  duplicateScenario(caseId: string, scenarioId: string): Promise<ScenarioSummary>;
  deleteScenario(caseId: string, scenarioId: string): Promise<void>;
  loadScenarioPayload(caseId: string, scenarioId: string): Promise<ScenarioPayload>;
  saveScenarioPayload(
    caseId: string,
    scenarioId: string,
    payload: ScenarioPayload,
    expectedRevision?: number,
  ): Promise<SaveScenarioResult>;
}
