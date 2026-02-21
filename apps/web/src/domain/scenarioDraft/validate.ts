import { defaultCurrency } from "../../../lib/i18n";
import { isValidMonthKey } from "../../utils/monthKey";
import type { ScenarioDraft, ValidationIssue } from "./types";

const MONTH_FIELD_PATTERN = /Month$/;

const normalizeStringId = (
  value: string | undefined,
  fallback: string,
  field: string,
  issues: ValidationIssue[]
) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    issues.push({
      code: "invalid-id",
      field,
      message: `${field} is required.`,
    });
    return fallback;
  }
  return trimmed;
};

export const normalizeCurrencyCode = (
  currency: string | undefined,
  issues: ValidationIssue[],
  field = "baseCurrency"
) => {
  const normalized = currency?.trim().toUpperCase();
  if (!normalized) {
    return defaultCurrency;
  }
  if (!/^[A-Z]{3}$/.test(normalized)) {
    issues.push({
      code: "invalid-currency",
      field,
      message: `${field} must be an ISO 4217 currency code.`,
    });
    return defaultCurrency;
  }
  return normalized;
};

export const normalizeMonthOrNull = (
  month: string | null | undefined,
  field: string,
  issues: ValidationIssue[]
): string | null => {
  if (!month) {
    return null;
  }
  if (!isValidMonthKey(month)) {
    issues.push({
      code: "invalid-month",
      field,
      message: `${field} has invalid month ${month}.`,
    });
    return null;
  }
  return month;
};

const validateDraftMonths = (draft: ScenarioDraft, issues: ValidationIssue[]) => {
  const baseMonth = normalizeMonthOrNull(
    draft.assumptions?.baseMonth,
    "assumptions.baseMonth",
    issues
  );
  if (!baseMonth) {
    issues.push({
      code: "required",
      field: "assumptions.baseMonth",
      message: "assumptions.baseMonth is required.",
    });
  }

  (draft.members ?? []).forEach((member, index) => {
    if (member.birthMonth) {
      normalizeMonthOrNull(member.birthMonth, `members.${index}.birthMonth`, issues);
    }
  });

  const collections = [
    { key: "assets", items: draft.assets ?? [] },
    { key: "liabilities", items: draft.liabilities ?? [] },
    { key: "events", items: draft.events ?? [] },
  ] as const;

  collections.forEach(({ key, items }) => {
    items.forEach((item, index) => {
      Object.entries(item as Record<string, unknown>).forEach(([field, value]) => {
        if (!MONTH_FIELD_PATTERN.test(field) || typeof value !== "string") {
          return;
        }
        normalizeMonthOrNull(value, `${key}.${index}.${field}`, issues);
      });
    });
  });
};

export const validateAndNormalizeScenarioDraft = (draft: ScenarioDraft) => {
  const issues: ValidationIssue[] = [];
  validateDraftMonths(draft, issues);

  const members = (draft.members ?? []).map((member, index) => ({
    ...member,
    id: normalizeStringId(member.id, `member-${index + 1}`, `members.${index}.id`, issues),
  }));
  const assets = (draft.assets ?? []).map((asset, index) => ({
    ...asset,
    id: normalizeStringId(asset.id, `asset-${index + 1}`, `assets.${index}.id`, issues),
    currency: normalizeCurrencyCode(asset.currency, issues, `assets.${index}.currency`),
  }));
  const liabilities = (draft.liabilities ?? []).map((liability, index) => ({
    ...liability,
    id: normalizeStringId(
      liability.id,
      `liability-${index + 1}`,
      `liabilities.${index}.id`,
      issues
    ),
  }));
  const events = (draft.events ?? []).map((event, index) => ({
    ...event,
    id: normalizeStringId(event.id, `event-${index + 1}`, `events.${index}.id`, issues),
  }));

  return {
    normalizedDraft: {
      ...draft,
      members,
      assets,
      liabilities,
      events,
      baseCurrency: normalizeCurrencyCode(draft.baseCurrency, issues),
    },
    issues,
  };
};
