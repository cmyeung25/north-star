import "@mantine/core/styles.css";
import "./globals.css";
import type { Metadata } from "next";
import { ColorSchemeScript } from "@mantine/core";
import Providers from "./providers";
import type { ReactNode } from "react";
import { t } from "../lib/i18n";

export const metadata: Metadata = {
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

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh-HK">
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
