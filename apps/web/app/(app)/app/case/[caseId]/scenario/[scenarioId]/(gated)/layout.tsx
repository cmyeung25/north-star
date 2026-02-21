import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createCaseScenarioRepo } from "@north-star/adapters";
import { resolveScenarioLifecyclePath } from "../../../../../../../../lib/scenario/lifecycle";
import { resolveScenarioLifecycleFromPayload } from "../../../../../../../../lib/scenario/isScenarioOnboarded";
import { createSupabaseServerClient } from "../../../../../../../../src/lib/supabase/server";
import { defaultLocale, locales, type Locale } from "../../../../../../../../src/i18n/routing";

type LayoutProps = {
  params: { caseId: string; scenarioId: string };
  children: ReactNode;
};

const resolveLocale = (): Locale => {
  const localeFromHeader = headers().get("x-next-intl-locale");
  if (localeFromHeader && locales.includes(localeFromHeader as Locale)) {
    return localeFromHeader as Locale;
  }

  const localeFromCookie = cookies().get("NEXT_LOCALE")?.value;
  if (localeFromCookie && locales.includes(localeFromCookie as Locale)) {
    return localeFromCookie as Locale;
  }

  return defaultLocale;
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale();
  const t = await getTranslations({ locale, namespace: "common" });

  return {
    title: t("appName"),
    description: t("appDescription"),
    manifest: "/manifest.json",
    applicationName: t("appName"),
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: t("appName"),
    },
  };
}

export default async function AppCaseScenarioGatedLayout({ params, children }: LayoutProps) {
  if (!params.caseId || !params.scenarioId) {
    notFound();
  }

  const repo = createCaseScenarioRepo({
    mode: "cloud",
    supabaseClient: createSupabaseServerClient(),
  });

  const payload = (await repo.loadScenarioPayload(params.caseId, params.scenarioId)) as Record<string, unknown>;

  if (resolveScenarioLifecycleFromPayload(payload, params.scenarioId) !== "active") {
    redirect(resolveScenarioLifecyclePath(params.caseId, params.scenarioId, "draft", "dashboard"));
  }

  return children;
}
