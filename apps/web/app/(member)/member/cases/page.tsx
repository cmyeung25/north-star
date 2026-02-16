import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../src/lib/supabase/server";
import { CasesList } from "../components/CasesList";
import { MemberShell } from "../components/MemberShell";

export default async function MemberCasesPage() {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const cases = await repo.listCases();

  return (
    <MemberShell title="Cases" description="Member area for case/scenario management.">
      <CasesList cases={cases} />
    </MemberShell>
  );
}
