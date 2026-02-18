import { redirect } from "next/navigation";
import { memberCasesPath, scenarioDashboardPath } from "../../../lib/routes/appRoutes";

type PageProps = {
  searchParams: {
    caseId?: string;
    scenarioId?: string;
  };
};

export default async function Page({ searchParams }: PageProps) {
  const caseId = searchParams.caseId;
  const scenarioId = searchParams.scenarioId;

  if (!caseId || !scenarioId) {
    redirect(memberCasesPath());
  }

  redirect(scenarioDashboardPath(caseId, scenarioId));
}
