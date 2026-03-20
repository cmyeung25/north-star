import type {
  OnboardingFunnelEvent,
  OnboardingFunnelEventName,
  OnboardingReviewSourceContext,
} from "./onboardingFunnel";
import type {
  OnboardingGuardrailCategory,
  OnboardingGuardrailSection,
  OnboardingGuardrailSeverity,
  OnboardingGuardrailStepId,
} from "../../features/onboarding/v3/guardrails";

type ReviewPackWindowInput = string | Date;

type OnboardingReviewPackOptions = {
  weekStart: ReviewPackWindowInput;
  weekEnd: ReviewPackWindowInput;
  locale?: string;
  topN?: number;
};

type ReviewPackGuardrailRow = {
  guardrailId: string;
  severity: OnboardingGuardrailSeverity | "unknown";
  category: OnboardingGuardrailCategory | "unknown";
  targetStepId: OnboardingGuardrailStepId | "unknown";
  targetSection: OnboardingGuardrailSection | "unknown";
  shownEventCount: number;
  shownReviewCount: number;
  shownRate: number;
  fixedReviewCount: number;
  fixSuccessRate: number;
  incompleteReviewCount: number;
  incompleteShareOfShown: number;
};

export type OnboardingReviewPack = {
  window: {
    weekStart: string;
    weekEnd: string;
  };
  locale: string | "all";
  totals: {
    reviewSessionCount: number;
    completedReviewSessionCount: number;
    reviewToCompletedConversionRate: number;
    reviewWithoutCompletionSessionCount: number;
    reviewWithoutCompletionRate: number;
    severityMix: {
      critical: number;
      warning: number;
      info: number;
      total: number;
      averagePerReview: number;
    };
    reviewSourceContextCounts: Record<OnboardingReviewSourceContext, number>;
  };
  sections: {
    topShownGuardrails: ReviewPackGuardrailRow[];
    lowestFixSuccessGuardrails: ReviewPackGuardrailRow[];
    reviewWithoutCompletionCandidates: ReviewPackGuardrailRow[];
  };
};

export type OnboardingReviewPackTableExport = {
  summary: {
    locale: string | "all";
    weekStart: string;
    weekEnd: string;
    reviewSessions: number;
    completedReviewSessions: number;
    reviewToCompletedConversionPct: number;
    reviewWithoutCompletionSessions: number;
    reviewWithoutCompletionPct: number;
    criticalGuardrailsShown: number;
    warningGuardrailsShown: number;
    infoGuardrailsShown: number;
    totalGuardrailsShown: number;
    averageGuardrailsPerReview: number;
    initialReviewSessions: number;
    returnedFromFixSessions: number;
  };
  tables: {
    topShownGuardrails: Array<Record<string, number | string>>;
    lowestFixSuccessGuardrails: Array<Record<string, number | string>>;
    reviewWithoutCompletionCandidates: Array<Record<string, number | string>>;
  };
};

type ReviewMeta = {
  completed: boolean;
};

type GuardrailAggregate = {
  guardrailId: string;
  severity: OnboardingGuardrailSeverity | "unknown";
  category: OnboardingGuardrailCategory | "unknown";
  targetStepId: OnboardingGuardrailStepId | "unknown";
  targetSection: OnboardingGuardrailSection | "unknown";
  shownEventCount: number;
  shownReviewSessions: Set<string>;
  fixedReviewSessions: Set<string>;
};

const REVIEW_EVENT: OnboardingFunnelEventName = "onboarding_review_viewed";
const COMPLETE_EVENT: OnboardingFunnelEventName = "onboarding_completed";
const SHOWN_EVENT: OnboardingFunnelEventName = "guardrail_shown";
const FIXED_EVENT: OnboardingFunnelEventName = "guardrail_fixed";

