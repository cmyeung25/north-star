import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../../../../src/lib/supabase/server";
import ScenarioHydrator from "./ScenarioHydrator";
import ScenarioAppShellV2 from "./ScenarioAppShellV2";
import ScenarioRouteSync from "../../../../../../../components/ScenarioRouteSync";
import { AppSkeleton } from "../../../../../../../src/features/app-shell/app-skeleton";

type LayoutProps = {
  params: { caseId: string; scenarioId: string };
  children: ReactNode;
};

export default async function AppCaseScenarioLayout({ params, children }: LayoutProps) {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const [cases, scenarios] = await Promise.all([repo.listCases(), repo.listScenarios(params.caseId)]);
  const activeCase = cases.find((entry) => entry.id === params.caseId);
  const scenario = scenarios.find((entry) => entry.id === params.scenarioId);

  if (!scenario) {
    notFound();
  }

  const payload = await repo.loadScenarioPayload(params.caseId, params.scenarioId);

  return (
    <ScenarioAppShellV2 caseTitle={activeCase?.title} scenarioTitle={scenario.title} loading>
      <ScenarioHydrator
        caseId={params.caseId}
        scenarioId={params.scenarioId}
        scenarioTitle={scenario.title}
        payload={payload}
        revision={scenario.revision}
        lastSavedAt={scenario.updatedAt}
        fallback={<AppSkeleton />}
      >
        <ScenarioRouteSync scenarioId={params.scenarioId} payload={payload as Record<string, unknown>} />
        {children}
      </ScenarioHydrator>
    </ScenarioAppShellV2>
  );
}
