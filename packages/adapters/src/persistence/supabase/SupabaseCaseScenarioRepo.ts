import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CaseScenarioRepo,
  CreateCaseInput,
  CreateScenarioInput,
} from "../CaseScenarioRepo";
import { RevisionConflictError } from "../CaseScenarioRepo";
import type { SaveScenarioResult, ScenarioPayload } from "../types";
import { ensureEventSchemaMarker } from "../../scenario/ensureEventSchemaMarker";
import { normalizeScenarioPayloadSchema } from "../../scenario/normalizeScenarioPayloadSchema";

type DbClient = SupabaseClient;

const getSchemaVersion = (state: unknown): number => {
  if (!state || typeof state !== "object") {
    return 1;
  }

  const topLevelVersion = (state as { schemaVersion?: unknown }).schemaVersion;
  if (typeof topLevelVersion === "number") {
    return topLevelVersion;
  }

  const meta = (state as { meta?: unknown }).meta;
  if (!meta || typeof meta !== "object") {
    return 1;
  }

  const schemaVersion = (meta as { schemaVersion?: unknown }).schemaVersion;
  return typeof schemaVersion === "number" ? schemaVersion : 1;
};

export class SupabaseCaseScenarioRepo implements CaseScenarioRepo {
  constructor(private readonly client: DbClient) {}

  private async requireOwnerId() {
    const {
      data: { user },
      error,
    } = await this.client.auth.getUser();

    if (error) {
      throw error;
    }

    if (!user) {
      throw new Error("Authenticated user is required for case/scenario persistence.");
    }

    return user.id;
  }

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
    const ownerId = await this.requireOwnerId();
    const { data, error } = await this.client
      .from("cases")
      .insert({ owner_id: ownerId, title: input.title, currency: input.currency ?? "HKD" })
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
      .select("id,case_id,title,state,revision,created_at,updated_at")
      .eq("case_id", caseId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      caseId: row.case_id,
      title: row.title,
      schemaVersion: getSchemaVersion(row.state),
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createScenario(caseId: string, input: CreateScenarioInput) {
    const ownerId = await this.requireOwnerId();
    const { data, error } = await this.client
      .from("scenarios")
      .insert({
        case_id: caseId,
        owner_id: ownerId,
        title: input.title,
        state: normalizeScenarioPayloadSchema(ensureEventSchemaMarker(input.payload)),
      })
      .select("id,case_id,title,state,revision,created_at,updated_at")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      caseId: data.case_id,
      title: data.title,
      schemaVersion: getSchemaVersion(data.state),
      revision: data.revision,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async duplicateScenario(caseId: string, scenarioId: string) {
    const { data: existing, error: loadError } = await this.client
      .from("scenarios")
      .select("title,state")
      .eq("id", scenarioId)
      .eq("case_id", caseId)
      .single();
    if (loadError) throw loadError;

    const copyBaseTitle = `${existing.title} (Copy)`;
    const { data: sameTitleRows, error: listError } = await this.client
      .from("scenarios")
      .select("title")
      .eq("case_id", caseId)
      .ilike("title", `${copyBaseTitle}%`);
    if (listError) throw listError;

    const existingTitles = new Set((sameTitleRows ?? []).map((row) => row.title));
    let nextTitle = copyBaseTitle;
    let counter = 2;
    while (existingTitles.has(nextTitle)) {
      nextTitle = `${copyBaseTitle} ${counter}`;
      counter += 1;
    }

    return this.createScenario(caseId, {
      title: nextTitle,
      payload: existing.state as ScenarioPayload,
    });
  }


  async renameScenario(caseId: string, scenarioId: string, title: string) {
    const { error } = await this.client
      .from("scenarios")
      .update({ title })
      .eq("id", scenarioId)
      .eq("case_id", caseId);
    if (error) throw error;
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
      .select("state")
      .eq("id", scenarioId)
      .eq("case_id", caseId)
      .single();
    if (error) throw error;
    return normalizeScenarioPayloadSchema(ensureEventSchemaMarker((data.state ?? {}) as ScenarioPayload));
  }

  async saveScenarioPayload(
    caseId: string,
    scenarioId: string,
    payload: ScenarioPayload,
    expectedRevision?: number,
  ): Promise<SaveScenarioResult> {
    const nextRevision =
      typeof expectedRevision === "number" ? expectedRevision + 1 : undefined;
    const { data, error } = await this.client
      .from("scenarios")
      .update({
        state: normalizeScenarioPayloadSchema(ensureEventSchemaMarker(payload)),
        updated_at: new Date().toISOString(),
        ...(typeof nextRevision === "number" ? { revision: nextRevision } : {}),
      })
      .eq("id", scenarioId)
      .eq("case_id", caseId)
      .match(
        typeof expectedRevision === "number"
          ? { revision: expectedRevision }
          : {},
      )
      .select("revision,updated_at")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new RevisionConflictError();
    }

    return { revision: data.revision, lastSavedAt: data.updated_at };
  }
}
