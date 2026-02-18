import "@mantine/core/styles.css";
import "./styles/tokens.css";
import "./globals.css";
import type { ReactNode } from "react";
import { ColorSchemeScript } from "@mantine/core";
import { cookies, headers } from "next/headers";
import { getMessages } from "next-intl/server";
import { defaultLocale, locales, type Locale } from "../src/i18n/routing";
import RootProviders from "./_providers/RootProviders";

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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = resolveLocale();
  const messages = await getMessages({ locale });

  return (
    <html lang={locale}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <RootProviders locale={locale} messages={messages}>
          {children}
        </RootProviders>
      </body>
    </html>
  );
}
