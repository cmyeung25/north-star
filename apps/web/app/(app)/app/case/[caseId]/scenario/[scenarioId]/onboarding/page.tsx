import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { scenarioDashboardPath } from "../../../../../../../../lib/routes/appRoutes";
import OnboardingEntry from "../../../../../../../../src/features/onboarding/OnboardingEntry";
import { resolveScenarioLifecycleFromPayload } from "../../../../../../../../lib/scenario/isScenarioOnboarded";
import { createSupabaseServerClient } from "../../../../../../../../src/lib/supabase/server";

export const metadata: Metadata = {
  title: "Scenario onboarding",
};

type PageProps = {
  params: { caseId?: string; scenarioId?: string };
};

export default async function ScenarioOnboardingPage({ params }: PageProps) {
  if (!params.caseId || !params.scenarioId) {
    notFound();
  }

  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const payload = (await repo.loadScenarioPayload(params.caseId, params.scenarioId)) as Record<string, unknown>;

  if (resolveScenarioLifecycleFromPayload(payload, params.scenarioId) === "active") {
    redirect(scenarioDashboardPath(params.caseId, params.scenarioId));
  }

  return <OnboardingEntry />;
}
