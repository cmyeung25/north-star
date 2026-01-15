import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Providers from "../providers";
import { defaultLocale, locales, type Locale } from "../../src/i18n/routing";

type LocaleLayoutProps = {
  children: ReactNode;
  params: { locale: string };
};

const resolveLocale = (locale: string): Locale => {
  if (locales.includes(locale as Locale)) {
    return locale as Locale;
  }

  return defaultLocale;
};

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const locale = resolveLocale(params.locale);
  const t = await getTranslations({ locale, namespace: "common" });

  return {
    title: t("appName"),
    description: t("appDescription"),
    manifest: "/manifest.json",
    applicationName: t("appName"),
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: t("appName"),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const locale = resolveLocale(params.locale);

  if (!locales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <Providers>{children}</Providers>
    </NextIntlClientProvider>
  );
}
