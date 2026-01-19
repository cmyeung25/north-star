import type { ProjectionResult } from "@north-star/engine";
import type { PositionCashflowEntry } from "../positions/cashflowBreakdown";
import type { ValueTableRow } from "../positions/investmentValueTable";

export type SmartInvestProjectionBreakdown = {
  cashflowEntries: PositionCashflowEntry[];
  cashflowSeries: Array<{ month: string; amount: number }>;
  valueRows: ValueTableRow[];
};

const smartInvestPrefix = "investment:smart-invest-";

const buildSeries = (entries: PositionCashflowEntry[]) => {
  const totals = new Map<string, number>();
  entries.forEach((entry) => {
    totals.set(entry.month, (totals.get(entry.month) ?? 0) + entry.amount);
  });
  return Array.from(totals.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, amount]) => ({ month, amount }));
};

export const buildSmartInvestProjectionBreakdown = (
  projection: ProjectionResult
): SmartInvestProjectionBreakdown => {
  const entries: PositionCashflowEntry[] = [];
  const cashflow = projection.breakdown?.cashflow.byKey ?? {};
  const assetsByKey = projection.breakdown?.assets.assetsByKey ?? {};
  const months = projection.months;
  const monthTotals = new Map<
    string,
    { contribution: number; withdrawal: number }
  >();

  Object.entries(cashflow).forEach(([key, series]) => {
    if (!key.startsWith(smartInvestPrefix)) {
      return;
    }
    const label = key.endsWith(":withdrawal") ? "withdrawal" : "contribution";
    series.forEach((amount, index) => {
      if (!amount) {
        return;
      }
      const month = months[index];
      if (!month) {
        return;
      }
      const bucket =
        monthTotals.get(month) ?? { contribution: 0, withdrawal: 0 };
      if (label === "withdrawal") {
        bucket.withdrawal += amount;
      } else {
        bucket.contribution += amount;
      }
      monthTotals.set(month, bucket);
    });
  });

  Array.from(monthTotals.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .forEach(([month, totals]) => {
      if (totals.contribution) {
        entries.push({
          month,
          amount: totals.contribution,
          label: "contribution",
          sourceId: "smartInvest:contribution",
        });
      }
      if (totals.withdrawal) {
        entries.push({
          month,
          amount: totals.withdrawal,
          label: "withdrawal",
          sourceId: "smartInvest:withdrawal",
        });
      }
    });

  const valueRows: ValueTableRow[] = [];
  let previousValue = 0;
  let totalContributed = 0;

  months.forEach((month, index) => {
    const endValue = Object.entries(assetsByKey).reduce((sum, [key, series]) => {
      if (!key.startsWith(smartInvestPrefix)) {
        return sum;
      }
      return sum + (series[index] ?? 0);
    }, 0);
    const totals = monthTotals.get(month) ?? { contribution: 0, withdrawal: 0 };
    const contribution = Math.max(0, -totals.contribution);
    const withdrawal = Math.max(0, totals.withdrawal);
    const netContribution = contribution - withdrawal;
    const growth = endValue - previousValue - netContribution;
    totalContributed += contribution;
    valueRows.push({
      month,
      contribution,
      growth,
      endValue,
      totalContributed,
    });
    previousValue = endValue;
  });

  return {
    cashflowEntries: entries,
    cashflowSeries: buildSeries(entries),
    valueRows,
  };
};
