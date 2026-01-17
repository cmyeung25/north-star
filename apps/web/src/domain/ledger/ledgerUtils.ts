import type { CashflowItem } from "./types";

export type LedgerMonthSummary = {
  total: number;
  bySource: {
    budget: number;
    event: number;
    other: number;
  };
  byCategory: Record<string, number>;
};

export const groupLedgerByMonth = (
  ledger: CashflowItem[]
): Record<string, CashflowItem[]> =>
  ledger.reduce<Record<string, CashflowItem[]>>((acc, entry) => {
    if (!acc[entry.month]) {
      acc[entry.month] = [];
    }
    acc[entry.month].push(entry);
    return acc;
  }, {});

const resolveSourceBucket = (source: CashflowItem["source"]) => {
  if (source === "budget") {
    return "budget";
  }
  if (source === "event") {
    return "event";
  }
  return "other";
};

export const summarizeMonth = (items: CashflowItem[]): LedgerMonthSummary => {
  const summary: LedgerMonthSummary = {
    total: 0,
    bySource: {
      budget: 0,
      event: 0,
      other: 0,
    },
    byCategory: {},
  };

  items.forEach((item) => {
    const bucket = resolveSourceBucket(item.source);
    summary.total += item.amount;
    summary.bySource[bucket] += item.amount;

    const categoryKey = item.category ?? item.label ?? "uncategorized";
    summary.byCategory[categoryKey] =
      (summary.byCategory[categoryKey] ?? 0) + item.amount;
  });

  return summary;
};
