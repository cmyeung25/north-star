import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import {
  computeSalaryEffectiveRangeSegments,
  getSalaryAdjustmentParentId,
} from "../../domain/scenarioV2/salaryEffectiveRanges";
import {
  deriveRecurringGroupId,
  isSalaryAdjustmentEvent,
  resolveRecurringGroupId,
} from "./salaryAdjustmentTags";

export type SalaryAdjustmentGroup = {
  groupId: string;
  baseEvent: ScenarioEvent;
  adjustments: ScenarioEvent[];
};

export type EffectiveRangeSegment = {
  event: ScenarioEvent;
  from: string | null;
  to: string | null;
};

const isSalaryBaseEvent = (event: ScenarioEvent) =>
  event.type === "cashflow" &&
  event.kind === "income" &&
  event.cadence === "monthly" &&
  !isSalaryAdjustmentEvent(event);

export const groupAdjustmentsByBase = (events: ScenarioEvent[]): SalaryAdjustmentGroup[] => {
  const groups = new Map<string, SalaryAdjustmentGroup>();

  events.forEach((event) => {
    if (!isSalaryBaseEvent(event)) {
      return;
    }
    const groupId = resolveRecurringGroupId(event) ?? deriveRecurringGroupId(event);
    groups.set(groupId, {
      groupId,
      baseEvent: event,
      adjustments: [],
    });
  });

  events.forEach((event) => {
    if (!isSalaryAdjustmentEvent(event)) {
      return;
    }
    const parentId = getSalaryAdjustmentParentId(event);
    if (!parentId) {
      return;
    }
    const existing = groups.get(parentId);
    if (existing) {
      existing.adjustments.push(event);
    }
  });

  return Array.from(groups.values());
};

export const computeEffectiveRanges = (
  baseEvent: ScenarioEvent,
  adjustments: ScenarioEvent[]
): EffectiveRangeSegment[] => {
  const { segments } = computeSalaryEffectiveRangeSegments([baseEvent, ...adjustments]);
  return segments.map((segment) => ({
    event: segment.event,
    from: segment.from,
    to: segment.to,
  }));
};
