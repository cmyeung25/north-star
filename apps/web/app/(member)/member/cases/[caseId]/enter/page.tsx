import { redirect } from "next/navigation";
import { createCaseScenarioRepo, createEmptyScenarioPayload } from "@north-star/adapters";
import { isScenarioOnboarded } from "../../../../../../lib/scenario/isScenarioOnboarded";
import { memberCasesPath, scenarioDashboardPath, scenarioOnboardingPath } from "../../../../../../lib/routes/canonicalRoutes";
import { createSupabaseServerClient } from "../../../../../../src/lib/supabase/server";

const repo = () =>
  createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

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

export default async function CaseEnterPage({ params }: { params: { caseId: string } }) {
  const scenarioRepo = repo();
  const activeCase = (await scenarioRepo.listCases()).find((entry) => entry.id === params.caseId);

  if (!activeCase) {
    redirect(memberCasesPath());
  }

  const listedScenarios = await scenarioRepo.listScenarios(params.caseId);
  const defaultScenario = pickDefaultScenario(listedScenarios);
  const targetScenario =
    defaultScenario ??
    (await scenarioRepo.createScenario(params.caseId, {
      title: "New Scenario",
      payload: createEmptyScenarioPayload({
        currency: "HKD",
        caseId: params.caseId,
        createdFrom: "member-case-enter",
      }),
    }));

  const payload = await scenarioRepo.loadScenarioPayload(params.caseId, targetScenario.id);
  const onboarded = isScenarioOnboarded(payload, targetScenario.id);
  const destination = onboarded
    ? scenarioDashboardPath(params.caseId, targetScenario.id)
    : scenarioOnboardingPath(params.caseId, targetScenario.id);

  redirect(destination);
}
