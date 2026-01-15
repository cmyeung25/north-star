import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { defaultLocale, locales, type Locale } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = (locale ?? defaultLocale) as Locale;

  if (!locales.includes(resolvedLocale)) {
    notFound();
  }

  return {
    messages: (await import(`../../messages/${resolvedLocale}.json`)).default,
  };
});
