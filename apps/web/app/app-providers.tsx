"use client";

import type { AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";
import AppProviders from "./_providers/AppProviders";

type ProvidersProps = {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
};

export default function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <AppProviders locale={locale} messages={messages}>
      {children}
    </AppProviders>
  );
}
