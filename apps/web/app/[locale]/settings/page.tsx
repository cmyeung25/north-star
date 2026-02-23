// TODO(2026-06-30): Remove this legacy flat-route bridge after clients migrate to canonical /app/case/:caseId/scenario/:scenarioId paths.
import { redirect } from "next/navigation";
import { resolveLegacySettingsRedirectPath } from "../../../lib/routes/legacySettingsRedirect";

type PageProps = {
  params: { locale: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ params, searchParams }: PageProps) {
  redirect(resolveLegacySettingsRedirectPath(params.locale, searchParams));
}
