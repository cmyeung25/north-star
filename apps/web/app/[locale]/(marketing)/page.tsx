import { redirect } from "next/navigation";
import { defaultLocale, locales, type Locale } from "../../../src/i18n/routing";

type MarketingLocalePageProps = {
  params: { locale: string };
};

export default function MarketingPage({ params }: MarketingLocalePageProps) {
  const locale = locales.includes(params.locale as Locale)
    ? (params.locale as Locale)
    : defaultLocale;

  if (locale === defaultLocale) {
    redirect("/web");
  }

  redirect(`/${locale}/web`);
}
