// TODO(2026-06-30): Remove this legacy flat-route bridge after clients migrate to canonical /app/case/:caseId/scenario/:scenarioId paths.
import { redirect } from "next/navigation";
import { ensureDefaultCaseAndScenario } from "../../../lib/scenario/pipeline";

export default async function Page() {
  const { caseId, scenarioId } = await ensureDefaultCaseAndScenario();
  redirect(`/app/case/${caseId}/scenario/${scenarioId}/planlab`);
}
