import { notFound, redirect } from "next/navigation";
import { scenarioDashboardPath } from "../../../../../../../lib/routes/appRoutes";

type PageProps = {
  params: { caseId: string; scenarioId: string };
};

export default function AppCaseScenarioPage({ params }: PageProps) {
  if (!params.caseId || !params.scenarioId) {
    notFound();
  }

  redirect(scenarioDashboardPath(params.caseId, params.scenarioId));
}
