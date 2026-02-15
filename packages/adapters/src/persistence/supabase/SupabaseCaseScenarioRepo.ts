import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CaseScenarioRepo,
  CreateCaseInput,
  CreateScenarioInput,
} from "../CaseScenarioRepo";
import { RevisionConflictError } from "../CaseScenarioRepo";
import type { SaveScenarioResult, ScenarioPayload } from "../types";
type DbClient = SupabaseClient;

export class SupabaseCaseScenarioRepo implements CaseScenarioRepo {
  constructor(private readonly client: DbClient) {}

  async listCases() {
    const { data, error } = await this.client
      .from("cases")
      .select("id,title,created_at,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createCase(input: CreateCaseInput) {
    const { data, error } = await this.client
      .from("cases")
      .insert({ title: input.title })
      .select("id,title,created_at,updated_at")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async renameCase(caseId: string, title: string) {
    const { error } = await this.client.from("cases").update({ title }).eq("id", caseId);
    if (error) throw error;
  }

  async deleteCase(caseId: string) {
    const { error } = await this.client.from("cases").delete().eq("id", caseId);
    if (error) throw error;
  }

  async listScenarios(caseId: string) {
    const { data, error } = await this.client
      .from("scenarios")
      .select("id,case_id,title,schema_version,revision,created_at,updated_at")
      .eq("case_id", caseId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      caseId: row.case_id,
      title: row.title,
      schemaVersion: row.schema_version,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createScenario(caseId: string, input: CreateScenarioInput) {
    const { data, error } = await this.client
      .from("scenarios")
      .insert({
        case_id: caseId,
        title: input.title,
        payload: input.payload,
        schema_version: input.schemaVersion ?? 1,
      })
      .select("id,case_id,title,schema_version,revision,created_at,updated_at")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      caseId: data.case_id,
      title: data.title,
      schemaVersion: data.schema_version,
      revision: data.revision,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async duplicateScenario(caseId: string, scenarioId: string) {
    const { data: existing, error: loadError } = await this.client
      .from("scenarios")
      .select("title,payload,schema_version")
      .eq("id", scenarioId)
      .eq("case_id", caseId)
      .single();
    if (loadError) throw loadError;

    return this.createScenario(caseId, {
      title: `${existing.title} (Copy)`,
      payload: existing.payload as ScenarioPayload,
      schemaVersion: existing.schema_version,
    });
  }

  async deleteScenario(caseId: string, scenarioId: string) {
    const { error } = await this.client
      .from("scenarios")
      .delete()
      .eq("id", scenarioId)
      .eq("case_id", caseId);
    if (error) throw error;
  }

  async loadScenarioPayload(caseId: string, scenarioId: string) {
    const { data, error } = await this.client
      .from("scenarios")
      .select("payload")
      .eq("id", scenarioId)
      .eq("case_id", caseId)
      .single();
    if (error) throw error;
    return (data.payload ?? {}) as ScenarioPayload;
  }

  async saveScenarioPayload(
    caseId: string,
    scenarioId: string,
    payload: ScenarioPayload,
    expectedRevision?: number,
  ): Promise<SaveScenarioResult> {
    if (typeof expectedRevision !== "number") {
      const { data, error } = await this.client
        .from("scenarios")
        .update({ payload, updated_at: new Date().toISOString() })
        .eq("id", scenarioId)
        .eq("case_id", caseId)
        .select("revision,updated_at")
        .single();
      if (error) throw error;
      return { revision: data.revision, lastSavedAt: data.updated_at };
    }

    const { data: current, error: currentError } = await this.client
      .from("scenarios")
      .select("revision")
      .eq("id", scenarioId)
      .eq("case_id", caseId)
      .single();
    if (currentError) throw currentError;
    if (current.revision !== expectedRevision) {
      throw new RevisionConflictError();
    }

    const nextRevision = expectedRevision + 1;
    const { data, error } = await this.client
      .from("scenarios")
      .update({ payload, revision: nextRevision, updated_at: new Date().toISOString() })
      .eq("id", scenarioId)
      .eq("case_id", caseId)
      .eq("revision", expectedRevision)
      .select("revision,updated_at")
      .single();

    if (error) {
      throw new RevisionConflictError();
    }

    return { revision: data.revision, lastSavedAt: data.updated_at };
  }
}
