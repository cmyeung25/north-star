"use client";

import { Select } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { defaultLocale, locales } from "../src/i18n/routing";

const getPathWithoutLocale = (pathname: string) => {
  const localePrefix = locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
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
    const localizedPath = nextLocale === defaultLocale ? restPath : `/${nextLocale}${restPath}`;
    const nextUrl = query ? `${localizedPath}?${query}` : localizedPath;

    router.replace(nextUrl);
  };

  return (
    <Select
      size="xs"
      value={locale}
      onChange={handleChange}
      data={locales.map((option) => ({
        value: option,
        label:
          option === "en"
            ? t("languageEn")
            : option === "zh-HK"
              ? `${t("languageZhHant")} (HK)`
              : t("languageZhHant"),
      }))}
      aria-label={t("languageSwitcherLabel")}
    />
  );
}
