import { addMonths, monthIndex } from "@north-star/engine";
import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import type { LedgerRow } from "../../engine/scenarioV2Compiler";
import { compareMonthKey } from "../../utils/monthKey";
import {
  resolveEventCardAmount,
  resolveEventCardEndMonth,
  resolveEventCardStartMonth,
} from "./eventCardUtils";
import {
  getSalaryAdjustmentParentEventId,
  isSalaryAdjustmentEvent,
  resolveRecurringGroupId,
} from "./salaryAdjustmentTags";
import { computeEffectiveRanges, groupAdjustmentsByBase } from "./salaryAdjustmentGrouping";

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

export type GroupedIncomeEvent = {
  baseEvent: ScenarioEvent;
  adjustments: ScenarioEvent[];
  groupId: string;
  groupStartMonth: string | null;
  groupEndMonth: string | null;
};

export const groupIncomeEvents = (events: ScenarioEvent[]): GroupedIncomeEvent[] => {
  return groupAdjustmentsByBase(events).map((group) => {
    const ranges = computeEffectiveRanges(group.baseEvent, group.adjustments);
    const startMonths = ranges.map((segment) => segment.from).filter(Boolean) as string[];
    const endMonths = ranges.map((segment) => segment.to).filter(Boolean) as string[];
    return {
      baseEvent: group.baseEvent,
      adjustments: group.adjustments,
      groupId: group.groupId,
      groupStartMonth:
        startMonths.length > 0
          ? startMonths.sort((a, b) => compareMonthKey(a, b))[0] ?? null
          : null,
      groupEndMonth:
        endMonths.length > 0
          ? endMonths.sort((a, b) => compareMonthKey(b, a))[0] ?? null
          : null,
    };
  });
};

const isMonthlyIncomeEvent = (event: ScenarioEvent) =>
  event.type === "cashflow" && event.kind === "income" && event.cadence === "monthly";

const isNonMonthlyIncomeEvent = (event: ScenarioEvent) =>
  event.type === "cashflow" && event.kind === "income" && event.cadence !== "monthly";

const sumIncomeByMonth = (rows: LedgerRow[], month: string) =>
  rows
    .filter((row) => row.month === month && (row.kind === "income" || (!row.kind && row.amount > 0)))
    .reduce((sum, row) => sum + Math.abs(row.amount), 0);

const build12MonthWindow = (startMonth: string) => {
  const months = Array.from({ length: 12 }, (_, index) => addMonths(startMonth, index));
  return new Set(months);
};

const resolveContributionGroupId = (event: ScenarioEvent) =>
  resolveRecurringGroupId(event) ??
  (isSalaryAdjustmentEvent(event) ? getSalaryAdjustmentParentEventId(event) : null) ??
  event.id;

export type ContributionByEvent = {
  id: string;
  label: string;
  amount: number;
  share: number;
};

const buildContributionsByEvent = (params: {
  events: ScenarioEvent[];
  ledgerRowsByEventId: Map<string, LedgerRow[]>;
  baseMonth: string;
  kind: "income" | "expense";
}) => {
  const { events, ledgerRowsByEventId, baseMonth, kind } = params;
  const monthWindow = build12MonthWindow(baseMonth);
  const grouped = new Map<string, { id: string; label: string; amount: number }>();

  events.forEach((event) => {
    const rows = ledgerRowsByEventId.get(event.id) ?? [];
    const windowSum = rows
      .filter((row) => monthWindow.has(row.month))
      .reduce((sum, row) => {
        const isIncome = row.kind === "income" || (!row.kind && row.amount > 0);
        const isExpense = row.kind === "expense" || (!row.kind && row.amount < 0);
        if (kind === "income" && !isIncome) {
          return sum;
        }
        if (kind === "expense" && !isExpense) {
          return sum;
        }
        return sum + Math.abs(row.amount);
      }, 0);
    const fallbackAmount =
      rows.length === 0
        ? kind === "income"
          ? event.type === "cashflow" && event.kind === "income"
            ? Math.abs(event.amount ?? 0)
            : event.type === "adjustment"
              ? Math.abs(event.amount ?? 0)
              : 0
          : event.type === "cashflow" && event.kind === "expense"
            ? Math.abs(event.amount ?? 0)
            : 0
        : 0;
    const amountToUse = windowSum || fallbackAmount;
    const key = resolveContributionGroupId(event);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { id: key, label: event.label ?? "—", amount: amountToUse });
      return;
    }
    grouped.set(key, {
      ...existing,
      amount: Math.max(existing.amount, amountToUse),
    });
  });

  const contributionRows = Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
  const total = contributionRows.reduce((sum, row) => sum + row.amount, 0);
  return contributionRows.map((row) => ({
    ...row,
    share: total > 0 ? row.amount / total : 0,
  }));
};

