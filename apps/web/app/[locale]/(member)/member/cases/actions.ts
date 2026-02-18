"use server";

import { revalidatePath } from "next/cache";
import { createCaseScenarioRepo, createEmptyScenarioPayload } from "@north-star/adapters";
import { scenarioDashboardPath, scenarioOnboardingPath } from "../../../../../lib/routes/appRoutes";
import { isScenarioOnboarded } from "../../../../../lib/scenario/isScenarioOnboarded";
import { createSupabaseServerClient } from "../../../../../src/lib/supabase/server";

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
      currency: "HKD",
      caseId: input.caseId,
      createdFrom: "member-create-scenario",
    }),
  });

  revalidatePath(`/member/cases/${input.caseId}`);

  return {
    caseId: input.caseId,
    scenarioId: createdScenario.id,
    redirectPath: scenarioOnboardingPath(input.caseId, createdScenario.id),
  };
}

export async function renameScenarioAction(input: { caseId: string; scenarioId: string; title: string }) {
  await repo().renameScenario(input.caseId, input.scenarioId, normalizeTitle(input.title, "Untitled Scenario"));
  revalidatePath(`/member/cases/${input.caseId}`);
  revalidatePath(`/app/case/${input.caseId}/scenario/${input.scenarioId}/settings`);
}

export async function duplicateScenarioAction(input: { caseId: string; scenarioId: string }) {
  await repo().duplicateScenario(input.caseId, input.scenarioId);
  revalidatePath(`/member/cases/${input.caseId}`);
}

export async function deleteScenarioAction(input: { caseId: string; scenarioId: string }) {
  await repo().deleteScenario(input.caseId, input.scenarioId);
  revalidatePath(`/member/cases/${input.caseId}`);
}

const pickDefaultScenario = <T extends { updatedAt?: string }>(scenarios: T[]) => {
  if (scenarios.length === 0) {
    return null;
  }

  return [...scenarios].sort((left, right) => {
    const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : Number.NEGATIVE_INFINITY;
    const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : Number.NEGATIVE_INFINITY;
    return rightTime - leftTime;
  })[0];
};

export async function openCaseAction(input: { caseId: string; caseCurrency?: string }) {
  const scenarios = await repo().listScenarios(input.caseId);
  const defaultScenario = pickDefaultScenario(scenarios);

  if (defaultScenario) {
    const payload = await repo().loadScenarioPayload(input.caseId, defaultScenario.id);
    const onboarded = isScenarioOnboarded(payload, defaultScenario.id);

    return {
      caseId: input.caseId,
      scenarioId: defaultScenario.id,
      redirectPath: onboarded
        ? scenarioDashboardPath(input.caseId, defaultScenario.id)
        : scenarioOnboardingPath(input.caseId, defaultScenario.id),
    };
  }

  const createdScenario = await repo().createScenario(input.caseId, {
    title: "Scenario 1",
    payload: createEmptyScenarioPayload({
      currency: input.caseCurrency ?? "HKD",
      caseId: input.caseId,
      createdFrom: "member-open-case",
    }),
  });

  revalidatePath("/member/cases");
  revalidatePath(`/member/cases/${input.caseId}`);

  return {
    caseId: input.caseId,
    scenarioId: createdScenario.id,
    redirectPath: scenarioOnboardingPath(input.caseId, createdScenario.id),
  };
}
