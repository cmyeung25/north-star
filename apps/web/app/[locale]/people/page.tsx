import { redirect } from "next/navigation";
import { type Locale } from "../../../src/i18n/routing";
import { resolveLegacyPeopleRouteRedirect } from "./legacyRoute";

type PageProps = {
  params: { locale: Locale };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ params, searchParams }: PageProps) {
  redirect(resolveLegacyPeopleRouteRedirect(params.locale, searchParams));
}
