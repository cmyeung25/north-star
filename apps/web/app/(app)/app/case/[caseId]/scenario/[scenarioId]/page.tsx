import { redirect } from "next/navigation";
import { buildAppScenarioUrl } from "../../../../../../../lib/routes";

type PageProps = {
  params: { caseId: string; scenarioId: string };
};

export default function AppCaseScenarioPage({ params }: PageProps) {
  redirect(`${buildAppScenarioUrl({ caseId: params.caseId, scenarioId: params.scenarioId })}/dashboard`);
}
