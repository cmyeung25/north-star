// TODO(2026-06-30): Remove this legacy flat-route bridge after clients migrate to canonical /app/case/:caseId/scenario/:scenarioId paths.
import { redirect } from "next/navigation";
import { memberCasesPath } from "../../../lib/routes/canonicalRoutes";
import { type Locale } from "../../../src/i18n/routing";

export default function LegacyOverviewPage({
  params,
}: {
  params: { locale: Locale };
}) {
  redirect(memberCasesPath(params.locale));
}
