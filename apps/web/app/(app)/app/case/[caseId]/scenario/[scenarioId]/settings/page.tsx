import { notFound } from "next/navigation";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { Title } from "@mantine/core";
import { createSupabaseServerClient } from "../../../../../../../../src/lib/supabase/server";
import ScenarioSettingsClient from "./ScenarioSettingsClient";

type PageProps = {
  params: { caseId: string; scenarioId: string };
};

export default async function ScenarioSettingsPage({ params }: PageProps) {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const scenarios = await repo.listScenarios(params.caseId);
  if (!scenarios.some((scenario) => scenario.id === params.scenarioId)) {
    notFound();
  }

  return (
    <>
      <Title order={3} mb="md">
        情景設定
      </Title>
      <ScenarioSettingsClient
        caseId={params.caseId}
        activeScenarioId={params.scenarioId}
        scenarios={scenarios}
      />
    </>
  );
}
