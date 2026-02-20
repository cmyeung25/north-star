"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { defaultLocale, locales, type Locale } from "../../../../src/i18n/routing";

const LOCALE_COOKIE_NAME = "aurin_locale";

const isLocale = (value: string): value is Locale => locales.includes(value as Locale);

const resolveLocaleFromPathname = (pathname: string): Locale | null => {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (!firstSegment) {
    return null;
  }

  return isLocale(firstSegment) ? firstSegment : null;
};

const resolveLocaleFromCookie = (): Locale | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const localeCookie = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${LOCALE_COOKIE_NAME}=`));

  if (!localeCookie) {
    return null;
  }

  const value = decodeURIComponent(localeCookie.split("=")[1] ?? "");
  return isLocale(value) ? value : null;
};

export default function AuthCallbackPage() {
  const t = useTranslations("auth.callback");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const locale = resolveLocaleFromPathname(pathname) ?? resolveLocaleFromCookie() ?? defaultLocale;
    router.replace(`/${locale}/member/cases`);
  }, [pathname, router]);

  return <p>{t("redirecting")}</p>;
}
