import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import { addMonths } from "../../domain/members/age";
import { compareMonthKey } from "../../utils/monthKey";
import {
  deriveRecurringGroupId,
  getSalaryAdjustmentParentEventId,
  isSalaryAdjustmentEvent,
  resolveRecurringEffectiveMonth,
  resolveRecurringGroupId,
} from "./salaryAdjustmentTags";
import {
  resolveEventCardEndMonth,
  resolveEventCardStartMonth,
} from "./eventCardUtils";

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

const monthBefore = (month: string) => addMonths(month, -1);

const isSalaryBaseEvent = (event: ScenarioEvent) =>
  event.type === "cashflow" &&
  event.kind === "income" &&
  event.cadence === "monthly" &&
  !isSalaryAdjustmentEvent(event);

export const groupAdjustmentsByBase = (events: ScenarioEvent[]): SalaryAdjustmentGroup[] => {
  const byId = new Map(events.map((event) => [event.id, event]));
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
    const parentId =
      resolveRecurringGroupId(event) ?? getSalaryAdjustmentParentEventId(event) ?? event.parentEventId;
    if (!parentId) {
      groups.set(event.id, { groupId: event.id, baseEvent: event, adjustments: [] });
      return;
    }

    const existing = groups.get(parentId);
    if (existing) {
      existing.adjustments.push(event);
      return;
    }

    const parent = byId.get(parentId);
    if (parent && isSalaryBaseEvent(parent)) {
      groups.set(parentId, {
        groupId: parentId,
        baseEvent: parent,
        adjustments: [event],
      });
      return;
    }

    groups.set(parentId, {
      groupId: parentId,
      baseEvent: event,
      adjustments: [],
    });
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    adjustments: [...group.adjustments].sort((left, right) =>
      compareMonthKey(
        resolveRecurringEffectiveMonth(left) ?? resolveEventCardStartMonth(left) ?? "9999-12",
        resolveRecurringEffectiveMonth(right) ?? resolveEventCardStartMonth(right) ?? "9999-12"
      )
    ),
  }));
};

export const computeEffectiveRanges = (
  baseEvent: ScenarioEvent,
  adjustments: ScenarioEvent[]
): EffectiveRangeSegment[] => {
  const sorted = [...adjustments].sort((left, right) =>
    compareMonthKey(
      resolveRecurringEffectiveMonth(left) ?? resolveEventCardStartMonth(left) ?? "9999-12",
      resolveRecurringEffectiveMonth(right) ?? resolveEventCardStartMonth(right) ?? "9999-12"
    )
  );
  const chain = [baseEvent, ...sorted];

  return chain.map((event, index) => {
    const from = resolveRecurringEffectiveMonth(event) ?? resolveEventCardStartMonth(event) ?? null;
    const next = chain[index + 1];
    const nextFrom = next
      ? resolveRecurringEffectiveMonth(next) ?? resolveEventCardStartMonth(next) ?? null
      : null;
    const explicitEnd = resolveEventCardEndMonth(event) ?? null;

    let to = nextFrom ? monthBefore(nextFrom) : explicitEnd;
    if (!nextFrom && !explicitEnd && index === chain.length - 1) {
      to = null;
    }
    if (from && to && compareMonthKey(to, from) < 0) {
      to = from;
    }

    return { event, from, to };
  });
};
