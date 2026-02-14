import type { CashflowEvent } from "../../domain/scenarioV2/events";
import {
  computeSalaryEffectiveRangeSegments,
  type SalaryEffectiveRangeIssue,
} from "../../domain/scenarioV2/salaryEffectiveRanges";
import {
  deriveRecurringGroupId,
  resolveRecurringGroupId,
} from "./salaryAdjustmentTags";

export type SalaryScheduleIssue = SalaryEffectiveRangeIssue;

export type NormalizedSalarySchedule = {
  base: CashflowEvent;
  adjustments: CashflowEvent[];
  issues: SalaryScheduleIssue[];
};

const markAsAdjustment = (baseEvent: CashflowEvent, event: CashflowEvent): CashflowEvent => {
  const groupId = resolveRecurringGroupId(baseEvent) ?? deriveRecurringGroupId(baseEvent);
  return {
    ...event,
    seriesId: groupId,
    parentEventId: baseEvent.id,
    groupId,
    groupRole: "adjustment",
    effectiveMonth: event.startMonth,
    meta: {
      ...(event.meta ?? {}),
      kind: "adjustment",
      adjustsEventId: baseEvent.id,
      parentEventId: baseEvent.id,
      relationType: "adjustment",
      adjustableKey: "salary",
    },
  };
};

export const normalizeSalarySchedule = (
  baseEvent: CashflowEvent,
  adjustmentEvents: CashflowEvent[]
): NormalizedSalarySchedule => {
  const groupId = resolveRecurringGroupId(baseEvent) ?? deriveRecurringGroupId(baseEvent);
  const baseWithGrouping: CashflowEvent = {
    ...baseEvent,
    seriesId: groupId,
    parentEventId: undefined,
    groupId,
    groupRole: "base",
    effectiveMonth: baseEvent.startMonth,
    meta: {
      ...(baseEvent.meta ?? {}),
      kind: "base",
      relationType: "adjustment",
      adjustableKey: "salary",
    },
  };

  const adjustments = [...adjustmentEvents]
    .sort((left, right) => (left.startMonth ?? "9999-12").localeCompare(right.startMonth ?? "9999-12"))
    .map((event) => markAsAdjustment(baseWithGrouping, event));
  const normalized = computeSalaryEffectiveRangeSegments([baseWithGrouping, ...adjustments]);
  const segmentById = new Map(normalized.segments.map((segment) => [segment.sourceEventId, segment.event]));

  return {
    base: (segmentById.get(baseEvent.id) as CashflowEvent | undefined) ?? baseWithGrouping,
    adjustments: adjustments
      .map((event) => segmentById.get(event.id) as CashflowEvent | undefined)
      .filter((event): event is CashflowEvent => Boolean(event)),
    issues: normalized.issues,
  };
};
