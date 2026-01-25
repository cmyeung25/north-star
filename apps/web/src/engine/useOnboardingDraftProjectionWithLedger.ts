import { useMemo } from "react";
import {
  buildMonthRange,
  computeProjection,
  expandEventToSeries,
  type EngineEvent,
  type HomePosition,
  type ProjectionInput,
  type ProjectionResult,
} from "@north-star/engine";
import type {
  OnboardingDraft,
  OnboardingDraftProjectionSettings,
  OnboardingDraftValidationError,
} from "../domain/onboardingDraft/types";
import { normalizeMonthStrict } from "../utils/month";
import type { CashflowItem } from "../domain/ledger/types";
import {
  groupLedgerByMonth,
  summarizeMonth,
  type LedgerMonthSummary,
} from "../domain/ledger/ledgerUtils";
import { WarningCode, type CompilerWarning } from "../domain/warnings/types";

export type OnboardingDraftProjectionBundle = {
  projection: ProjectionResult | null;
  ledger: CashflowItem[];
  months: string[];
  ledgerByMonth: Record<string, CashflowItem[]>;
  summaryByMonth: Record<string, LedgerMonthSummary>;
  projectionNetCashflowByMonth: Record<string, number>;
  projectionNetCashflowMode: "netCashflow" | "cashDelta";
};

export type OnboardingDraftProjection = {
  baseline: OnboardingDraftProjectionBundle;
  option: OnboardingDraftProjectionBundle;
  errors: OnboardingDraftValidationError[];
  warnings: CompilerWarning[];
};

const emptyBundle: OnboardingDraftProjectionBundle = {
  projection: null,
  ledger: [],
  months: [],
  ledgerByMonth: {},
  summaryByMonth: {},
  projectionNetCashflowByMonth: {},
  projectionNetCashflowMode: "netCashflow",
};

