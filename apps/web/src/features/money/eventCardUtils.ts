import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import type { LedgerRow } from "../../engine/scenarioV2Compiler";
import { compareMonthKey } from "../../utils/monthKey";

export type EventMonthlyImpact = {
  income: number;
  expense: number;
  net: number;
  month: string | null;
};

export const resolveEventCardAmount = (event: ScenarioEvent): number | null => {
  switch (event.type) {
    case "cashflow":
      return event.amount ?? null;
    case "adjustment":
      return event.amount ?? null;
    case "housing":
      return event.kind === "rent"
        ? event.rentMonthly ?? null
        : event.mortgagePayment ?? null;
    case "loan":
      return event.monthlyPayment ?? null;
    case "insurance":
      if (event.mode === "quick") {
        return event.premiumMonthly ?? null;
      }
      return (event.policies ?? []).reduce((total, policy) => {
        return total + (policy.premiumMonthly ?? 0);
      }, 0);
    default:
      return null;
  }
};

export const resolveEventMonthlyImpact = (
  rows: LedgerRow[],
  anchorMonth?: string | null
): EventMonthlyImpact | null => {
  if (!rows || rows.length === 0) {
    return null;
  }
  const months = Array.from(new Set(rows.map((row) => row.month).filter(Boolean))).sort(compareMonthKey);
  if (months.length === 0) {
    return null;
  }

  let targetMonth: string | null = months[months.length - 1] ?? null;
  if (anchorMonth) {
    const exact = months.find((month) => month === anchorMonth);
    if (exact) {
      targetMonth = exact;
    } else {
      const onOrBefore = [...months].reverse().find((month) => compareMonthKey(month, anchorMonth) <= 0);
      targetMonth = onOrBefore ?? (months[0] ?? null);
    }
  }

  if (!targetMonth) {
    return null;
  }

  const totals = rows
    .filter((row) => row.month === targetMonth)
    .reduce(
      (acc, row) => {
        if (row.kind === "income" || (!row.kind && row.amount >= 0)) {
          acc.income += Math.abs(row.amount);
        } else {
          acc.expense += Math.abs(row.amount);
        }
        return acc;
      },
      { income: 0, expense: 0 }
    );
  return {
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
    month: targetMonth,
  };
};

export const resolveEventCardStartMonth = (event: ScenarioEvent): string | null => {
  switch (event.type) {
    case "cashflow":
      return event.cadence === "oneOff"
        ? event.occurrenceMonth ?? null
        : event.startMonth ?? null;
    case "adjustment":
      return event.month ?? null;
    case "housing":
      return event.startMonth ?? null;
    case "loan":
      return event.startMonth ?? null;
    case "insurance":
      if (event.mode === "quick") {
        return event.startMonth ?? null;
      }
      return (event.policies ?? [])
        .map((policy) => policy.startMonth)
        .filter((value): value is string => Boolean(value))
        .sort(compareMonthKey)[0] ?? null;
    default:
      return null;
  }
};

export const resolveEventCardEndMonth = (event: ScenarioEvent): string | null => {
  switch (event.type) {
    case "cashflow":
      return event.cadence === "oneOff"
        ? event.occurrenceMonth ?? null
        : event.endMonth ?? null;
    case "adjustment":
      return event.month ?? null;
    case "housing":
      return event.endMonth ?? null;
    case "loan":
      return null;
    case "insurance":
      if (event.mode === "quick") {
        return event.endMonth ?? null;
      }
      return (event.policies ?? [])
        .map((policy) => policy.endMonth)
        .filter((value): value is string => Boolean(value))
        .sort(compareMonthKey)
        .at(-1) ?? null;
    default:
      return null;
  }
};

export const resolveLedgerDirection = (rows: LedgerRow[]) => {
  const hasIncome = rows.some(
    (row) => row.kind === "income" || (!row.kind && row.amount > 0)
  );
  const hasExpense = rows.some(
    (row) => row.kind === "expense" || (!row.kind && row.amount < 0)
  );
  return { hasIncome, hasExpense };
};

export const resolveProjectionPreviewRow = (
  rows: LedgerRow[],
  anchorMonth?: string | null
): LedgerRow | undefined => {
  if (rows.length === 0) {
    return undefined;
  }
  const sortedRows = [...rows].sort((left, right) => compareMonthKey(left.month, right.month));
  return (
    sortedRows.find((row) => (anchorMonth ? row.month === anchorMonth : false)) ??
    sortedRows.find((row) => (anchorMonth ? compareMonthKey(row.month, anchorMonth) <= 0 : false)) ??
    sortedRows[0]
  );
};

export const resolveDisplayMonths = (params: {
  startMonth: string | null;
  endMonth: string | null;
  groupStartMonth?: string | null;
  groupEndMonth?: string | null;
  hasAdjustments: boolean;
}) => {
  const { startMonth, endMonth, groupStartMonth, groupEndMonth, hasAdjustments } = params;
  return {
    startMonth: hasAdjustments ? (groupStartMonth ?? startMonth) : startMonth,
    endMonth: hasAdjustments ? (groupEndMonth ?? endMonth) : endMonth,
  };
};

export const resolveAdjustmentSummary = (params: {
  adjustments: ScenarioEvent[];
  resolveAmount: (event: ScenarioEvent) => number;
}) => {
  const { adjustments, resolveAmount } = params;
  const latestAdjustment = adjustments.at(-1);
  if (!latestAdjustment) {
    return null;
  }
  return {
    count: adjustments.length,
    month: resolveEventCardStartMonth(latestAdjustment),
    amount: Math.abs(resolveAmount(latestAdjustment)),
  };
};

export const filterEventsByLedgerImpact = (
  events: ScenarioEvent[],
  ledgerRowsByEventId: Map<string, LedgerRow[]>,
  direction: "income" | "expense"
) =>
  events.filter((event) => {
    const rows = ledgerRowsByEventId.get(event.id) ?? [];
    const { hasIncome, hasExpense } = resolveLedgerDirection(rows);
    return direction === "income" ? hasIncome : hasExpense;
  });