export type IncomeSummaryModel = {
  baselineMonthlyTotal: number;
  nonMonthlyIncomeTotal: number;
  sourceCount: number;
  memberCount: number;
  projectedDelta12m: number | null;
  expiringCount: number;
  topSources: ContributionByEvent[];
};

export type ExpenseSummaryModel = {
  baselineMonthlyTotal: number;
  sourceCount: number;
  memberCount: number;
  projectedDelta12m: number | null;
  expiringCount: number;
  topSources: ContributionByEvent[];
};

export const buildIncomeSummary = (params: {
  events: ScenarioEvent[];
  ledgerRowsByEventId: Map<string, LedgerRow[]>;
  baseMonth?: string;
}): IncomeSummaryModel => {
  const { events, ledgerRowsByEventId, baseMonth } = params;
  const baselineMonthlyTotal = baseMonth
    ? events.reduce((sum, event) => {
        const rows = ledgerRowsByEventId.get(event.id) ?? [];
        const eventMonthSum = rows
          .filter((row) => row.month === baseMonth)
          .reduce((eventSum, row) => {
            const isIncome = row.kind === "income" || (!row.kind && row.amount > 0);
            return isIncome ? eventSum + Math.abs(row.amount) : eventSum;
          }, 0);
        return sum + eventMonthSum;
      }, 0)
    : events
        .filter(isMonthlyIncomeEvent)
        .reduce((sum, event) => sum + Math.abs(resolveEventCardAmount(event) ?? 0), 0);

  const nonMonthlyIncomeTotal = baseMonth
    ? buildContributionsByEvent({ events: events.filter(isNonMonthlyIncomeEvent), ledgerRowsByEventId, baseMonth, kind: "income" })
        .reduce((sum, row) => sum + row.amount, 0)
    : events
        .filter(isNonMonthlyIncomeEvent)
        .reduce((sum, event) => sum + Math.abs(resolveEventCardAmount(event) ?? 0), 0);

  const memberCount = new Set(events.map((event) => event.memberId).filter(Boolean)).size;
  const expiringCount = events.filter((event) => Boolean(resolveEventCardEndMonth(event))).length;

  const annualContributions = buildContributionsByEvent({
    events,
    ledgerRowsByEventId,
    baseMonth: baseMonth ?? "1900-01",
    kind: "income",
  });
  const topSources = annualContributions.slice(0, 8);

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
    sourceCount: annualContributions.length,
    memberCount,
    projectedDelta12m,
    expiringCount,
    topSources,
  };
};

export const buildExpenseSummary = (params: {
  events: ScenarioEvent[];
  ledgerRowsByEventId: Map<string, LedgerRow[]>;
  baseMonth?: string;
}): ExpenseSummaryModel => {
  const { events, ledgerRowsByEventId, baseMonth } = params;
  const memberCount = new Set(events.map((event) => event.memberId).filter(Boolean)).size;
  const expiringCount = events.filter((event) => Boolean(resolveEventCardEndMonth(event))).length;
  const baselineMonthlyTotal = baseMonth
    ? events.reduce((sum, event) => {
        const rows = ledgerRowsByEventId.get(event.id) ?? [];
        const eventMonthSum = rows
          .filter((row) => row.month === baseMonth)
          .reduce((eventSum, row) => {
            const isExpense = row.kind === "expense" || (!row.kind && row.amount < 0);
            return isExpense ? eventSum + Math.abs(row.amount) : eventSum;
          }, 0);
        return sum + eventMonthSum;
      }, 0)
    : events.reduce((sum, event) => sum + Math.abs(resolveEventCardAmount(event) ?? 0), 0);

  const annualContributions = buildContributionsByEvent({
    events,
    ledgerRowsByEventId,
    baseMonth: baseMonth ?? "1900-01",
    kind: "expense",
  });
  const topSources = annualContributions.slice(0, 8);

  let projectedDelta12m: number | null = null;
  if (baseMonth) {
    const baselineMonthTotal = events.reduce((sum, event) => {
      const rows = ledgerRowsByEventId.get(event.id) ?? [];
      return (
        sum +
        rows
          .filter((row) => row.month === baseMonth && (row.kind === "expense" || (!row.kind && row.amount < 0)))
          .reduce((rowSum, row) => rowSum + Math.abs(row.amount), 0)
      );
    }, 0);
    const targetMonth = addMonths(baseMonth, 11);
    const targetMonthTotal = events.reduce((sum, event) => {
      const rows = ledgerRowsByEventId.get(event.id) ?? [];
      return (
        sum +
        rows
          .filter((row) => row.month === targetMonth && (row.kind === "expense" || (!row.kind && row.amount < 0)))
          .reduce((rowSum, row) => rowSum + Math.abs(row.amount), 0)
      );
    }, 0);
    projectedDelta12m = targetMonthTotal - baselineMonthTotal;
  }

  return {
    baselineMonthlyTotal,
    sourceCount: annualContributions.length,
    memberCount,
    projectedDelta12m,
    expiringCount,
    topSources,
  };
};
