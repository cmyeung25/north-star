import type { ProjectionResult } from "@north-star/engine";
import type { CashflowItem } from "../ledger/types";
import type { FamilyLaunchDraft } from "./types";
import { resolveMonthInList } from "../../utils/month";

export type FamilyLaunchScorecardStatus = "green" | "yellow" | "red";

export type FamilyLaunchScorecard = {
  status: FamilyLaunchScorecardStatus;
  minCash: { value: number; month: string | null };
  windowMinCash: {
    value: number;
    month: string | null;
    details: Array<{ label: string; value: number; month: string | null }>;
  };
  topRiskMonths: Array<{ month: string; value: number; flags: string[] }>;
  buffer: {
    threshold: number | null;
    recommended: number | null;
  };
  missingInputs: string[];
};

const buildCashSeries = (projection: ProjectionResult) =>
  projection.months.map((month, index) => ({
    month,
    value: projection.cashBalance[index] ?? 0,
  }));

const findMinInWindow = (
  series: Array<{ month: string; value: number }>,
  centerMonth: string,
  windowMonths: number
) => {
  if (series.length === 0) {
    return { value: 0, month: null as string | null };
  }
  const months = series.map((entry) => entry.month);
  const resolved = resolveMonthInList(months, centerMonth);
  if (!resolved) {
    return { value: 0, month: null as string | null };
  }
  const centerIndex = months.indexOf(resolved);
  const startIndex = Math.max(centerIndex - windowMonths, 0);
  const endIndex = Math.min(centerIndex + windowMonths, series.length - 1);
  let minEntry = series[startIndex];
  for (let i = startIndex; i <= endIndex; i += 1) {
    const entry = series[i];
    if (entry && entry.value < (minEntry?.value ?? 0)) {
      minEntry = entry;
    }
  }
  return { value: minEntry?.value ?? 0, month: minEntry?.month ?? null };
};

const estimateMonthlyExpense = (
  ledgerByMonth: Record<string, CashflowItem[]> | undefined,
  month: string | null
) => {
  if (!ledgerByMonth || !month) {
    return null;
  }
  const items = ledgerByMonth[month];
  if (!items || items.length === 0) {
    return null;
  }
  const totalOutflow = items.reduce((acc, entry) => {
    if (entry.amount < 0) {
      return acc + Math.abs(entry.amount);
    }
    return acc;
  }, 0);
  return totalOutflow > 0 ? totalOutflow : null;
};

export const computeFamilyLaunchScorecard = ({
  projection,
  ledgerByMonth,
  draft,
}: {
  projection: ProjectionResult | null;
  ledgerByMonth?: Record<string, CashflowItem[]>;
  draft?: FamilyLaunchDraft | null;
}): FamilyLaunchScorecard => {
  const missingInputs: string[] = [];
  const weddingMonth = draft?.wedding?.weddingMonth;
  const dueMonth = draft?.baby?.dueMonth;
  const purchaseMonth = draft?.housing?.purchaseMonth;

  if (!weddingMonth) {
    missingInputs.push("weddingMonth");
  }
  if (!dueMonth) {
    missingInputs.push("dueMonth");
  }
  if (draft?.housing?.housingMode === "buy-home" && !purchaseMonth) {
    missingInputs.push("purchaseMonth");
  }

  if (!projection) {
    return {
      status: "yellow",
      minCash: { value: 0, month: null },
      windowMinCash: { value: 0, month: null, details: [] },
      topRiskMonths: [],
      buffer: { threshold: null, recommended: null },
      missingInputs,
    };
  }

  const series = buildCashSeries(projection);
  const sortedByValue = [...series].sort((a, b) => a.value - b.value);
  const minEntry = sortedByValue[0] ?? { month: null, value: 0 };

  const windowDetails: Array<{ label: string; value: number; month: string | null }> = [];
  if (purchaseMonth) {
    const purchaseWindow = findMinInWindow(series, purchaseMonth, 12);
    windowDetails.push({
      label: "purchase",
      value: purchaseWindow.value,
      month: purchaseWindow.month,
    });
  }
  if (dueMonth) {
    const dueWindow = findMinInWindow(series, dueMonth, 12);
    windowDetails.push({
      label: "baby",
      value: dueWindow.value,
      month: dueWindow.month,
    });
  }
  if (weddingMonth) {
    const weddingWindow = findMinInWindow(series, weddingMonth, 6);
    windowDetails.push({
      label: "wedding",
      value: weddingWindow.value,
      month: weddingWindow.month,
    });
  }

  const windowMin =
    windowDetails.length > 0
      ? windowDetails.reduce((min, entry) =>
          entry.value < min.value ? entry : min
        )
      : minEntry;

  const topRiskMonths = sortedByValue.slice(0, 3).map((entry) => {
    const flags: string[] = [];
    if (entry.month === weddingMonth) {
      flags.push("wedding");
    }
    if (entry.month === dueMonth) {
      flags.push("baby");
    }
    if (entry.month === purchaseMonth) {
      flags.push("purchase");
    }
    return { month: entry.month, value: entry.value, flags };
  });

  const threshold = estimateMonthlyExpense(ledgerByMonth, minEntry.month);
  const bufferNeeded =
    threshold !== null && minEntry.value < threshold
      ? Math.max(threshold - minEntry.value, 0)
      : minEntry.value < 0
        ? Math.abs(minEntry.value)
        : null;

  const status: FamilyLaunchScorecardStatus =
    minEntry.value < 0 ? "red" : threshold !== null && minEntry.value < threshold ? "yellow" : "green";

  return {
    status,
    minCash: { value: minEntry.value, month: minEntry.month ?? null },
    windowMinCash: {
      value: windowMin.value,
      month: windowMin.month ?? null,
      details: windowDetails,
    },
    topRiskMonths,
    buffer: {
      threshold,
      recommended: bufferNeeded,
    },
    missingInputs,
  };
};
