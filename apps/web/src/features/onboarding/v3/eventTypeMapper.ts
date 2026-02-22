import type { EventType, IncomeSubtype } from "../../timeline/schema";
import type { ScenarioEvent, ScenarioEventDraft } from "../../../domain/scenarioV2/events";

type CashflowLikeEvent = Extract<ScenarioEvent | ScenarioEventDraft, { type: "cashflow" }>;

type TimelineSemanticMeta = {
  timelineEventType?: EventType;
  timelineIncomeSubtype?: IncomeSubtype;
};

const EXPENSE_DAILY_TAG = "onboarding:v3:expense:daily-monthly";
const EXPENSE_TRAVEL_TAG = "onboarding:v3:expense:travel";
const EXPENSE_TAX_TAG = "onboarding:v3:expense:tax";
const INCOME_SALARY_TAG = "onboarding:v3:income:salary";
const INCOME_RENT_TAG = "onboarding:v3:income:rent";

const withTag = (tags: string[] | undefined, tag: string) => {
  if (!tag) {
    return tags;
  }
  const next = tags ?? [];
  return next.includes(tag) ? next : [...next, tag];
};

const mapExpenseEvent = (event: CashflowLikeEvent): CashflowLikeEvent => {
  if (event.kind !== "expense") {
    return event;
  }

  const tags = event.tags ?? [];

  if (tags.includes(EXPENSE_TRAVEL_TAG)) {
    return {
      ...event,
      meta: { ...(event.meta ?? {}), timelineEventType: "travel" as const },
    };
  }

  if (tags.includes(EXPENSE_TAX_TAG)) {
    return {
      ...event,
      tags: withTag(tags, "tax"),
      meta: { ...(event.meta ?? {}), timelineEventType: "custom" as const },
    };
  }

  if (tags.includes(EXPENSE_DAILY_TAG)) {
    return {
      ...event,
      meta: { ...(event.meta ?? {}), timelineEventType: "custom" as const },
    };
  }

  return event;
};

const mapIncomeEvent = (event: CashflowLikeEvent): CashflowLikeEvent => {
  if (event.kind !== "income") {
    return event;
  }

  const tags = event.tags ?? [];

  if (tags.includes(INCOME_SALARY_TAG)) {
    return {
      ...event,
      meta: {
        ...(event.meta ?? {}),
        timelineEventType: "salary" as const,
        timelineIncomeSubtype: "salary" as const,
      },
    };
  }

  if (tags.includes(INCOME_RENT_TAG)) {
    return {
      ...event,
      tags: withTag(tags, "income:rental"),
      meta: {
        ...(event.meta ?? {}),
        timelineEventType: "custom" as const,
        timelineIncomeSubtype: "rental" as const,
      },
    };
  }

  return event;
};

const mapCashflowEventType = (event: CashflowLikeEvent): CashflowLikeEvent =>
  mapExpenseEvent(mapIncomeEvent(event));

export const mapOnboardingV3EventTypes = (
  events: Array<ScenarioEvent | ScenarioEventDraft>
): Array<ScenarioEvent | ScenarioEventDraft> =>
  events.map((event) => {
    if (event.type !== "cashflow") {
      return event;
    }

    const mapped = mapCashflowEventType(event);
    const semanticMeta = mapped.meta as TimelineSemanticMeta | undefined;
    if (!semanticMeta?.timelineEventType && !semanticMeta?.timelineIncomeSubtype) {
      return mapped;
    }

    return {
      ...mapped,
      meta: {
        ...(mapped.meta ?? {}),
        eventTypeMappedBy: "onboarding-v3",
      },
    };
  });
