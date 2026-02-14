import { addMonths } from "../../domain/members/age";
import { compareMonthKey } from "../../utils/monthKey";
import type { CashflowEvent } from "../../domain/scenarioV2/events";

export type SalaryScheduleIssue =
  | "missing_adjustment_start_month"
  | "adjustment_before_base_start"
  | "duplicate_adjustment_start_month";

export type NormalizedSalarySchedule = {
  base: CashflowEvent;
  adjustments: CashflowEvent[];
  issues: SalaryScheduleIssue[];
};

const isAdjustmentUsingLegacyDefault = (event: CashflowEvent) =>
  event.growthMode === "none" &&
  event.customGrowthRatePct === undefined &&
  event.growthSource === undefined;

const syncGrowthFromBase = (base: CashflowEvent, adjustment: CashflowEvent): CashflowEvent => {
  if (adjustment.growthMode === "custom") {
    return adjustment;
  }
  if (adjustment.growthMode !== undefined && !isAdjustmentUsingLegacyDefault(adjustment)) {
    return adjustment;
  }
  return {
    ...adjustment,
    growthMode: base.growthMode,
    growthSource: base.growthSource,
    customGrowthRatePct: base.customGrowthRatePct,
  };
};

export const normalizeSalarySchedule = (
  baseEvent: CashflowEvent,
  adjustmentEvents: CashflowEvent[]
): NormalizedSalarySchedule => {
  const issues: SalaryScheduleIssue[] = [];
  const sortedAdjustments = [...adjustmentEvents].sort((left, right) =>
    compareMonthKey(left.startMonth ?? "9999-12", right.startMonth ?? "9999-12")
  );

  const adjustments: CashflowEvent[] = [];
  let previousStartMonth: string | null = null;

  sortedAdjustments.forEach((event, index) => {
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

    const nextStartMonth = sortedAdjustments[index + 1]?.startMonth;
    const endMonth = nextStartMonth ? addMonths(nextStartMonth, -1) : undefined;
    adjustments.push(
      syncGrowthFromBase(baseEvent, {
        ...event,
        endMonth,
      })
    );
    previousStartMonth = startMonth;
  });

  const firstAdjustmentStartMonth = adjustments[0]?.startMonth;

  return {
    base: {
      ...baseEvent,
      endMonth: firstAdjustmentStartMonth
        ? addMonths(firstAdjustmentStartMonth, -1)
        : undefined,
    },
    adjustments,
    issues,
  };
};

