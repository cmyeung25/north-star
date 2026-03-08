import { formatCurrency } from "../../lib/i18n";
import type { DashboardMetricKey, HealthScorecardStatus } from "../../src/domain/dashboard/healthScorecard";

type FormatNullableCurrencyKpiValueInput = {
  value: number | null;
  currency: string;
  locale: string;
  emptyValueLabel: string;
  monthLabel?: string;
};

const isPresentMetricValue = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

export const formatNullableCurrencyKpiValue = ({
  value,
  currency,
  locale,
  emptyValueLabel,
  monthLabel,
}: FormatNullableCurrencyKpiValueInput): string => {
  if (!isPresentMetricValue(value)) {
    return emptyValueLabel;
  }

  const formatted = formatCurrency(value, currency, locale);
  return monthLabel ? `${formatted} / ${monthLabel}` : formatted;
};

export const resolveNullableMetricScoreStatus = (
  metric: DashboardMetricKey,
  status: HealthScorecardStatus,
  nullableMetricValues: Partial<Record<DashboardMetricKey, number | null>>
): HealthScorecardStatus => {
  if (!(metric in nullableMetricValues)) {
    return status;
  }

  return isPresentMetricValue(nullableMetricValues[metric] ?? null)
    ? status
    : "no-data";
};

