import { redirect } from "next/navigation";
import { resolveLegacySettingsRedirectPath } from "../../../lib/routes/legacySettingsRedirect";

type PageProps = {
  params: { locale: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ params, searchParams }: PageProps) {
  redirect(resolveLegacySettingsRedirectPath(params.locale, searchParams));
}
