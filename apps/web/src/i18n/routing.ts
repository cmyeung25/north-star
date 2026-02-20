export const locales = ["zh-HK", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "zh-HK";
