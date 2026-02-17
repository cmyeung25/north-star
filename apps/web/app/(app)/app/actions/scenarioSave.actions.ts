"use server";

import { createCaseScenarioRepo, RevisionConflictError } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../src/lib/supabase/server";
import { ensureEventsV2Marker } from "../../../../lib/scenario/ensureEventsV2Marker";


const ensureScenarioSaveMeta = (payload: Record<string, unknown>) => {
  const next = { ...payload };
  next.events = Array.isArray(next.events) ? next.events : [];
  const now = new Date().toISOString();
  const meta = next.meta && typeof next.meta === "object" ? (next.meta as Record<string, unknown>) : {};
  next.meta = {
    ...meta,
    schemaVersion: 2,
    lastSavedAt: now,
    onboarded: meta.onboarded === true,
  };
  next.schemaVersion = 2;
  return next;
};

const repo = () =>
  createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

export async function saveScenarioPayloadAction(
  caseId: string,
  scenarioId: string,
  payload: Record<string, unknown>,
  expectedRevision: number,
) {
  try {
    return await repo().saveScenarioPayload(
      caseId,
      scenarioId,
      ensureEventsV2Marker(ensureScenarioSaveMeta(payload)),
      expectedRevision,
    );
  } catch (error) {
    if (error instanceof RevisionConflictError) {
      throw new Error("REVISION_CONFLICT");
    }
    throw error;
  }
}

export async function reloadScenarioPayloadAction(caseId: string, scenarioId: string) {
  const scenarioRepo = repo();
  const [payload, scenarios] = await Promise.all([
    scenarioRepo.loadScenarioPayload(caseId, scenarioId),
    scenarioRepo.listScenarios(caseId),
  ]);

  const summary = scenarios.find((entry) => entry.id === scenarioId);
  if (!summary) {
    throw new Error("SCENARIO_NOT_FOUND");
  }

  return {
    payload,
    revision: summary.revision,
    lastSavedAt: summary.updatedAt,
  };
}

export async function duplicateScenarioFromLocalPayloadAction(
  caseId: string,
  scenarioId: string,
  payload: Record<string, unknown>,
) {
  const scenarioRepo = repo();
  const duplicate = await scenarioRepo.duplicateScenario(caseId, scenarioId);
  const saved = await scenarioRepo.saveScenarioPayload(
    caseId,
    duplicate.id,
    ensureEventsV2Marker(ensureScenarioSaveMeta(payload)),
    duplicate.revision,
  );

  return {
    scenarioId: duplicate.id,
    revision: saved.revision,
    lastSavedAt: saved.lastSavedAt,
  };
}
