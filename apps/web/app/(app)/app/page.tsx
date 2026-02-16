import { redirect } from "next/navigation";
import { ensureDefaultCaseAndScenario } from "../../../lib/scenario/pipeline";
import { buildAppScenarioUrl } from "../../../lib/routes";

export default async function AppHomePage() {
  const { caseId, scenarioId } = await ensureDefaultCaseAndScenario();
  redirect(buildAppScenarioUrl({ caseId, scenarioId }));
}
