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
  rows: LedgerRow[]
): EventMonthlyImpact | null => {
  if (!rows || rows.length === 0) {
    return null;
  }
  const latestMonth = rows.reduce<string | null>((current, row) => {
    if (!row.month) {
      return current;
    }
    if (!current) {
      return row.month;
    }
    return compareMonthKey(row.month, current) > 0 ? row.month : current;
  }, null);
  if (!latestMonth) {
    return null;
  }
  const totals = rows
    .filter((row) => row.month === latestMonth)
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
    month: latestMonth,
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
