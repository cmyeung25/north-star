import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import type { LedgerRow } from "../../engine/scenarioV2Compiler";

export type BundleMonthlyBreakdownItem = {
  id: string;
  label: string;
  amount: number;
  direction: "income" | "expense";
  sourceEventId: string;
};

export type BundleMonthlySummary = {
  month: string | null;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNet: number;
  breakdown: BundleMonthlyBreakdownItem[];
};

type BundleMonthlySummaryLabels = {
  mortgagePayment: string;
  rentalIncome: string;
  holdingCost: string;
  fallback: string;
};

const resolveBundleRowDirection = (row: LedgerRow): "income" | "expense" => {
  if (row.kind === "income") {
    return "income";
  }
  if (row.kind === "expense") {
    return "expense";
  }
  return row.amount >= 0 ? "income" : "expense";
};

const resolveBundleRowLabel = (
  event: ScenarioEvent,
  row: LedgerRow,
  direction: "income" | "expense",
  labels: BundleMonthlySummaryLabels
): string => {
  if (event.type === "housing" && event.kind === "mortgage") {
    if (direction === "income") {
      return labels.rentalIncome;
    }
    if (row.linkedLiabilityId) {
      return labels.mortgagePayment;
    }
    return row.label ?? labels.holdingCost;
  }
  return row.label ?? event.label ?? labels.fallback;
};

export const computeBundleMonthlySummary = (
  bundleEvents: ScenarioEvent[],
  ledgerRowsByEventId: Map<string, LedgerRow[]>,
  monthKey: string | null,
  labels: BundleMonthlySummaryLabels
): BundleMonthlySummary => {
  if (!monthKey) {
    return {
      month: null,
      monthlyIncome: 0,
      monthlyExpense: 0,
      monthlyNet: 0,
      breakdown: [],
    };
  }

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  const breakdownByKey = new Map<string, BundleMonthlyBreakdownItem>();
  const breakdownOrder: string[] = [];

  bundleEvents.forEach((event) => {
    const rows = ledgerRowsByEventId.get(event.id) ?? [];
    rows
      .filter((row) => row.month === monthKey)
      .forEach((row) => {
        const amount = Math.abs(row.amount);
        if (!amount) {
          return;
        }
        const direction = resolveBundleRowDirection(row);
        const label = resolveBundleRowLabel(event, row, direction, labels);
        const key = `${direction}:${label}`;
        const existing = breakdownByKey.get(key);
        if (existing) {
          existing.amount += amount;
        } else {
          breakdownByKey.set(key, {
            id: `${event.id}-${direction}-${breakdownByKey.size}`,
            label,
            amount,
            direction,
            sourceEventId: event.id,
          });
          breakdownOrder.push(key);
        }
        if (direction === "income") {
          monthlyIncome += amount;
        } else {
          monthlyExpense += amount;
        }
      });
  });

  const breakdown = breakdownOrder
    .map((key) => breakdownByKey.get(key))
    .filter((item): item is BundleMonthlyBreakdownItem => Boolean(item));

  return {
    month: monthKey,
    monthlyIncome,
    monthlyExpense,
    monthlyNet: monthlyIncome - monthlyExpense,
    breakdown,
  };
};
