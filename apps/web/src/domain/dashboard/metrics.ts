import type { ProjectionResult } from "@north-star/engine";
import type { CashflowItem } from "../ledger/types";
import { normalizeMonthStrict } from "../../utils/month";

export type DashboardMetrics = {
  minCash12m: { month: string; value: number } | null;
  avgNetCashflow12m: number | null;
  deficitMonthsCount12m: number;
  cashRunwayMonths: number | null;
  firstMillionMonth: string | null;
  avgNonSalaryIncome12m: number | null;
  avgFunBudget12m: number | null;
  riskLevel: "green" | "red";
};

const EMPTY_METRICS: DashboardMetrics = {
  minCash12m: null,
  avgNetCashflow12m: null,
  deficitMonthsCount12m: 0,
  cashRunwayMonths: null,
  firstMillionMonth: null,
  avgNonSalaryIncome12m: null,
  avgFunBudget12m: null,
  riskLevel: "green",
};

const isSalaryEntry = (item: CashflowItem) => {
  const text = `${item.sourceId} ${item.label ?? ""} ${item.category ?? ""}`.toLowerCase();
  return text.includes("salary");
};

const average = (values: number[]) => {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const computeDashboardMetrics = (
  projection: ProjectionResult | null,
  projectionNetCashflowByMonth: Record<string, number>,
  ledgerByMonth: Record<string, CashflowItem[]>
): DashboardMetrics => {
  if (!projection || projection.months.length === 0) {
    return EMPTY_METRICS;
  }

  const horizonMonths = projection.months
    .map((month) => normalizeMonthStrict(month))
    .filter((normalized): normalized is { ok: true; month: string } => normalized.ok)
    .slice(0, 12)
    .map((normalized) => normalized.month);

  if (horizonMonths.length === 0) {
    return EMPTY_METRICS;
  }

  const cashPoints = horizonMonths.map((month) => {
    const monthIndex = projection.months.indexOf(month);
    return {
      month,
      value: projection.cashBalance[monthIndex] ?? 0,
    };
  });
  const minCash12m = cashPoints.reduce<{ month: string; value: number } | null>((current, point) => {
    if (!current || point.value < current.value) {
      return point;
    }
    return current;
  }, null);

  const netCashflows12m = horizonMonths.map(
    (month) => projectionNetCashflowByMonth[month] ?? 0
  );
  const avgNetCashflow12m = average(netCashflows12m);
  const deficitMonthsCount12m = netCashflows12m.filter((value) => value < 0).length;

  const monthlyExpenses = horizonMonths.map((month) => {
    const items = ledgerByMonth[month] ?? [];
    return items
      .filter((item) => item.amount < 0)
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  });
  const avgExpense12m = average(monthlyExpenses);
  const currentCash = projection.cashBalance[0] ?? 0;
  const cashRunwayMonths = avgExpense12m && avgExpense12m > 0 ? currentCash / avgExpense12m : null;

  const firstMillionMonth = (() => {
    for (let index = 0; index < horizonMonths.length; index += 1) {
      const month = horizonMonths[index];
      const monthIndex = projection.months.indexOf(month);
      const netWorth = projection.netWorth[monthIndex] ?? 0;
      if (netWorth >= 1_000_000) {
        return month;
      }
    }
    return null;
  })();

  const nonSalaryIncomeByMonth = horizonMonths.map((month) => {
    const items = ledgerByMonth[month] ?? [];
    return items
      .filter((item) => item.amount > 0 && !isSalaryEntry(item))
      .reduce((sum, item) => sum + item.amount, 0);
  });
  const avgNonSalaryIncome12m = average(nonSalaryIncomeByMonth);

  const avgFunBudget12m = avgNetCashflow12m;
  const riskLevel = (minCash12m?.value ?? 0) < 0 || (cashRunwayMonths !== null && cashRunwayMonths < 6)
    ? "red"
    : "green";

  return {
    minCash12m,
    avgNetCashflow12m,
    deficitMonthsCount12m,
    cashRunwayMonths,
    firstMillionMonth,
    avgNonSalaryIncome12m,
    avgFunBudget12m,
    riskLevel,
  };
};
