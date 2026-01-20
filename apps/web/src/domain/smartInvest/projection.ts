import type { ProjectionResult } from "@north-star/engine";
import type { PositionCashflowEntry } from "../positions/cashflowBreakdown";
import type { ValueTableRow } from "../positions/investmentValueTable";
import type { SmartInvestAllocation } from "./types";

export type SmartInvestProjectionBreakdown = {
  cashflowEntries: PositionCashflowEntry[];
  cashflowSeries: Array<{ month: string; amount: number }>;
  valueRows: ValueTableRow[];
  totalValueSeries: Array<{ month: string; value: number }>;
  bucketSeries: Array<{
    bucketId: string;
    bucketName: string;
    series: Array<{ month: string; value: number }>;
  }>;
  currentBucketValues: Array<{ bucketId: string; bucketName: string; value: number }>;
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

const buildAllocationNameLookup = (allocations?: SmartInvestAllocation[]) => {
  if (!allocations) {
    return new Map<string, string>();
  }
  return new Map(allocations.map((allocation) => [allocation.id, allocation.name]));
};

const parseSmartInvestKey = (key: string) => {
  if (!key.startsWith(smartInvestPrefix)) {
    return null;
  }
  const trimmed = key.replace(smartInvestPrefix, "");
  const [bucketId, suffix] = trimmed.split(":");
  if (!bucketId) {
    return null;
  }
  return { bucketId, suffix };
};

export const buildSmartInvestProjectionBreakdown = (
  projection: ProjectionResult,
  allocations?: SmartInvestAllocation[]
): SmartInvestProjectionBreakdown => {
  const entries: PositionCashflowEntry[] = [];
  const cashflow = projection.breakdown?.cashflow.byKey ?? {};
  const assetsByKey = projection.breakdown?.assets.assetsByKey ?? {};
  const months = projection.months;
  const allocationNameLookup = buildAllocationNameLookup(allocations);
  const monthTotals = new Map<
    string,
    { contribution: number; withdrawal: number }
  >();
  const bucketIds = new Set<string>();

  Object.entries(cashflow).forEach(([key, series]) => {
    const parsed = parseSmartInvestKey(key);
    if (!parsed) {
      return;
    }
    bucketIds.add(parsed.bucketId);
    const label = parsed.suffix === "withdrawal" ? "withdrawal" : "contribution";
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
      entries.push({
        month,
        amount,
        label,
        sourceId: `smartInvest:${label}`,
        bucketId: parsed.bucketId,
        bucketName:
          allocationNameLookup.get(parsed.bucketId) ?? parsed.bucketId,
      });
    });
  });

  allocations?.forEach((allocation) => bucketIds.add(allocation.id));
  Object.keys(assetsByKey).forEach((key) => {
    const parsed = parseSmartInvestKey(key);
    if (!parsed || parsed.suffix) {
      return;
    }
    bucketIds.add(parsed.bucketId);
  });

  const valueRows: ValueTableRow[] = [];
  const totalValueSeries: Array<{ month: string; value: number }> = [];
  let previousValue = 0;
  let totalContributed = 0;

  const bucketSeries = Array.from(bucketIds).map((bucketId) => {
    const series = assetsByKey[`${smartInvestPrefix}${bucketId}`] ?? [];
    return {
      bucketId,
      bucketName: allocationNameLookup.get(bucketId) ?? bucketId,
      series: months.map((month, index) => ({
        month,
        value: series[index] ?? 0,
      })),
    };
  });

  months.forEach((month, index) => {
    const endValue = bucketSeries.reduce(
      (sum, bucket) => sum + (bucket.series[index]?.value ?? 0),
      0
    );
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
    totalValueSeries.push({ month, value: endValue });
  });

  return {
    cashflowEntries: entries,
    cashflowSeries: buildSeries(entries),
    valueRows,
    totalValueSeries,
    bucketSeries,
    currentBucketValues: bucketSeries.map((bucket) => ({
      bucketId: bucket.bucketId,
      bucketName: bucket.bucketName,
      value: bucket.series[bucket.series.length - 1]?.value ?? 0,
    })),
  };
};
