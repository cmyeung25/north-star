import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../../../../src/lib/supabase/server";
import ScenarioHydrator from "./ScenarioHydrator";
import ScenarioAppShellV2 from "./ScenarioAppShellV2";
import ScenarioRouteSync from "../../../../../../../components/ScenarioRouteSync";

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

  return (
    <ScenarioHydrator
      caseId={params.caseId}
      scenarioId={params.scenarioId}
      scenarioTitle={scenario.title}
      payload={payload}
      revision={scenario.revision}
      lastSavedAt={scenario.updatedAt}
    >
      <ScenarioAppShellV2 title={scenario.title}>
        <ScenarioRouteSync scenarioId={params.scenarioId} payload={payload as Record<string, unknown>} />
        {children}
      </ScenarioAppShellV2>
    </ScenarioHydrator>
  );
}
