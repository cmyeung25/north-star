import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { scenarioOnboardingPath } from "../../../../../../../../lib/routes/appRoutes";
import { isScenarioOnboarded } from "../../../../../../../../lib/scenario/isScenarioOnboarded";
import { createSupabaseServerClient } from "../../../../../../../../src/lib/supabase/server";

type LayoutProps = {
  params: { caseId: string; scenarioId: string };
  children: ReactNode;
};

export default async function AppCaseScenarioGatedLayout({ params, children }: LayoutProps) {
  if (!params.caseId || !params.scenarioId) {
    notFound();
  }

  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const payload = (await repo.loadScenarioPayload(params.caseId, params.scenarioId)) as Record<string, unknown>;

  if (!isScenarioOnboarded(payload, params.scenarioId)) {
    redirect(scenarioOnboardingPath(params.caseId, params.scenarioId));
  }

  return children;
}
