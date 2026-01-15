import { defaultLocale } from "../src/i18n/routing";

export const defaultCurrency = "HKD";

const currencyFormatters = new Map<string, Intl.NumberFormat>();

export const formatCurrency = (
  amount: number,
  currency = defaultCurrency,
  locale = defaultLocale
) => {
  const cacheKey = `${locale}:${currency}`;
  if (!currencyFormatters.has(cacheKey)) {
    currencyFormatters.set(
      cacheKey,
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      })
    );
  }

  return currencyFormatters.get(cacheKey)?.format(amount) ?? `${amount} ${currency}`;
};
