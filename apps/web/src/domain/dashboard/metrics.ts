import type { ProjectionResult } from "@north-star/engine";
import type { CashflowItem } from "../ledger/types";
import { normalizeMonthStrict } from "../../utils/month";
import { computeIncomeCoverageRatios } from "../kpis/incomeCoverage";

export type DashboardMetrics = {
  minCash12m: { month: string; value: number } | null;
  avgNetCashflow12m: number | null;
  deficitMonthsCount12m: number;
  cashRunwayMonths: number | null;
  firstMillionMonth: string | null;
  avgNonSalaryIncome12m: number | null;
  nonSalaryIncomeRatio: number | null;
  passiveIncomeCoverage: number | null;
  assetLinkedExpenseRatio: number | null;
  avgFunBudget12m: number | null;
  savingsRate12m: number | null;
  expenseToIncomeRatio12m: number | null;
  debtToAssetRatio: number | null;
  netWorthGrowth12m: number | null;
  riskLevel: "green" | "red";
  endMonth: string | null;
};

const EMPTY_METRICS: DashboardMetrics = {
  minCash12m: null,
  avgNetCashflow12m: null,
  deficitMonthsCount12m: 0,
  cashRunwayMonths: null,
  firstMillionMonth: null,
  avgNonSalaryIncome12m: null,
  nonSalaryIncomeRatio: null,
  passiveIncomeCoverage: null,
  assetLinkedExpenseRatio: null,
  avgFunBudget12m: null,
  savingsRate12m: null,
  expenseToIncomeRatio12m: null,
  debtToAssetRatio: null,
  netWorthGrowth12m: null,
  riskLevel: "green",
  endMonth: null,
};

const hasOwn = (target: object, key: string) =>
  Object.prototype.hasOwnProperty.call(target, key);

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

  const hasCompleteNetCashflow = horizonMonths.every((month) =>
    hasOwn(projectionNetCashflowByMonth, month)
  );
  const netCashflows12m = hasCompleteNetCashflow
    ? horizonMonths.map((month) => projectionNetCashflowByMonth[month] ?? 0)
    : [];
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
    for (let index = 0; index < projection.months.length; index += 1) {
      const month = projection.months[index];
      const netWorth = projection.netWorth[index] ?? 0;
      if (netWorth >= 1_000_000) {
        return month;
      }
    }
    return null;
  })();

  const hasCompleteLedger = horizonMonths.every((month) => hasOwn(ledgerByMonth, month));
  const nonSalaryIncomeByMonth = hasCompleteLedger
    ? horizonMonths.map((month) => {
        const items = ledgerByMonth[month] ?? [];
        return items
          .filter((item) => item.amount > 0 && !isSalaryEntry(item))
          .reduce((sum, item) => sum + item.amount, 0);
      })
    : [];
  const avgNonSalaryIncome12m = average(nonSalaryIncomeByMonth);
  const incomeCoverageRatios = computeIncomeCoverageRatios(horizonMonths, ledgerByMonth);

  const avgFunBudget12m = avgNetCashflow12m;

  const totalNetCashflow12m = hasCompleteNetCashflow
    ? horizonMonths.reduce((sum, month) => sum + (projectionNetCashflowByMonth[month] ?? 0), 0)
    : null;
  const totalIncome12m = hasCompleteLedger
    ? horizonMonths.reduce((sum, month) => {
        const items = ledgerByMonth[month] ?? [];
        return sum + items.filter((item) => item.amount > 0).reduce((acc, item) => acc + item.amount, 0);
      }, 0)
    : null;
  const totalExpense12m = hasCompleteLedger
    ? horizonMonths.reduce((sum, month) => {
        const items = ledgerByMonth[month] ?? [];
        return sum + items.filter((item) => item.amount < 0).reduce((acc, item) => acc + Math.abs(item.amount), 0);
      }, 0)
    : null;

  const savingsRate12m =
    totalNetCashflow12m === null || totalIncome12m === null || totalIncome12m <= 0
      ? null
      : totalNetCashflow12m / totalIncome12m;
  const expenseToIncomeRatio12m =
    totalExpense12m === null || totalIncome12m === null || totalIncome12m <= 0
      ? null
      : totalExpense12m / totalIncome12m;

  const assetsNow = projection.assets?.total?.[0];
  const liabilitiesNow = projection.liabilities?.total?.[0];
  const debtToAssetRatio =
    assetsNow === undefined || liabilitiesNow === undefined || assetsNow <= 0
      ? null
      : liabilitiesNow / assetsNow;

  const startNetWorth = projection.netWorth[0];
  const endingNetWorth = projection.netWorth[Math.min(11, projection.netWorth.length - 1)];
  const netWorthGrowth12m =
    startNetWorth === undefined || endingNetWorth === undefined || startNetWorth === 0
      ? null
      : (endingNetWorth - startNetWorth) / Math.abs(startNetWorth);

  const riskLevel = (minCash12m?.value ?? 0) < 0 || (cashRunwayMonths !== null && cashRunwayMonths < 6)
    ? "red"
    : "green";
  const endMonth = projection.months.at(-1) ?? null;

  return {
    minCash12m,
    avgNetCashflow12m,
    deficitMonthsCount12m,
    cashRunwayMonths,
    firstMillionMonth,
    avgNonSalaryIncome12m,
    nonSalaryIncomeRatio: incomeCoverageRatios.nonSalaryIncomeRatio,
    passiveIncomeCoverage: incomeCoverageRatios.passiveIncomeCoverage,
    assetLinkedExpenseRatio: incomeCoverageRatios.assetLinkedExpenseRatio,
    avgFunBudget12m,
    savingsRate12m,
    expenseToIncomeRatio12m,
    debtToAssetRatio,
    netWorthGrowth12m,
    riskLevel,
    endMonth,
  };
};
