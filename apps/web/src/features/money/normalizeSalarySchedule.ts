import { addMonths } from "../../domain/members/age";
import { compareMonthKey } from "../../utils/monthKey";
import type { CashflowEvent } from "../../domain/scenarioV2/events";
import {
  deriveRecurringGroupId,
  resolveRecurringGroupId,
} from "./salaryAdjustmentTags";

export type SalaryScheduleIssue =
  | "missing_adjustment_start_month"
  | "adjustment_before_base_start"
  | "duplicate_adjustment_start_month";

export type NormalizedSalarySchedule = {
  base: CashflowEvent;
  adjustments: CashflowEvent[];
  issues: SalaryScheduleIssue[];
};

const syncGrowthFromBase = (base: CashflowEvent, adjustment: CashflowEvent): CashflowEvent => {
  return {
    ...adjustment,
    growthMode: base.growthMode,
    growthSource: base.growthSource,
    customGrowthRatePct: base.customGrowthRatePct,
  };
};

const monthBefore = (month: string) => addMonths(month, -1);

const clampEndMonth = (candidate: string | undefined, hardEndMonth: string | undefined) => {
  if (!candidate) {
    return hardEndMonth;
  }
  if (!hardEndMonth) {
    return candidate;
  }
  return compareMonthKey(candidate, hardEndMonth) > 0 ? hardEndMonth : candidate;
};

const buildAdjustmentEventId = (baseId: string, month: string) => `${baseId}::adj::${month}`;

export const buildSegmentedRecurringEvents = (
  baseEvent: CashflowEvent,
  adjustmentEvents: CashflowEvent[]
): NormalizedSalarySchedule => {
  const issues: SalaryScheduleIssue[] = [];
  const groupId = resolveRecurringGroupId(baseEvent) ?? deriveRecurringGroupId(baseEvent);
  const sortedAdjustments = [...adjustmentEvents].sort((left, right) =>
    compareMonthKey(left.startMonth ?? "9999-12", right.startMonth ?? "9999-12")
  );

  const adjustments: CashflowEvent[] = [];
  let previousStartMonth: string | null = null;

  sortedAdjustments.forEach((event) => {
    const startMonth = event.startMonth;
    if (!startMonth) {
      issues.push("missing_adjustment_start_month");
      return;
    }
    if (baseEvent.startMonth && compareMonthKey(startMonth, baseEvent.startMonth) <= 0) {
      issues.push("adjustment_before_base_start");
      return;
    }
    if (previousStartMonth && compareMonthKey(startMonth, previousStartMonth) === 0) {
      issues.push("duplicate_adjustment_start_month");
      return;
    }

    adjustments.push(
      syncGrowthFromBase(baseEvent, {
        ...event,
        id: buildAdjustmentEventId(baseEvent.id, startMonth),
        groupId,
        groupRole: "adjustment",
        effectiveMonth: startMonth,
      })
    );
    previousStartMonth = startMonth;
  });

  const segmentedAdjustments = adjustments.map((event, index) => {
    const nextStart = adjustments[index + 1]?.startMonth;
    const endMonth = clampEndMonth(
      nextStart ? monthBefore(nextStart) : undefined,
      baseEvent.endMonth
    );
    return {
      ...event,
      endMonth,
    };
  });

  const firstAdjustmentStartMonth = segmentedAdjustments[0]?.startMonth;
  const baseEndMonth = clampEndMonth(
    firstAdjustmentStartMonth ? monthBefore(firstAdjustmentStartMonth) : undefined,
    baseEvent.endMonth
  );

  return {
    base: {
      ...baseEvent,
      groupId,
      groupRole: "base",
      effectiveMonth: baseEvent.startMonth,
      endMonth: baseEndMonth,
    },
    adjustments: segmentedAdjustments,
    issues,
  };
};

export const normalizeSalarySchedule = (
  baseEvent: CashflowEvent,
  adjustmentEvents: CashflowEvent[]
): NormalizedSalarySchedule => {
  return buildSegmentedRecurringEvents(baseEvent, adjustmentEvents);
};
