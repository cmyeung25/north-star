"use client";

import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import AurinProviders from "../../components/providers/AurinProviders";

type RootProvidersProps = {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
};

export default function RootProviders({ children, locale, messages }: RootProvidersProps) {
  return (
    <AurinProviders>
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
    </AurinProviders>
  );
}
