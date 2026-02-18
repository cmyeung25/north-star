import { redirect } from "next/navigation";
import { memberCasesPath } from "../../../lib/routes/canonicalRoutes";
import { type Locale } from "../../../src/i18n/routing";

export default function LegacyScenariosRedirectPage({
  params,
}: {
  params: { locale: Locale };
}) {
  redirect(memberCasesPath(params.locale));
}
