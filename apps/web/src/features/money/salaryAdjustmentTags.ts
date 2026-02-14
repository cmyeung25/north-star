import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import {
  getSalaryAdjustmentParentId,
  SALARY_ADJUSTMENT_PARENT_PREFIX,
} from "../../domain/scenarioV2/salaryEffectiveRanges";

export const SALARY_ADJUSTMENT_TAG = "salary_adjustment";

export type RecurringEventGroupRole = "base" | "adjustment";

type ScenarioEventWithGrouping = ScenarioEvent & {
  groupId?: string;
  groupRole?: RecurringEventGroupRole;
  effectiveMonth?: string;
};

export const deriveRecurringGroupId = (event: ScenarioEvent): string => event.id;

export const resolveRecurringGroupId = (event: ScenarioEvent): string | null => {
  const groupedEvent = event as ScenarioEventWithGrouping;
  if (groupedEvent.groupId?.trim()) {
    return groupedEvent.groupId;
  }
  const parentId = getSalaryAdjustmentParentEventId(event);
  if (parentId) {
    return parentId;
  }
  return null;
};

export const resolveRecurringGroupRole = (event: ScenarioEvent): RecurringEventGroupRole => {
  const groupedEvent = event as ScenarioEventWithGrouping;
  if (groupedEvent.groupRole === "base" || groupedEvent.groupRole === "adjustment") {
    return groupedEvent.groupRole;
  }
  return isSalaryAdjustmentEvent(event) ? "adjustment" : "base";
};

export const resolveRecurringEffectiveMonth = (event: ScenarioEvent): string | undefined => {
  const groupedEvent = event as ScenarioEventWithGrouping;
  return groupedEvent.effectiveMonth ?? (event.type === "cashflow" ? event.startMonth : undefined);
};

export const getSalaryAdjustmentParentEventId = (event: ScenarioEvent): string | null => {
  return getSalaryAdjustmentParentId(event);
};

export const isSalaryAdjustmentEvent = (event: ScenarioEvent): boolean =>
  event.type === "cashflow" &&
  event.kind === "income" &&
  Boolean(
    (event as ScenarioEventWithGrouping).groupRole === "adjustment" ||
      event.tags?.includes(SALARY_ADJUSTMENT_TAG) ||
      getSalaryAdjustmentParentEventId(event)
  );

export const buildSalaryAdjustmentTags = (
  parentEventId: string,
  existingTags?: string[]
): string[] => {
  const nextTags = new Set(existingTags ?? []);
  nextTags.add("adjustment");
  nextTags.add(SALARY_ADJUSTMENT_TAG);
  nextTags.add(`${SALARY_ADJUSTMENT_PARENT_PREFIX}${parentEventId}`);
  return Array.from(nextTags);
};
