import "@mantine/core/styles.css";
import "./globals.css";
import type { ReactNode } from "react";
import { ColorSchemeScript } from "@mantine/core";
import { cookies, headers } from "next/headers";
import { defaultLocale, locales, type Locale } from "../src/i18n/routing";

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

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = resolveLocale();

  return (
    <html lang={locale}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>{children}</body>
    </html>
  );
}
