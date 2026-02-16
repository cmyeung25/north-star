import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../../../../src/lib/supabase/server";
import { isScenarioStarted } from "../../../../../../../lib/scenario/isScenarioStarted";
import ScenarioHydrator from "./ScenarioHydrator";
import ScenarioAppShellV2 from "./ScenarioAppShellV2";

type LayoutProps = {
  params: { caseId: string; scenarioId: string };
  children: ReactNode;
};


export default async function AppCaseScenarioLayout({ params, children }: LayoutProps) {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const scenarios = await repo.listScenarios(params.caseId);
  const scenario = scenarios.find((entry) => entry.id === params.scenarioId);

  if (!scenario) {
    notFound();
  }

  const payload = await repo.loadScenarioPayload(params.caseId, params.scenarioId);
  const requestPath = headers().get("x-invoke-path") ?? headers().get("next-url") ?? "";
  const isOnboardingRoute = requestPath.includes("/onboarding");

  if (!isOnboardingRoute && !isScenarioStarted(payload)) {
    redirect(`/app/case/${params.caseId}/scenario/${params.scenarioId}/onboarding`);
  }

  return (
    <ScenarioHydrator
      caseId={params.caseId}
      scenarioId={params.scenarioId}
      payload={payload}
      revision={scenario.revision}
      lastSavedAt={scenario.updatedAt}
    >
      <ScenarioAppShellV2 title={scenario.title}>{children}</ScenarioAppShellV2>
    </ScenarioHydrator>
  );
}
