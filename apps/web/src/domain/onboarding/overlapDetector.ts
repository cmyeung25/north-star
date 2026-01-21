import type { EventType } from "@north-star/engine";
import { getEventGroup } from "@north-star/engine";
import type { BudgetRule } from "../../store/scenarioStore";
import type { OnboardingTimelineEventDraft } from "./applyDraft";

export type OverlapWarning = {
  id: string;
  type: "budget-event" | "housing";
  eventId: string;
  budgetRuleId?: string;
  messageKey: "overlapBudget" | "overlapHousing";
};

const eventCategoryMap: Partial<Record<EventType, BudgetRule["category"]>> = {
  baby: "childcare",
  helper: "eldercare",
};

const resolveMemberKey = (memberId?: string | null) => memberId ?? "household";

export const detectOnboardingOverlaps = (
  budgetRules: BudgetRule[],
  events: OnboardingTimelineEventDraft[],
  hasHomePosition: boolean
): OverlapWarning[] => {
  const warnings: OverlapWarning[] = [];

  events.forEach((event) => {
    const eventGroup = getEventGroup(event.type);
    if (eventGroup === "housing" && hasHomePosition) {
      warnings.push({
        id: `housing-${event.id}`,
        type: "housing",
        eventId: event.id,
        messageKey: "overlapHousing",
      });
    }

    const mappedCategory = eventCategoryMap[event.type];
    if (!mappedCategory) {
      return;
    }

    const eventMemberKey = resolveMemberKey(event.memberId);
    budgetRules
      .filter((rule) => rule.category === mappedCategory)
      .forEach((rule) => {
        const ruleMemberKey = resolveMemberKey(rule.memberId);
        if (ruleMemberKey !== eventMemberKey) {
          return;
        }
        warnings.push({
          id: `budget-${rule.id}-${event.id}`,
          type: "budget-event",
          eventId: event.id,
          budgetRuleId: rule.id,
          messageKey: "overlapBudget",
        });
      });
  });

  return warnings;
};
