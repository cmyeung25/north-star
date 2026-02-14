import type { ScenarioEvent } from "../../domain/scenarioV2/events";

export const SALARY_ADJUSTMENT_TAG = "salary_adjustment";
export const SALARY_ADJUSTMENT_PARENT_PREFIX = "salary_parent:";

export const getSalaryAdjustmentParentEventId = (event: ScenarioEvent): string | null => {
  const parentTag = event.tags?.find((tag) =>
    tag.startsWith(SALARY_ADJUSTMENT_PARENT_PREFIX)
  );
  if (!parentTag) {
    return null;
  }
  return parentTag.slice(SALARY_ADJUSTMENT_PARENT_PREFIX.length) || null;
};

export const isSalaryAdjustmentEvent = (event: ScenarioEvent): boolean =>
  event.type === "cashflow" &&
  event.kind === "income" &&
  Boolean(
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

