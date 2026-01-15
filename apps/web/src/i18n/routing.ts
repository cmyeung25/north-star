export const locales = ["zh-Hant-HK", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-Hant-HK";
