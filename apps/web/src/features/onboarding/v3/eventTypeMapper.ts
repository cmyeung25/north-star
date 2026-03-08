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
const EXPENSE_OTHER_FIXED_TAG = "onboarding:v3:expense:other-fixed";
const INCOME_SALARY_TAG = "onboarding:v3:income:salary";
const INCOME_RENT_TAG = "onboarding:v3:income:rent";
const INCOME_BONUS_TAG = "onboarding:v3:income:bonus";
const ONBOARDING_V3_TAG_PREFIX = "onboarding:v3:";

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
      expenseCategory: "travel",
      meta: { ...(event.meta ?? {}), timelineEventType: "travel" as const },
    };
  }

  if (tags.includes(EXPENSE_TAX_TAG)) {
    return {
      ...event,
      expenseCategory: "tax",
      tags: withTag(tags, "tax"),
      meta: { ...(event.meta ?? {}), timelineEventType: "custom" as const },
    };
  }

  if (tags.includes(EXPENSE_DAILY_TAG)) {
    return {
      ...event,
      expenseCategory: "daily_living",
      meta: { ...(event.meta ?? {}), timelineEventType: "custom" as const },
    };
  }

  if (tags.includes(EXPENSE_OTHER_FIXED_TAG)) {
    return {
      ...event,
      expenseCategory: "other",
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
      category: "salary",
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
      category: "rental",
      tags: withTag(tags, "income:rental"),
      meta: {
        ...(event.meta ?? {}),
        timelineEventType: "custom" as const,
        timelineIncomeSubtype: "rental" as const,
      },
    };
  }

  if (tags.includes(INCOME_BONUS_TAG)) {
    return {
      ...event,
      category: "bonus",
      meta: {
        ...(event.meta ?? {}),
        timelineEventType: "custom" as const,
        timelineIncomeSubtype: "bonus" as const,
      },
    };
  }

  if (tags.some((tag) => tag.startsWith("onboarding:v3:income:"))) {
    return {
      ...event,
      category: "other",
      meta: {
        ...(event.meta ?? {}),
        timelineEventType: "custom" as const,
        timelineIncomeSubtype: "other" as const,
      },
    };
  }

  return event;
};

const mapCashflowEventType = (event: CashflowLikeEvent): CashflowLikeEvent =>
  mapExpenseEvent(mapIncomeEvent(event));

const stripOnboardingV3Tags = (event: CashflowLikeEvent): CashflowLikeEvent => {
  if (!event.tags?.length) {
    return event;
  }

  const tags = event.tags.filter((tag) => !tag.startsWith(ONBOARDING_V3_TAG_PREFIX));
  return tags.length === event.tags.length ? event : { ...event, tags };
};

export const mapOnboardingV3EventTypes = (
  events: Array<ScenarioEvent | ScenarioEventDraft>
): Array<ScenarioEvent | ScenarioEventDraft> =>
  events.map((event) => {
    if (event.type !== "cashflow") {
      return event;
    }

    const mapped = stripOnboardingV3Tags(mapCashflowEventType(event));
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