const normalizeWindowInput = (value: ReviewPackWindowInput) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid onboarding review pack window value: ${String(value)}`);
  }

  return date.toISOString();
};

const toPct = (numerator: number, denominator: number) =>
  denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;

const isEventInWindow = (event: OnboardingFunnelEvent, weekStart: string, weekEnd: string) =>
  event.ts >= weekStart && event.ts < weekEnd;

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;

const getGuardrailKey = (event: OnboardingFunnelEvent) => event.payload.guardrailId;

const getReviewSessionId = (event: OnboardingFunnelEvent) => event.payload.reviewSessionId;

const getOrCreateGuardrailAggregate = (
  aggregates: Map<string, GuardrailAggregate>,
  event: OnboardingFunnelEvent
) => {
  const guardrailId = getGuardrailKey(event);
  if (!isNonEmptyString(guardrailId)) {
    return null;
  }

  const existing = aggregates.get(guardrailId);
  if (existing) {
    return existing;
  }

  const created: GuardrailAggregate = {
    guardrailId,
    severity:
      (event.payload.guardrailSeverity as OnboardingGuardrailSeverity | undefined) ?? "unknown",
    category:
      (event.payload.guardrailCategory as OnboardingGuardrailCategory | undefined) ?? "unknown",
    targetStepId:
      (event.payload.targetStepId as OnboardingGuardrailStepId | undefined) ?? "unknown",
    targetSection:
      (event.payload.targetSection as OnboardingGuardrailSection | undefined) ?? "unknown",
    shownEventCount: 0,
    shownReviewSessions: new Set<string>(),
    fixedReviewSessions: new Set<string>(),
  };
  aggregates.set(guardrailId, created);
  return created;
};

const sortByShown = (left: ReviewPackGuardrailRow, right: ReviewPackGuardrailRow) =>
  right.shownReviewCount - left.shownReviewCount ||
  right.shownEventCount - left.shownEventCount ||
  left.guardrailId.localeCompare(right.guardrailId);

const sortByLowFixSuccess = (left: ReviewPackGuardrailRow, right: ReviewPackGuardrailRow) =>
  left.fixSuccessRate - right.fixSuccessRate ||
  right.shownReviewCount - left.shownReviewCount ||
  left.guardrailId.localeCompare(right.guardrailId);

const sortByReviewWithoutCompletion = (left: ReviewPackGuardrailRow, right: ReviewPackGuardrailRow) =>
  right.incompleteReviewCount - left.incompleteReviewCount ||
  right.incompleteShareOfShown - left.incompleteShareOfShown ||
  left.guardrailId.localeCompare(right.guardrailId);

export const buildOnboardingReviewPack = (
  events: OnboardingFunnelEvent[],
  { weekStart, weekEnd, locale, topN = 3 }: OnboardingReviewPackOptions
): OnboardingReviewPack => {
  const normalizedWeekStart = normalizeWindowInput(weekStart);
  const normalizedWeekEnd = normalizeWindowInput(weekEnd);

  const filteredEvents = events.filter((event) => {
    if (!isEventInWindow(event, normalizedWeekStart, normalizedWeekEnd)) {
      return false;
    }

    if (locale && event.payload.locale !== locale) {
      return false;
    }

    return true;
  });

  const reviews = new Map<string, ReviewMeta>();
  const completedReviewSessionIds = new Set<string>();
  const severityMix = {
    critical: 0,
    warning: 0,
    info: 0,
    total: 0,
  };
  const reviewSourceContextCounts: Record<OnboardingReviewSourceContext, number> = {
    initial_review: 0,
    returned_from_fix: 0,
  };
  const guardrailAggregates = new Map<string, GuardrailAggregate>();

  for (const event of filteredEvents) {
    const reviewSessionId = getReviewSessionId(event);

    if (event.name === REVIEW_EVENT && isNonEmptyString(reviewSessionId)) {
      reviews.set(reviewSessionId, { completed: false });

      if (event.payload.reviewSourceContext === "initial_review") {
        reviewSourceContextCounts.initial_review += 1;
      }
      if (event.payload.reviewSourceContext === "returned_from_fix") {
        reviewSourceContextCounts.returned_from_fix += 1;
      }

      severityMix.critical += Number(event.payload.criticalGuardrailCount ?? 0);
      severityMix.warning += Number(event.payload.warningGuardrailCount ?? 0);
      severityMix.info += Number(event.payload.infoGuardrailCount ?? 0);
      severityMix.total += Number(event.payload.guardrailCount ?? 0);
      continue;
    }

    if (event.name === COMPLETE_EVENT && isNonEmptyString(reviewSessionId) && reviews.has(reviewSessionId)) {
      reviews.set(reviewSessionId, { completed: true });
      completedReviewSessionIds.add(reviewSessionId);
      continue;
    }

    if (event.name === SHOWN_EVENT) {
      const aggregate = getOrCreateGuardrailAggregate(guardrailAggregates, event);
      if (!aggregate) {
        continue;
      }

      aggregate.shownEventCount += 1;
      if (isNonEmptyString(reviewSessionId) && reviews.has(reviewSessionId)) {
        aggregate.shownReviewSessions.add(reviewSessionId);
      }
      continue;
    }

    if (event.name === FIXED_EVENT) {
      const aggregate = getOrCreateGuardrailAggregate(guardrailAggregates, event);
      if (!aggregate) {
        continue;
      }

      if (isNonEmptyString(reviewSessionId) && reviews.has(reviewSessionId)) {
        aggregate.fixedReviewSessions.add(reviewSessionId);
      }
    }
  }

  const reviewSessionCount = reviews.size;
  const completedReviewSessionCount = completedReviewSessionIds.size;
  const reviewWithoutCompletionSessionCount = reviewSessionCount - completedReviewSessionCount;
  const reviewToCompletedConversionRate = toPct(completedReviewSessionCount, reviewSessionCount);
  const reviewWithoutCompletionRate = toPct(reviewWithoutCompletionSessionCount, reviewSessionCount);

  const guardrailRows = [...guardrailAggregates.values()].map<ReviewPackGuardrailRow>((aggregate) => {
    const shownReviewCount = aggregate.shownReviewSessions.size;
    const fixedReviewCount = aggregate.fixedReviewSessions.size;
    let incompleteReviewCount = 0;

    for (const reviewSessionId of aggregate.shownReviewSessions) {
      if (!completedReviewSessionIds.has(reviewSessionId)) {
        incompleteReviewCount += 1;
      }
    }

    return {
      guardrailId: aggregate.guardrailId,
      severity: aggregate.severity,
      category: aggregate.category,
      targetStepId: aggregate.targetStepId,
      targetSection: aggregate.targetSection,
      shownEventCount: aggregate.shownEventCount,
      shownReviewCount,
      shownRate: toPct(shownReviewCount, reviewSessionCount),
      fixedReviewCount,
      fixSuccessRate: toPct(fixedReviewCount, shownReviewCount),
      incompleteReviewCount,
      incompleteShareOfShown: toPct(incompleteReviewCount, shownReviewCount),
    };
  });

  return {
    window: {
      weekStart: normalizedWeekStart,
      weekEnd: normalizedWeekEnd,
    },
    locale: locale ?? "all",
    totals: {
      reviewSessionCount,
      completedReviewSessionCount,
      reviewToCompletedConversionRate,
      reviewWithoutCompletionSessionCount,
      reviewWithoutCompletionRate,
      severityMix: {
        ...severityMix,
        averagePerReview: Number((severityMix.total / Math.max(reviewSessionCount, 1)).toFixed(2)),
      },
      reviewSourceContextCounts,
    },
    sections: {
      topShownGuardrails: [...guardrailRows].sort(sortByShown).slice(0, topN),
      lowestFixSuccessGuardrails: [...guardrailRows]
        .filter((row) => row.shownReviewCount > 0)
        .sort(sortByLowFixSuccess)
        .slice(0, topN),
      reviewWithoutCompletionCandidates: [...guardrailRows]
        .filter((row) => row.incompleteReviewCount > 0)
        .sort(sortByReviewWithoutCompletion)
        .slice(0, topN),
    },
  };
};

const toTableRows = (rows: ReviewPackGuardrailRow[]) =>
  rows.map((row) => ({
    guardrailId: row.guardrailId,
    severity: row.severity,
    category: row.category,
    targetStepId: row.targetStepId,
    targetSection: row.targetSection,
    shownEventCount: row.shownEventCount,
    shownReviewCount: row.shownReviewCount,
    shownRatePct: row.shownRate,
    fixedReviewCount: row.fixedReviewCount,
    fixSuccessRatePct: row.fixSuccessRate,
    reviewWithoutCompletionCount: row.incompleteReviewCount,
    reviewWithoutCompletionPct: row.incompleteShareOfShown,
  }));

export const formatOnboardingReviewPackForExport = (
  pack: OnboardingReviewPack
): OnboardingReviewPackTableExport => ({
  summary: {
    locale: pack.locale,
    weekStart: pack.window.weekStart,
    weekEnd: pack.window.weekEnd,
    reviewSessions: pack.totals.reviewSessionCount,
    completedReviewSessions: pack.totals.completedReviewSessionCount,
    reviewToCompletedConversionPct: pack.totals.reviewToCompletedConversionRate,
    reviewWithoutCompletionSessions: pack.totals.reviewWithoutCompletionSessionCount,
    reviewWithoutCompletionPct: pack.totals.reviewWithoutCompletionRate,
    criticalGuardrailsShown: pack.totals.severityMix.critical,
    warningGuardrailsShown: pack.totals.severityMix.warning,
    infoGuardrailsShown: pack.totals.severityMix.info,
    totalGuardrailsShown: pack.totals.severityMix.total,
    averageGuardrailsPerReview: pack.totals.severityMix.averagePerReview,
    initialReviewSessions: pack.totals.reviewSourceContextCounts.initial_review,
    returnedFromFixSessions: pack.totals.reviewSourceContextCounts.returned_from_fix,
  },
  tables: {
    topShownGuardrails: toTableRows(pack.sections.topShownGuardrails),
    lowestFixSuccessGuardrails: toTableRows(pack.sections.lowestFixSuccessGuardrails),
    reviewWithoutCompletionCandidates: toTableRows(pack.sections.reviewWithoutCompletionCandidates),
  },
});
