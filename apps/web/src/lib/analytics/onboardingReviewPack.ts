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

export type ReviewPackGuardrailRow = {
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

export const ONBOARDING_WEEKLY_REVIEW_PRIORITY_GUARDRAILS = [
  "property_usage_missing",
  "duplicate_current_home_housing_costs",
  "duplicate_rent_expense_inputs",
  "mortgage_property_basics_missing",
] as const;

export type OnboardingWeeklyReviewPriorityGuardrailId =
  (typeof ONBOARDING_WEEKLY_REVIEW_PRIORITY_GUARDRAILS)[number];

export type OnboardingWeeklyReviewAction =
  | "monitor"
  | "rewrite_copy_and_action_hint"
  | "clarify_target_step_and_section"
  | "consider_severity_review_if_baseline_risk_persists"
  | "observation_only_sample_too_small";

export type OnboardingWeeklyReviewStatus = "ok" | "observe" | "needs_attention";

export type OnboardingWeeklyReviewFocusRow = ReviewPackGuardrailRow & {
  reviewSampleStatus: "enough_support" | "observation_only";
  recommendedAction: OnboardingWeeklyReviewAction;
};

export type OnboardingWeeklyReviewWorkflow = {
  window: {
    weekStart: string;
    weekEnd: string;
  };
  aggregatePack: OnboardingReviewPack;
  localePacks: OnboardingReviewPack[];
  checks: {
    reviewSampleSize: {
      reviewSessionCount: number;
      status: OnboardingWeeklyReviewStatus;
      note: string;
    };
    localeBias: {
      dominantLocale: string | null;
      dominantSharePct: number;
      status: OnboardingWeeklyReviewStatus;
      note: string;
    };
    personaPresetJourneyBias: {
      status: "requires_external_review";
      note: string;
    };
  };
  focusGuardrails: OnboardingWeeklyReviewFocusRow[];
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

const buildGuardrailRows = (
  guardrailAggregates: Map<string, GuardrailAggregate>,
  completedReviewSessionIds: Set<string>,
  reviewSessionCount: number
): ReviewPackGuardrailRow[] =>
  [...guardrailAggregates.values()].map<ReviewPackGuardrailRow>((aggregate) => {
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

const getPriorityGuardrailAction = (row: ReviewPackGuardrailRow): OnboardingWeeklyReviewAction => {
  if (row.shownReviewCount < 5) {
    return "observation_only_sample_too_small";
  }

  if (row.shownRate >= 30 && row.fixSuccessRate < 40 && row.incompleteShareOfShown >= 50) {
    return "rewrite_copy_and_action_hint";
  }

  if (row.shownRate >= 20 && row.fixSuccessRate < 60) {
    return "clarify_target_step_and_section";
  }

  if (row.fixSuccessRate < 40 && row.incompleteShareOfShown >= 60) {
    return "consider_severity_review_if_baseline_risk_persists";
  }

  return "monitor";
};

export const getPreviousFullWeekWindow = (
  now: ReviewPackWindowInput,
  weekStartsOn: "monday" | "sunday" = "monday"
) => {
  const date = new Date(normalizeWindowInput(now));
  const utcDay = date.getUTCDay();
  const offsetToCurrentWeekStart =
    weekStartsOn === "monday" ? (utcDay + 6) % 7 : utcDay;

  const currentWeekStart = new Date(date);
  currentWeekStart.setUTCHours(0, 0, 0, 0);
  currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - offsetToCurrentWeekStart);

  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);

  return {
    weekStart: previousWeekStart.toISOString(),
    weekEnd: currentWeekStart.toISOString(),
  };
};

export const buildOnboardingWeeklyReviewWorkflow = (
  events: OnboardingFunnelEvent[],
  {
    weekStart,
    weekEnd,
    locales = [],
    focusGuardrailIds = [...ONBOARDING_WEEKLY_REVIEW_PRIORITY_GUARDRAILS],
    topN = 10,
  }: {
    weekStart: ReviewPackWindowInput;
    weekEnd: ReviewPackWindowInput;
    locales?: string[];
    focusGuardrailIds?: readonly string[];
    topN?: number;
  }
): OnboardingWeeklyReviewWorkflow => {
  const packTopN = Math.max(topN, events.length, focusGuardrailIds.length);
  const aggregatePack = buildOnboardingReviewPack(events, {
    weekStart,
    weekEnd,
    topN: packTopN,
  });
  const localePacks = locales.map((locale) =>
    buildOnboardingReviewPack(events, {
      weekStart,
      weekEnd,
      locale,
      topN: packTopN,
    })
  );

  const localeShareRows = localePacks
    .filter((pack) => pack.totals.reviewSessionCount > 0)
    .map((pack) => ({
      locale: pack.locale,
      reviewSessionCount: pack.totals.reviewSessionCount,
      sharePct: toPct(pack.totals.reviewSessionCount, aggregatePack.totals.reviewSessionCount),
    }))
    .sort((left, right) => right.reviewSessionCount - left.reviewSessionCount);

  const dominantLocale = localeShareRows[0] ?? null;
  const focusGuardrailRows = new Map(
    [
      ...aggregatePack.sections.topShownGuardrails,
      ...aggregatePack.sections.lowestFixSuccessGuardrails,
      ...aggregatePack.sections.reviewWithoutCompletionCandidates,
    ].map((row) => [row.guardrailId, row] as const)
  );

  const focusGuardrails = focusGuardrailIds.map<OnboardingWeeklyReviewFocusRow>((guardrailId) => {
    const existingRow: ReviewPackGuardrailRow = focusGuardrailRows.get(guardrailId) ?? {
      guardrailId,
      severity: "unknown",
      category: "unknown",
      targetStepId: "unknown",
      targetSection: "unknown",
      shownEventCount: 0,
      shownReviewCount: 0,
      shownRate: 0,
      fixedReviewCount: 0,
      fixSuccessRate: 0,
      incompleteReviewCount: 0,
      incompleteShareOfShown: 0,
    };

    return {
      ...existingRow,
      reviewSampleStatus:
        existingRow.shownReviewCount >= 5 ? "enough_support" : "observation_only",
      recommendedAction: getPriorityGuardrailAction(existingRow),
    };
  });

  return {
    window: aggregatePack.window,
    aggregatePack,
    localePacks,
    checks: {
      reviewSampleSize: {
        reviewSessionCount: aggregatePack.totals.reviewSessionCount,
        status:
          aggregatePack.totals.reviewSessionCount >= 20
            ? "ok"
            : aggregatePack.totals.reviewSessionCount > 0
              ? "observe"
              : "needs_attention",
        note:
          aggregatePack.totals.reviewSessionCount >= 20
            ? "Enough review sessions to compare week-over-week, but still validate focused guardrails against shown-review support."
            : aggregatePack.totals.reviewSessionCount > 0
              ? "Directional only: fewer than 20 review sessions in the weekly window. Do not turn this into product policy yet."
              : "No onboarding review sessions were recorded in the weekly window. Treat this as an instrumentation or traffic-readiness blocker."
      },
      localeBias: {
        dominantLocale: dominantLocale?.locale === "all" ? null : (dominantLocale?.locale ?? null),
        dominantSharePct: dominantLocale?.sharePct ?? 0,
        status:
          dominantLocale && dominantLocale.sharePct > 70
            ? "observe"
            : aggregatePack.totals.reviewSessionCount === 0
              ? "needs_attention"
              : "ok",
        note:
          dominantLocale && dominantLocale.sharePct > 70
            ? `Locale skew warning: ${dominantLocale.locale} accounts for ${dominantLocale.sharePct}% of review sessions. Read aggregate guardrail rankings as cohort-specific until another locale catches up.`
            : aggregatePack.totals.reviewSessionCount === 0
              ? "Locale bias cannot be reviewed because there are no onboarding review sessions in the window."
              : "No locale exceeds the 70% skew warning threshold for this weekly window."
      },
      personaPresetJourneyBias: {
        status: "requires_external_review",
        note:
          "Persona / preset / journey distortion cannot be inferred from onboarding review-pack events because the metadata-only allowlist excludes those fields. Cross-check the same week against the market-entry review ritual before treating a high-show or low-fix rule as a product decision."
      },
    },
    focusGuardrails,
  };
};

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

  const guardrailRows = buildGuardrailRows(guardrailAggregates, completedReviewSessionIds, reviewSessionCount);

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
