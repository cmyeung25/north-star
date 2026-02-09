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
  startMonthOneOffIncome: number;
  startMonthOneOffExpense: number;
  startMonthNet: number;
  breakdown: BundleMonthlyBreakdownItem[];
  oneOffBreakdown: BundleMonthlyBreakdownItem[];
};

export type BundleCashflowSummary = BundleMonthlySummary & {
  oneOffTotal: number;
  hasMonthlyImpact: boolean;
  hasStartMonthOneOffImpact: boolean;
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
      startMonthOneOffIncome: 0,
      startMonthOneOffExpense: 0,
      startMonthNet: 0,
      breakdown: [],
      oneOffBreakdown: [],
    };
  }

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  let startMonthOneOffIncome = 0;
  let startMonthOneOffExpense = 0;
  const breakdownByKey = new Map<string, BundleMonthlyBreakdownItem>();
  const oneOffBreakdownByKey = new Map<string, BundleMonthlyBreakdownItem>();
  const breakdownOrder: string[] = [];
  const oneOffBreakdownOrder: string[] = [];

  const isRecurringMonthlyEvent = (event: ScenarioEvent): boolean => {
    if (event.type === "cashflow") {
      return (
        event.cadence === "monthly" ||
        (event.cadence === "everyNMonths" && event.everyNMonths === 1)
      );
    }
    if (event.type === "adjustment") {
      return false;
    }
    return true;
  };

  const isHousingOneOffFee = (event: ScenarioEvent, row: LedgerRow): boolean => {
    if (event.type !== "housing" || event.kind !== "mortgage") {
      return false;
    }
    if (!event.feesOneOff || event.feesOneOff.length === 0) {
      return false;
    }
    const rowLabel = (row.label ?? event.label ?? "").trim();
    return event.feesOneOff.some((fee) => {
      const feeLabel = (fee.label ?? event.label ?? "").trim();
      const normalizedRowLabel = rowLabel.toLowerCase();
      const normalizedFeeLabel = feeLabel.toLowerCase();
      return (
        fee.month === row.month &&
        Math.abs(fee.amount) === Math.abs(row.amount) &&
        (!normalizedFeeLabel ||
          !normalizedRowLabel ||
          normalizedFeeLabel === normalizedRowLabel ||
          normalizedRowLabel.includes(normalizedFeeLabel) ||
          normalizedFeeLabel.includes(normalizedRowLabel))
      );
    });
  };

  const isOneOffRow = (event: ScenarioEvent, row: LedgerRow): boolean => {
    if (event.type === "cashflow") {
      return event.cadence === "oneOff";
    }
    if (event.type === "adjustment") {
      return true;
    }
    if (event.type === "housing" && event.kind === "mortgage") {
      return isHousingOneOffFee(event, row);
    }
    return false;
  };

  const addBreakdownItem = (
    target: Map<string, BundleMonthlyBreakdownItem>,
    order: string[],
    item: Omit<BundleMonthlyBreakdownItem, "id">,
    indexSeed: number
  ) => {
    const key = `${item.direction}:${item.label}`;
    const existing = target.get(key);
    if (existing) {
      existing.amount += item.amount;
      return;
    }
    target.set(key, {
      ...item,
      id: `${item.sourceEventId}-${item.direction}-${indexSeed}`,
    });
    order.push(key);
  };

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
        const isOneOff = isOneOffRow(event, row);
        if (isOneOff) {
          addBreakdownItem(
            oneOffBreakdownByKey,
            oneOffBreakdownOrder,
            {
              label,
              amount,
              direction,
              sourceEventId: event.id,
            },
            oneOffBreakdownByKey.size
          );
          if (direction === "income") {
            startMonthOneOffIncome += amount;
          } else {
            startMonthOneOffExpense += amount;
          }
          return;
        }

        if (!isRecurringMonthlyEvent(event)) {
          return;
        }

        addBreakdownItem(
          breakdownByKey,
          breakdownOrder,
          {
            label,
            amount,
            direction,
            sourceEventId: event.id,
          },
          breakdownByKey.size
        );
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
  const oneOffBreakdown = oneOffBreakdownOrder
    .map((key) => oneOffBreakdownByKey.get(key))
    .filter((item): item is BundleMonthlyBreakdownItem => Boolean(item));

  return {
    month: monthKey,
    monthlyIncome,
    monthlyExpense,
    monthlyNet: monthlyIncome - monthlyExpense,
    startMonthOneOffIncome,
    startMonthOneOffExpense,
    startMonthNet:
      monthlyIncome -
      monthlyExpense +
      startMonthOneOffIncome -
      startMonthOneOffExpense,
    breakdown,
    oneOffBreakdown,
  };
};

export const computeBundleCashflowSummary = (
  bundleEvents: ScenarioEvent[],
  ledgerRowsByEventId: Map<string, LedgerRow[]>,
  monthKey: string | null,
  labels: BundleMonthlySummaryLabels
): BundleCashflowSummary => {
  const monthlySummary = computeBundleMonthlySummary(
    bundleEvents,
    ledgerRowsByEventId,
    monthKey,
    labels
  );
  const oneOffTotal = bundleEvents.reduce((total, event) => {
    if (
      event.type === "cashflow" &&
      event.cadence === "oneOff" &&
      event.kind === "expense"
    ) {
      return total + Math.abs(event.amount);
    }
    if (event.type === "housing" && event.kind === "mortgage") {
      const feeTotal =
        event.feesOneOff?.reduce((sum, fee) => sum + Math.abs(fee.amount), 0) ?? 0;
      return total + feeTotal;
    }
    return total;
  }, 0);
  const hasMonthlyImpact =
    monthlySummary.monthlyIncome > 0 || monthlySummary.monthlyExpense > 0;
  const hasStartMonthOneOffImpact =
    monthlySummary.startMonthOneOffIncome > 0 ||
    monthlySummary.startMonthOneOffExpense > 0;
  return {
    ...monthlySummary,
    oneOffTotal,
    hasMonthlyImpact,
    hasStartMonthOneOffImpact,
  };
};
