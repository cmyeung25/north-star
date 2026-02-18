"use client";

import type { AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";
import RootProviders from "./_providers/RootProviders";

type ProvidersProps = {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
};

export default function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <RootProviders locale={locale} messages={messages}>
      {children}
    </RootProviders>
  );
}
