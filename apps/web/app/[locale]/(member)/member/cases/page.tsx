import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from '../../../../../src/lib/supabase/server';
import { CasesList } from "../components/CasesList";
import { MemberShell } from "../components/MemberShell";

export default async function MemberCasesPage() {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const cases = await repo.listCases();

  return (
    <MemberShell title="個案" description="會員專區的個案/情境管理。">
      <CasesList cases={cases} />
    </MemberShell>
  );
}
