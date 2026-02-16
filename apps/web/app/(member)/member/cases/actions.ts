"use server";

import { revalidatePath } from "next/cache";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../src/lib/supabase/server";
import { createEmptyScenarioStatePayload } from "../../../../lib/scenario/payload";

const emptyScenarioState = createEmptyScenarioStatePayload();

const repo = () =>
  createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

const normalizeTitle = (title: string, fallback: string) => {
  const next = title.trim();
  return next.length > 0 ? next : fallback;
};

export async function createCaseAction(input: { title: string; currency?: string }) {
  await repo().createCase({
    title: normalizeTitle(input.title, "Untitled Case"),
    currency: input.currency ?? "HKD",
  });
  revalidatePath("/member/cases");
}

export async function renameCaseAction(input: { caseId: string; title: string }) {
  await repo().renameCase(input.caseId, normalizeTitle(input.title, "Untitled Case"));
  revalidatePath("/member/cases");
  revalidatePath(`/member/cases/${input.caseId}`);
}

export async function deleteCaseAction(input: { caseId: string }) {
  await repo().deleteCase(input.caseId);
  revalidatePath("/member/cases");
}

export async function createScenarioAction(input: { caseId: string; title: string }) {
  await repo().createScenario(input.caseId, {
    title: normalizeTitle(input.title, "Untitled Scenario"),
    payload: emptyScenarioState,
  });
  revalidatePath(`/member/cases/${input.caseId}`);
}

export async function duplicateScenarioAction(input: { caseId: string; scenarioId: string }) {
  await repo().duplicateScenario(input.caseId, input.scenarioId);
  revalidatePath(`/member/cases/${input.caseId}`);
}

export async function deleteScenarioAction(input: { caseId: string; scenarioId: string }) {
  await repo().deleteScenario(input.caseId, input.scenarioId);
  revalidatePath(`/member/cases/${input.caseId}`);
}
