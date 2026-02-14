import { addMonths } from "../members/age";
import { compareMonthKey, isValidMonthKey } from "../../utils/monthKey";
import type { CashflowEvent, ScenarioEvent } from "./events";

export const SALARY_ADJUSTMENT_PARENT_PREFIX = "salary_parent:";

export type SalaryEffectiveRangeIssue =
  | "missing_adjustment_start_month"
  | "adjustment_before_base_start"
  | "duplicate_adjustment_start_month"
  | "adjustment_after_base_end"
  | "missing_parent"
  | "invalid_parent_type";

export type SalaryEffectiveRangeSegment = {
  sourceEventId: string;
  event: CashflowEvent;
  from: string | null;
  to: string | null;
};

export type DerivedAdjustableRange = {
  sourceEventId: string;
  event: CashflowEvent;
  effectiveStart: string;
  effectiveEnd: string | null;
};

const isSalaryEvent = (event: ScenarioEvent): event is CashflowEvent =>
  event.type === "cashflow" && event.kind === "income" && event.cadence === "monthly";

export const getSalaryAdjustmentParentId = (event: ScenarioEvent): string | null => {
  const metaParentId =
    typeof event.meta?.parentEventId === "string" ? event.meta.parentEventId : undefined;
  const parentTag = event.tags?.find((tag) => tag.startsWith(SALARY_ADJUSTMENT_PARENT_PREFIX));
  const taggedParentId = parentTag?.slice(SALARY_ADJUSTMENT_PARENT_PREFIX.length);
  return (
    event.parentEventId ??
    metaParentId ??
    (typeof event.meta?.adjustsEventId === "string" ? event.meta.adjustsEventId : undefined) ??
    taggedParentId ??
    null
  );
};

const isAdjustment = (event: ScenarioEvent) => Boolean(getSalaryAdjustmentParentId(event));
const monthBefore = (month: string) => addMonths(month, -1);

const syncGrowthFromBase = (base: CashflowEvent, event: CashflowEvent): CashflowEvent => ({
  ...event,
  growthMode: event.growthMode ?? base.growthMode,
  growthSource: event.growthSource ?? base.growthSource,
  customGrowthRatePct: event.customGrowthRatePct ?? base.customGrowthRatePct,
});

const minMonth = (...values: Array<string | undefined>): string | undefined => {
  const valid = values.filter((value): value is string => Boolean(value));
  if (valid.length === 0) {
    return undefined;
  }
  return valid.sort((a, b) => compareMonthKey(a, b))[0];
};

export const computeSalaryEffectiveRangeSegments = (
  events: ScenarioEvent[]
): { segments: SalaryEffectiveRangeSegment[]; issues: SalaryEffectiveRangeIssue[] } => {
  const salaryEvents = events.filter(isSalaryEvent);
  const byId = new Map(salaryEvents.map((event) => [event.id, event]));
  const grouped = new Map<string, CashflowEvent[]>();
  const issues: SalaryEffectiveRangeIssue[] = [];

  salaryEvents.forEach((event) => {
    const parentId = getSalaryAdjustmentParentId(event);
    if (parentId) {
      const parent = byId.get(parentId);
      if (!parent) {
        issues.push("missing_parent");
        return;
      }
      const group = grouped.get(parentId) ?? [];
      group.push(event);
      grouped.set(parentId, group);
      return;
    }

    const group = grouped.get(event.id) ?? [];
    group.push(event);
    grouped.set(event.id, group);
  });

  const segments = Array.from(grouped.entries()).flatMap<SalaryEffectiveRangeSegment>(([groupId, groupEvents]) => {
    const parent = byId.get(groupId) ?? groupEvents.find((event) => !isAdjustment(event));
    if (!parent) {
      return [];
    }

    const derived = deriveEffectiveRangesForAdjustableGroup(groupEvents, issues);
    return derived.map((segment) => ({
        sourceEventId: segment.sourceEventId,
        from: segment.effectiveStart,
        to: segment.effectiveEnd,
        event: syncGrowthFromBase(parent, {
          ...segment.event,
          startMonth: segment.effectiveStart,
          endMonth: segment.effectiveEnd ?? undefined,
        }),
      }));
  });

  return { segments, issues };
};

export const deriveEffectiveRangesForAdjustableGroup = (
  events: CashflowEvent[],
  existingIssues: SalaryEffectiveRangeIssue[] = []
): DerivedAdjustableRange[] => {
  if (events.length === 0) {
    return [];
  }
  const parent = events.find((event) => !getSalaryAdjustmentParentId(event)) ?? events[0];
  if (!parent?.startMonth || !isValidMonthKey(parent.startMonth)) {
    return [];
  }

  const sorted = [...events].sort((left, right) => {
    const startCompare = compareMonthKey(left.startMonth ?? "9999-12", right.startMonth ?? "9999-12");
    if (startCompare !== 0) {
      return startCompare;
    }
    if (left.id === parent.id) {
      return -1;
    }
    if (right.id === parent.id) {
      return 1;
    }
    return left.id.localeCompare(right.id);
  });

  const validEvents: CashflowEvent[] = [];
  const seenStarts = new Set<string>();

  sorted.forEach((event) => {
    const startMonth = event.startMonth;
    if (!startMonth || !isValidMonthKey(startMonth)) {
      if (event.id !== parent.id) {
        existingIssues.push("missing_adjustment_start_month");
      }
      return;
    }
    if (seenStarts.has(startMonth)) {
      existingIssues.push("duplicate_adjustment_start_month");
      return;
    }
    if (event.id !== parent.id && compareMonthKey(startMonth, parent.startMonth ?? startMonth) < 0) {
      existingIssues.push("adjustment_before_base_start");
      return;
    }
    if (event.id !== parent.id && parent.endMonth && compareMonthKey(startMonth, parent.endMonth) > 0) {
      existingIssues.push("adjustment_after_base_end");
      return;
    }
    seenStarts.add(startMonth);
    validEvents.push(event);
  });

  return validEvents.flatMap((event, index) => {
    const startMonth = event.startMonth;
    if (!startMonth) {
      return [];
    }
    const nextStart = validEvents[index + 1]?.startMonth;
    const effectiveEnd = minMonth(
      event.id === parent.id ? parent.endMonth : event.endMonth,
      nextStart ? monthBefore(nextStart) : undefined,
      index === validEvents.length - 1 ? parent.endMonth : undefined
    );
    if (effectiveEnd && compareMonthKey(startMonth, effectiveEnd) > 0) {
      return [];
    }
    return [{ sourceEventId: event.id, event, effectiveStart: startMonth, effectiveEnd: effectiveEnd ?? null }];
  });
};
