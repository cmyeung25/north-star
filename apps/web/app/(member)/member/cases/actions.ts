"use server";

import { revalidatePath } from "next/cache";
import { createCaseScenarioRepo, createEmptyScenarioPayload } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../src/lib/supabase/server";

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
  const createdCase = await repo().createCase({
    title: normalizeTitle(input.title, "Untitled Case"),
    currency: input.currency ?? "HKD",
  });

  const createdScenario = await repo().createScenario(createdCase.id, {
    title: "New Scenario",
    payload: createEmptyScenarioPayload({
      currency: input.currency ?? "HKD",
      caseId: createdCase.id,
      createdFrom: "member-create-case",
    }),
  });

  revalidatePath("/member/cases");

  return {
    caseId: createdCase.id,
    scenarioId: createdScenario.id,
  };
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
  const createdScenario = await repo().createScenario(input.caseId, {
    title: normalizeTitle(input.title, "Untitled Scenario"),
    payload: createEmptyScenarioPayload({
      caseId: input.caseId,
      createdFrom: "member-create-scenario",
    }),
  });

  revalidatePath(`/member/cases/${input.caseId}`);

  return {
    caseId: input.caseId,
    scenarioId: createdScenario.id,
  };
}

export async function duplicateScenarioAction(input: { caseId: string; scenarioId: string }) {
  await repo().duplicateScenario(input.caseId, input.scenarioId);
  revalidatePath(`/member/cases/${input.caseId}`);
}

export async function deleteScenarioAction(input: { caseId: string; scenarioId: string }) {
  await repo().deleteScenario(input.caseId, input.scenarioId);
  revalidatePath(`/member/cases/${input.caseId}`);
}
