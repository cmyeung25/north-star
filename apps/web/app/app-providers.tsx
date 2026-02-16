"use client";

import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { aurinTheme } from "./theme/aurinTheme";

type ProvidersProps = {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
};

export default function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <MantineProvider theme={aurinTheme}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        onError={(error) => {
          if (error.code === "MISSING_MESSAGE") {
            return;
          }
          console.warn(error);
        }}
        getMessageFallback={({ key }) => key}
      >
        {children}
      </NextIntlClientProvider>
    </MantineProvider>
  );
}
