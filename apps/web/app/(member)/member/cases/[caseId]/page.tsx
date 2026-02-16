import { notFound } from "next/navigation";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../../src/lib/supabase/server";
import { MemberShell } from "../../components/MemberShell";
import { ScenariosList } from "../../components/ScenariosList";

type PageProps = { params: { caseId: string } };

export default async function CaseScenariosPage({ params }: PageProps) {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const [cases, scenarios] = await Promise.all([repo.listCases(), repo.listScenarios(params.caseId)]);
  const activeCase = cases.find((entry) => entry.id === params.caseId);

  if (!activeCase) {
    notFound();
  }

  return (
    <MemberShell title={activeCase.title} description={`Case ID: ${activeCase.id}`}>
      <ScenariosList caseId={params.caseId} scenarios={scenarios} />
    </MemberShell>
  );
}
