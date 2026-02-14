import { monthIndex } from "@north-star/engine";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import type { LedgerRow } from "../../engine/scenarioV2Compiler";
import { compareMonthKey } from "../../utils/monthKey";
import {
  resolveEventCardAmount,
  resolveEventCardEndMonth,
  resolveEventCardStartMonth,
} from "./eventCardUtils";

export type IncomeStatusFilter = "all" | "ongoing" | "ending";
export type IncomeSortOption = "amountDesc" | "startMonthAsc" | "endMonthAsc";

const toMonthComparable = (value: string | null) => value ?? "9999-12";

export const sortIncomeEvents = (
  events: ScenarioEvent[],
  sortBy: IncomeSortOption
): ScenarioEvent[] => {
  const copy = [...events];
  copy.sort((left, right) => {
    if (sortBy === "amountDesc") {
      const amountDiff = (resolveEventCardAmount(right) ?? 0) - (resolveEventCardAmount(left) ?? 0);
      if (amountDiff !== 0) {
        return amountDiff;
      }
    }
    if (sortBy === "startMonthAsc") {
      const startDiff = compareMonthKey(
        toMonthComparable(resolveEventCardStartMonth(left)),
        toMonthComparable(resolveEventCardStartMonth(right))
      );
      if (startDiff !== 0) {
        return startDiff;
      }
    }
    if (sortBy === "endMonthAsc") {
      const endDiff = compareMonthKey(
        toMonthComparable(resolveEventCardEndMonth(left)),
        toMonthComparable(resolveEventCardEndMonth(right))
      );
      if (endDiff !== 0) {
        return endDiff;
      }
    }
    return (left.label ?? "").localeCompare(right.label ?? "");
  });
  return copy;
};

export const filterIncomeEvents = (
  events: ScenarioEvent[],
  memberId: string,
  status: IncomeStatusFilter
) =>
  events.filter((event) => {
    if (memberId !== "all" && event.memberId !== memberId) {
      return false;
    }
    const endMonth = resolveEventCardEndMonth(event);
    if (status === "ongoing") {
      return !endMonth;
    }
    if (status === "ending") {
      return Boolean(endMonth);
    }
    return true;
  });

const isMonthlyIncomeEvent = (event: ScenarioEvent) =>
  event.type === "cashflow" && event.kind === "income" && event.cadence === "monthly";

const isNonMonthlyIncomeEvent = (event: ScenarioEvent) =>
  event.type === "cashflow" && event.kind === "income" && event.cadence !== "monthly";

const sumIncomeByMonth = (rows: LedgerRow[], month: string) =>
  rows
    .filter((row) => row.month === month && (row.kind === "income" || (!row.kind && row.amount > 0)))
    .reduce((sum, row) => sum + Math.abs(row.amount), 0);

export type IncomeSummaryModel = {
  baselineMonthlyTotal: number;
  nonMonthlyIncomeTotal: number;
  sourceCount: number;
  memberCount: number;
  projectedDelta12m: number | null;
  expiringCount: number;
  topSources: Array<{ id: string; label: string; amount: number; share: number }>;
};

export const buildIncomeSummary = (params: {
  events: ScenarioEvent[];
  ledgerRowsByEventId: Map<string, LedgerRow[]>;
  baseMonth?: string;
}): IncomeSummaryModel => {
  const { events, ledgerRowsByEventId, baseMonth } = params;
  const monthlyEvents = events.filter(isMonthlyIncomeEvent);
  const baselineMonthlyTotal = monthlyEvents.reduce(
    (sum, event) => sum + Math.abs(resolveEventCardAmount(event) ?? 0),
    0
  );
  const nonMonthlyIncomeTotal = events
    .filter(isNonMonthlyIncomeEvent)
    .reduce((sum, event) => sum + Math.abs(resolveEventCardAmount(event) ?? 0), 0);
  const memberCount = new Set(events.map((event) => event.memberId).filter(Boolean)).size;
  const expiringCount = events.filter((event) => Boolean(resolveEventCardEndMonth(event))).length;

  const topSourcesRaw = events
    .map((event) => ({
      id: event.id,
      label: event.label ?? "—",
      amount: Math.abs(resolveEventCardAmount(event) ?? 0),
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const topSourcesTotal = topSourcesRaw.reduce((sum, source) => sum + source.amount, 0);
  const topSources = topSourcesRaw.map((source) => ({
    ...source,
    share: topSourcesTotal > 0 ? source.amount / topSourcesTotal : 0,
  }));

  let projectedDelta12m: number | null = null;
  if (baseMonth) {
    const targetOffset = 11;
    const targetMonth = Array.from(
      new Set(
        Array.from(ledgerRowsByEventId.values())
          .flat()
          .map((row) => row.month)
      )
    ).find((month) => monthIndex(baseMonth, month) === targetOffset);
    if (targetMonth) {
      const baselineProjected = Array.from(ledgerRowsByEventId.values()).reduce(
        (sum, rows) => sum + sumIncomeByMonth(rows, baseMonth),
        0
      );
      const targetProjected = Array.from(ledgerRowsByEventId.values()).reduce(
        (sum, rows) => sum + sumIncomeByMonth(rows, targetMonth),
        0
      );
      projectedDelta12m = targetProjected - baselineProjected;
    }
  }

  return {
    baselineMonthlyTotal,
    nonMonthlyIncomeTotal,
    sourceCount: events.length,
    memberCount,
    projectedDelta12m,
    expiringCount,
    topSources,
  };
};
