import { normalizeMonthStrict } from "../../utils/month";
import { WarningCode, type CompilerWarning } from "../warnings/types";

export type PlanLabDraftWarning = CompilerWarning;

export const toNumber = (value: number | null | undefined, fallback = 0) => {
  const normalized = Number(value ?? fallback);
  return Number.isFinite(normalized) ? normalized : fallback;
};

export const clampNonNegative = (value: number) => Math.max(0, value);

export const normalizeDraftMonth = (
  label: string,
  value: string | null | undefined,
  warnings: PlanLabDraftWarning[],
  meta?: Record<string, unknown>
): string | null => {
  if (!value) {
    return null;
  }
  const normalized = normalizeMonthStrict(value);
  if (!normalized.ok) {
    warnings.push({
      code: WarningCode.MonthInvalid,
      severity: "warning",
      messageKey: "warnings.monthInvalid",
      defaultMessage: `${label} has invalid month ${value}.`,
      refs: { month: value },
      debug: { ...meta, rawValue: value, reason: normalized.reason },
    });
    return null;
  }
  return normalized.month;
};
