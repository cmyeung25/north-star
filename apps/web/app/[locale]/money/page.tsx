import { redirect } from "next/navigation";
import { ensureDefaultCaseAndScenario } from "../../../lib/scenario/pipeline";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function Page({ searchParams }: PageProps) {
  const { caseId, scenarioId } = await ensureDefaultCaseAndScenario();
  const query = new URLSearchParams();
  if (typeof searchParams?.tab === "string") {
    query.set("tab", searchParams.tab);
  }
  const queryString = query.toString();
  redirect(`/app/case/${caseId}/scenario/${scenarioId}/money${queryString ? `?${queryString}` : ""}`);
}