const normalizeNumber = (value: number | null | undefined, fallback = 0) => {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const clampNonNegative = (value: number) => Math.max(0, value);

const buildProjectionNetCashflowByMonth = (
  projection: ProjectionResult,
  initialCash: number
) => {
  if (projection.netCashflow.length > 0) {
    return {
      mode: "netCashflow" as const,
      byMonth: projection.months.reduce<Record<string, number>>(
        (acc, month, index) => {
          acc[month] = projection.netCashflow[index] ?? 0;
          return acc;
        },
        {}
      ),
    };
  }

  return {
    mode: "cashDelta" as const,
    byMonth: projection.months.reduce<Record<string, number>>(
      (acc, month, index) => {
        const current = projection.cashBalance[index] ?? 0;
        const previous = index === 0 ? initialCash : projection.cashBalance[index - 1] ?? 0;
        acc[month] = current - previous;
        return acc;
      },
      {}
    ),
  };
};

const normalizePositionSourceId = (key: string) => {
  const sanitized = key
    .replace(/:down_payment$/, ":downPayment")
    .replace(/:fees_one_time$/, ":feesOneTime")
    .replace(/:holding_cost$/, ":holdingCost")
    .replace(/:mortgage_interest$/, ":mortgageInterest")
    .replace(/:mortgage_principal$/, ":mortgagePrincipal")
    .replace(/:rental_income$/, ":rentalIncome")
    .replace(/:loan_interest$/, ":loanInterest")
    .replace(/:loan_principal$/, ":loanPrincipal")
    .replace(/:interest$/, ":interest")
    .replace(/:principal$/, ":principal")
    .replace(/:premium$/, ":premium")
    .replace(/:contribution$/, ":contribution")
    .replace(/:withdrawal$/, ":withdrawal");
  const parts = sanitized.split(":");
  if (parts.length >= 3) {
    return `${parts[0]}:${parts[parts.length - 1]}`;
  }
  return sanitized;
};

const isPositionCashflowKey = (key: string) =>
  /^(home|car|loan|insurance|investment):/.test(key);

const buildPositionLedger = (projection: ProjectionResult): CashflowItem[] => {
  const breakdown = projection.breakdown?.cashflow.byKey ?? {};
  return Object.entries(breakdown).flatMap(([key, series]) => {
    if (!isPositionCashflowKey(key)) {
      return [];
    }
    const sourceId = normalizePositionSourceId(key);
    return series.flatMap((amount, index) => {
      if (!amount) {
        return [];
      }
      const month = projection.months[index];
      if (!month) {
        return [];
      }
      return [
        {
          month,
          amount,
          source: "position" as const,
          sourceId,
        },
      ];
    });
  });
};

const buildEventLedger = (
  events: EngineEvent[],
  baseMonth: string,
  horizonMonths: number
) => {
  const months = buildMonthRange(baseMonth, horizonMonths);
  return events.flatMap((event, index) => {
    const series = expandEventToSeries(event, baseMonth, horizonMonths);
    const sourceId = event.id ?? `draft-event-${index}`;
    const label = event.type ?? sourceId;
    return series.flatMap((amount, seriesIndex) => {
      if (!amount) {
        return [];
      }
      const month = months[seriesIndex];
      if (!month) {
        return [];
      }
      return [
        {
          month,
          amount,
          source: "event" as const,
          sourceId,
          label,
        },
      ];
    });
  });
};

const buildBundle = (
  input: ProjectionInput,
  initialCash: number
): OnboardingDraftProjectionBundle => {
  const projection = computeProjection(input);
  const eventLedger = buildEventLedger(input.events, input.baseMonth, input.horizonMonths);
  const positionLedger = buildPositionLedger(projection);
  const ledger = [...eventLedger, ...positionLedger];
  const ledgerByMonth = groupLedgerByMonth(ledger);
  const summaryByMonth = Object.entries(ledgerByMonth).reduce<Record<string, LedgerMonthSummary>>(
    (acc, [month, entries]) => {
      acc[month] = summarizeMonth(entries);
      return acc;
    },
    {}
  );
  const netCashflow = buildProjectionNetCashflowByMonth(projection, initialCash);

  return {
    projection,
    ledger,
    months: projection.months,
    ledgerByMonth,
    summaryByMonth,
    projectionNetCashflowByMonth: netCashflow.byMonth,
    projectionNetCashflowMode: netCashflow.mode,
  };
};

const buildNetCashflowEvent = (baseMonth: string, amount: number): EngineEvent => ({
  id: "onboarding-baseline",
  type: "baseline",
  enabled: true,
  startMonth: baseMonth,
  endMonth: null,
  monthlyAmount: amount,
  oneTimeAmount: 0,
  annualGrowthPct: 0,
});

const normalizeMonth = (
  value: string | undefined,
  field: string,
  errors: OnboardingDraftValidationError[],
  warnings: CompilerWarning[]
) => {
  if (!value) {
    return null;
  }
  const normalized = normalizeMonthStrict(value);
  if (!normalized.ok) {
    errors.push({ field, reason: "invalid-month" });
    warnings.push({
      code: WarningCode.MonthInvalid,
      severity: "warning",
      messageKey: "warnings.monthInvalid",
      defaultMessage: `${field} has invalid month ${value}.`,
      refs: { month: value },
      debug: { rawValue: value, reason: normalized.reason },
    });
    return null;
  }
  return normalized.month;
};

const buildHousingPosition = (
  housing: Extract<OnboardingDraft["microPlan"], { kind: "housing" }>["housing"],
  errors: OnboardingDraftValidationError[],
  warnings: CompilerWarning[]
): HomePosition | null => {
  if (housing.kind === "rent") {
    return null;
  }
  const purchaseMonth = normalizeMonth(
    housing.purchaseMonth,
    "housing.purchaseMonth",
    errors,
    warnings
  );
  if (!purchaseMonth) {
    return null;
  }
  const purchasePrice = clampNonNegative(normalizeNumber(housing.purchasePrice));
  const downPaymentAmount =
    typeof housing.downPaymentAmount === "number"
      ? clampNonNegative(normalizeNumber(housing.downPaymentAmount))
      : typeof housing.downPaymentPct === "number"
        ? clampNonNegative(purchasePrice * (normalizeNumber(housing.downPaymentPct) / 100))
        : 0;
  const mortgageRatePct = normalizeNumber(housing.mortgageRatePct, 3.5);
  const termYears = normalizeNumber(housing.termYears, 30);
  const principal = Math.max(0, purchasePrice - downPaymentAmount);

  return {
    id: "onboarding-home",
    usage: "primary",
    mode: "new_purchase",
    purchaseMonth,
    purchasePrice,
    downPayment: downPaymentAmount,
    annualAppreciation: 0,
    mortgage:
      principal > 0 && termYears > 0
        ? {
            principal,
            annualRate: mortgageRatePct / 100,
            termMonths: Math.round(termYears * 12),
          }
        : undefined,
  };
};

const buildOptionEvents = (
  draft: OnboardingDraft,
  baseMonth: string,
  errors: OnboardingDraftValidationError[],
  warnings: CompilerWarning[]
): EngineEvent[] => {
  if (draft.microPlan.kind === "housing") {
    const housing = draft.microPlan.housing;
    if (housing.kind === "rent") {
      const startMonth = normalizeMonth(
        housing.startMonth,
        "housing.startMonth",
        errors,
        warnings
      );
      if (!startMonth) {
        return [];
      }
      const rentMonthly = clampNonNegative(normalizeNumber(housing.monthlyRent));
      return [
        {
          id: "onboarding-rent",
          type: "rent",
          enabled: true,
          startMonth,
          endMonth: null,
          monthlyAmount: rentMonthly * -1,
          oneTimeAmount: 0,
          annualGrowthPct: 0,
        },
      ];
    }
    return [];
  }

  const baby = draft.microPlan.baby;
  const dueMonth = normalizeMonth(baby.dueMonth, "baby.dueMonth", errors, warnings);
  if (!dueMonth) {
    return [];
  }
  const monthlyBudget = clampNonNegative(normalizeNumber(baby.monthlyBudget));
  const oneOffCost = clampNonNegative(normalizeNumber(baby.oneOffCost));
  const events: EngineEvent[] = [];
  if (monthlyBudget > 0) {
    events.push({
      id: "onboarding-baby",
      type: "baby",
      enabled: true,
      startMonth: dueMonth,
      endMonth: null,
      monthlyAmount: monthlyBudget * -1,
      oneTimeAmount: 0,
      annualGrowthPct: 0,
    });
  }
  if (oneOffCost > 0) {
    events.push({
      id: "onboarding-baby-one-off",
      type: "baby",
      enabled: true,
      startMonth: dueMonth,
      endMonth: dueMonth,
      monthlyAmount: 0,
      oneTimeAmount: oneOffCost * -1,
      annualGrowthPct: 0,
    });
  }
  return events;
};

export const useOnboardingDraftProjectionWithLedger = (
  draft: OnboardingDraft | null | undefined,
  settings: OnboardingDraftProjectionSettings
): OnboardingDraftProjection =>
  useMemo(() => {
    if (!draft) {
      return { baseline: emptyBundle, option: emptyBundle, errors: [], warnings: [] };
    }

    const errors: OnboardingDraftValidationError[] = [];
    const warnings: CompilerWarning[] = [];
    const baseMonthNormalized = normalizeMonthStrict(settings.baseMonth);
    if (!baseMonthNormalized.ok) {
      return {
        baseline: emptyBundle,
        option: emptyBundle,
        errors: [{ field: "baseMonth", reason: "invalid-month" }],
        warnings: [
          {
            code: WarningCode.MonthInvalid,
            severity: "warning",
            messageKey: "warnings.monthInvalid",
            defaultMessage: `baseMonth has invalid month ${settings.baseMonth}.`,
            refs: { month: settings.baseMonth },
            debug: { rawValue: settings.baseMonth, reason: baseMonthNormalized.reason },
          },
        ],
      };
    }

    const baseMonth = baseMonthNormalized.month;
    const horizonMonths = Math.max(1, Math.round(settings.horizonMonths));
    const monthlyIncome = clampNonNegative(
      normalizeNumber(draft.baseline.monthlyIncomeTotal)
    );
    const monthlyExpense = clampNonNegative(
      normalizeNumber(draft.baseline.monthlyExpenseTotal)
    );
    const initialCash = normalizeNumber(draft.baseline.initialCash, 0);
    const netMonthly = monthlyIncome - monthlyExpense;

    const baselineInput: ProjectionInput = {
      baseMonth,
      horizonMonths,
      initialCash,
      events: [buildNetCashflowEvent(baseMonth, netMonthly)],
    };

    const baselineBundle = buildBundle(baselineInput, initialCash);

    const optionEvents = buildOptionEvents(draft, baseMonth, errors, warnings);
    const optionInput: ProjectionInput = {
      baseMonth,
      horizonMonths,
      initialCash,
      events: [...baselineInput.events, ...optionEvents],
    };

    if (draft.microPlan.kind === "housing" && draft.microPlan.housing.kind === "buy") {
      const home = buildHousingPosition(draft.microPlan.housing, errors, warnings);
      if (home) {
        optionInput.positions = { homes: [home] };
      }
    }

    if (errors.length > 0) {
      return { baseline: baselineBundle, option: emptyBundle, errors, warnings };
    }

    const optionBundle = buildBundle(optionInput, initialCash);
    return { baseline: baselineBundle, option: optionBundle, errors, warnings };
  }, [draft, settings.baseMonth, settings.horizonMonths]);
