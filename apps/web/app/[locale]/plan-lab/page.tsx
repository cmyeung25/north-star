import { redirect } from "next/navigation";
import { ensureDefaultCaseAndScenario } from "../../../lib/scenario/pipeline";

export default async function Page() {
  const { caseId, scenarioId } = await ensureDefaultCaseAndScenario();
  redirect(`/app/case/${caseId}/scenario/${scenarioId}/planlab`);
}
