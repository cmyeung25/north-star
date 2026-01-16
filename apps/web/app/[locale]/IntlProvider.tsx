"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";

type IntlProviderProps = {
  children: ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
};

export default function IntlProvider({
  children,
  locale,
  messages,
}: IntlProviderProps) {
  return (
    <NextIntlClientProvider
      messages={messages}
      locale={locale}
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
  );
}
