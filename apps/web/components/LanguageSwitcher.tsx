"use client";

import { Select } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { locales } from "../src/i18n/routing";

const getPathWithoutLocale = (pathname: string) => {
  const localePrefix = locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (!localePrefix) {
    return pathname;
  }

  const stripped = pathname.replace(`/${localePrefix}`, "");
  return stripped === "" ? "/" : stripped;
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (nextLocale: string | null) => {
    if (!nextLocale || nextLocale === locale) {
      return;
    }

    const restPath = getPathWithoutLocale(pathname);
    const query = searchParams.toString();
    const nextUrl = query
      ? `/${nextLocale}${restPath}?${query}`
      : `/${nextLocale}${restPath}`;

    router.replace(nextUrl);
  };

  return (
    <Select
      size="xs"
      value={locale}
      onChange={handleChange}
      data={locales.map((option) => ({
        value: option,
        label: option === "zh-Hant-HK" ? t("languageZhHant") : t("languageEn"),
      }))}
      aria-label={t("languageSwitcherLabel")}
    />
  );
}
