import Link from "next/link";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { createSupabaseServerClient } from "../../../../../src/lib/supabase/server";
import { createScenario, deleteScenario, duplicateScenario } from "../actions";

type PageProps = { params: { caseId: string } };

export default async function CaseScenariosPage({ params }: PageProps) {
  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const scenarios = await repo.listScenarios(params.caseId);

  return (
    <section>
      <h1>Scenarios</h1>
      <form action={createScenario.bind(null, params.caseId)} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input name="title" placeholder="New scenario title" />
        <button type="submit">Create Scenario</button>
      </form>
      <ul>
        {scenarios.map((scenario) => (
          <li key={scenario.id} style={{ marginBottom: 8 }}>
            <strong>{scenario.title}</strong>{" "}
            <Link href={`/app/case/${params.caseId}/scenario/${scenario.id}`}>Open</Link>{" "}
            <form action={duplicateScenario.bind(null, params.caseId, scenario.id)} style={{ display: "inline-block" }}>
              <button type="submit">Duplicate</button>
            </form>{" "}
            <form action={deleteScenario.bind(null, params.caseId, scenario.id)} style={{ display: "inline-block" }}>
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
