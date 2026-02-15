import Link from "next/link";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../src/lib/supabase/server";
import { createCase } from "./actions";

export default async function MemberCasesPage() {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });
  const cases = await repo.listCases();

  return (
    <section>
      <h1>Cases</h1>
      <form action={createCase} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input name="title" placeholder="New case title" />
        <button type="submit">Create Case</button>
      </form>
      <ul>
        {cases.map((entry) => (
          <li key={entry.id}>
            <Link href={`/member/cases/${entry.id}`}>{entry.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
