import type { CaseScenarioRepo } from "../CaseScenarioRepo";

export class LocalCaseScenarioRepo implements CaseScenarioRepo {
  private notImplemented(): never {
    throw new Error("LocalCaseScenarioRepo is not implemented yet.");
  }

  async listCases() { return this.notImplemented(); }
  async createCase() { return this.notImplemented(); }
  async renameCase() { return this.notImplemented(); }
  async deleteCase() { return this.notImplemented(); }
  async listScenarios() { return this.notImplemented(); }
  async createScenario() { return this.notImplemented(); }
  async duplicateScenario() { return this.notImplemented(); }
  async renameScenario() { return this.notImplemented(); }
  async deleteScenario() { return this.notImplemented(); }
  async loadScenarioPayload() { return this.notImplemented(); }
  async saveScenarioPayload() { return this.notImplemented(); }
}
