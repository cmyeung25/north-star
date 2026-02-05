import type { TranslationValues } from "next-intl";

type Translator = (key: string, values?: TranslationValues) => string;

const warnedKeys = new Set<string>();

const looksMissing = (key: string, value: string) => {
  if (!value) {
    return true;
  }
  if (value === key) {
    return true;
  }
  return /^([a-z][\w-]*\.)+[a-z][\w-]*$/i.test(value);
};

export const safeT = (
  t: Translator,
  key: string,
  fallback: string,
  values?: TranslationValues
): string => {
  try {
    const translated = t(key, values);
    if (looksMissing(key, translated)) {
      if (process.env.NODE_ENV !== "production" && !warnedKeys.has(key)) {
        warnedKeys.add(key);
        console.warn("[i18n-missing]", key);
      }
      return fallback;
    }
    return translated;
  } catch {
    if (process.env.NODE_ENV !== "production" && !warnedKeys.has(key)) {
      warnedKeys.add(key);
      console.warn("[i18n-missing]", key);
    }
    return fallback;
  }
};
