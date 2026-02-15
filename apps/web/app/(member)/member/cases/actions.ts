"use server";

import { revalidatePath } from "next/cache";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../src/lib/supabase/server";

const defaultPayload = {
  scenarios: [],
  eventLibrary: [],
  activeScenarioId: "",
};

const repo = () =>
  createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

export async function createCase(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim() || "Untitled Case";
  await repo().createCase({ title });
  revalidatePath("/member/cases");
}

export async function createScenario(caseId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim() || "Untitled Scenario";
  await repo().createScenario(caseId, { title, payload: defaultPayload });
  revalidatePath(`/member/cases/${caseId}`);
}

export async function duplicateScenario(caseId: string, scenarioId: string) {
  await repo().duplicateScenario(caseId, scenarioId);
  revalidatePath(`/member/cases/${caseId}`);
}

export async function deleteScenario(caseId: string, scenarioId: string) {
  await repo().deleteScenario(caseId, scenarioId);
  revalidatePath(`/member/cases/${caseId}`);
}
