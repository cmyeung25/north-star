import { formatCurrency as formatCurrencyWithLocale } from "../../lib/i18n";
import type { ScenarioRiskLevel } from "./types";

export const riskColorMap: Record<ScenarioRiskLevel, string> = {
  Low: "teal",
  Medium: "yellow",
  High: "red",
};

type Translator = (key: string, values?: Record<string, string | number>) => string;

export const formatCurrency = (value: number, currency: string, locale: string) =>
  formatCurrencyWithLocale(value, currency, locale);

export const formatRelativeTime = (
  t: Translator,
  updatedAt: number,
  locale: string
) => {
  const diffMs = Date.now() - updatedAt;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return t("timeToday");
  }

  if (diffDays < 7) {
    return t("timeDaysAgo", { count: diffDays });
  }

  if (diffDays < 30) {
    const weeks = Math.round(diffDays / 7);
    return t("timeWeeksAgo", { count: weeks });
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(updatedAt));
};

export const formatRiskLevel = (t: Translator, riskLevel: ScenarioRiskLevel) => {
  switch (riskLevel) {
    case "Low":
      return t("riskLow");
    case "Medium":
      return t("riskMedium");
    case "High":
      return t("riskHigh");
    default:
      return riskLevel;
  }
};
