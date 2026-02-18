import { redirect } from "next/navigation";
import { caseEnterPath } from "../../../../../../lib/routes/canonicalRoutes";
import { type Locale } from "../../../../../../src/i18n/routing";

export default function LegacyCaseScenariosPage({
  params,
}: {
  params: { locale: Locale; caseId: string };
}) {
  redirect(caseEnterPath(params.caseId, params.locale));
}
