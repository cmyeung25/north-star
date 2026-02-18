import { redirect } from "next/navigation";
import {
  memberCasesPath,
  scenarioDashboardPath,
} from "../../../lib/routes/canonicalRoutes";
import { type Locale } from "../../../src/i18n/routing";

type PageProps = {
  params: { locale: Locale };
  searchParams: {
    caseId?: string;
    scenarioId?: string;
  };
};

export default async function LegacyDashboardRedirectPage({
  params,
  searchParams,
}: PageProps) {
  const { caseId, scenarioId } = searchParams;

  if (!caseId || !scenarioId) {
    redirect(memberCasesPath(params.locale));
  }

  redirect(scenarioDashboardPath(caseId, scenarioId, params.locale));
}
