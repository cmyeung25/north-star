import { notFound } from "next/navigation";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../../../../src/lib/supabase/server";
import ScenarioCloudClient from "./ScenarioCloudClient";
import ScenarioHydrator from "./ScenarioHydrator";

type PageProps = { params: { caseId: string; scenarioId: string } };

export default async function AppCaseScenarioPage({ params }: PageProps) {
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
    <ScenarioHydrator caseId={params.caseId} scenarioId={params.scenarioId} payload={payload}>
      <ScenarioCloudClient
        caseId={params.caseId}
        scenarioId={params.scenarioId}
        initialPayload={payload}
        initialRevision={scenario.revision}
        title={scenario.title}
        updatedAt={scenario.updatedAt}
      />
    </ScenarioHydrator>
  );
}
