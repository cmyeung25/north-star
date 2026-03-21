import type { MarketEntryEvent, MarketEntryEventName } from "./marketEntry";

type ReviewBoardWindowInput = string | Date;

type CohortDimension =
  | "journey"
  | "preset"
  | "locale"
  | "signed_in_state"
  | "journey_preset_pair"
  | "experiment_variant";

type ConversionDirection = "min" | "max";

type MarketEntryReviewBoardOptions = {
  weekStart: ReviewBoardWindowInput;
  weekEnd: ReviewBoardWindowInput;
  topN?: number;
};

type EventCounts = Record<MarketEntryEventName, number>;

export type MarketEntryKpiId =
  | "landing_to_journey_ctr"
  | "sample_journey_ctr"
  | "journey_to_preset_start_rate"
  | "preset_start_to_case_created_rate"
  | "preset_submit_to_onboarding_start_rate"
  | "case_created_to_onboarding_completed_drop";

export type MarketEntryReviewBoardStatus = "ok" | "observe" | "needs_attention";

export type MarketEntryReviewBoardKpi = {
  id: MarketEntryKpiId;
  numeratorEvent: MarketEntryEventName;
  denominatorEvent: MarketEntryEventName;
  valuePct: number;
  previousValuePct: number | null;
  deltaPctPoints: number | null;
  thresholdPct: number | null;
  direction: ConversionDirection;
  status: MarketEntryReviewBoardStatus;
  note: string;
};

export type MarketEntryReviewBoardCohortRow = {
  label: string;
  dimension: CohortDimension;
  journeyId: string | null;
  presetId: string | null;
  locale: string | null;
  isSignedIn: boolean | null;
  experimentSlotKey: string | null;
  experimentVariant: string | null;
  counts: EventCounts;
  rates: {
    landingToJourneyCtrPct: number;
    sampleJourneyCtrPct: number;
    journeyToPresetStartRatePct: number;
    presetStartToCaseCreatedRatePct: number;
    presetSubmitToOnboardingStartRatePct: number;
    caseCreatedToOnboardingCompletedDropPct: number;
  };
  confidence: {
    journeyClicks: "enough_support" | "directional_only";
    sampleJourneyImpressions: "enough_support" | "directional_only";
    caseCreated: "enough_support" | "directional_only";
  };
};

export type MarketEntryReviewBoard = {
  window: {
    weekStart: string;
    weekEnd: string;
  };
  previousWindow: {
    weekStart: string;
    weekEnd: string;
  };
  summary: {
    totals: EventCounts;
    signedInOnboardingCompletionRatePct: number;
    signedOutOnboardingCompletionRatePct: number;
    signedInVsSignedOutCompletionDeltaPctPoints: number | null;
  };
  checks: {
    localeSkew: {
      dominantLocale: string | null;
      dominantSharePct: number;
      status: MarketEntryReviewBoardStatus;
      note: string;
    };
    experimentCoverage: {
      attributedJourneyClicks: number;
      totalJourneyClicks: number;
      coveragePct: number;
      status: MarketEntryReviewBoardStatus;
      note: string;
    };
  };
  kpis: MarketEntryReviewBoardKpi[];
  cohorts: {
    journey: MarketEntryReviewBoardCohortRow[];
    preset: MarketEntryReviewBoardCohortRow[];
    locale: MarketEntryReviewBoardCohortRow[];
    signedInState: MarketEntryReviewBoardCohortRow[];
    journeyPresetPair: MarketEntryReviewBoardCohortRow[];
    experimentVariant: MarketEntryReviewBoardCohortRow[];
  };
  topDropOffJourneyPresetPairs: MarketEntryReviewBoardCohortRow[];
  decision: {
    status: "hold" | "fix_before_scale" | "ready_to_scale_traffic";
    note: string;
  };
};

export type MarketEntryReviewBoardExport = {
  summary: {
    weekStart: string;
    weekEnd: string;
    previousWeekStart: string;
    previousWeekEnd: string;
    marketLandingViews: number;
    sampleJourneyImpressions: number;
    journeyClicks: number;
    presetCreateStarted: number;
    presetCreateSubmitted: number;
    caseCreated: number;
    onboardingStarted: number;
    onboardingCompleted: number;
    signedInOnboardingCompletionRatePct: number;
    signedOutOnboardingCompletionRatePct: number;
    signedInVsSignedOutCompletionDeltaPctPoints: number | null;
    localeSkewDominantLocale: string | null;
    localeSkewDominantSharePct: number;
    experimentCoveragePct: number;
    decision: MarketEntryReviewBoard["decision"]["status"];
  };
  kpis: Array<Record<string, number | string | null>>;
  cohorts: {
    journey: Array<Record<string, number | string | null>>;
    preset: Array<Record<string, number | string | null>>;
    locale: Array<Record<string, number | string | null>>;
    signedInState: Array<Record<string, number | string | null>>;
    journeyPresetPair: Array<Record<string, number | string | null>>;
    experimentVariant: Array<Record<string, number | string | null>>;
  };
};


const KPI_CONFIG: Array<{
  id: MarketEntryKpiId;
  numeratorEvent: MarketEntryEventName;
  denominatorEvent: MarketEntryEventName;
  thresholdPct: number | null;
  direction: ConversionDirection;
  note: string;
}> = [
  {
    id: "landing_to_journey_ctr",
    numeratorEvent: "journey_cta_click",
    denominatorEvent: "market_landing_view",
    thresholdPct: 12,
    direction: "min",
    note: "Roadmap publishability threshold for public-entry clarity.",
  },
  {
    id: "sample_journey_ctr",
    numeratorEvent: "journey_cta_click",
    denominatorEvent: "sample_journey_impression",
    thresholdPct: null,
    direction: "min",
    note: "Directional sample-journey card effectiveness; interpret with impression support warnings.",
  },
  {
    id: "journey_to_preset_start_rate",
    numeratorEvent: "preset_create_started",
    denominatorEvent: "journey_cta_click",
    thresholdPct: null,
    direction: "min",
    note: "Checks whether the journey + preset handoff still opens the intended member create flow.",
  },
  {
    id: "preset_start_to_case_created_rate",
    numeratorEvent: "case_created",
    denominatorEvent: "preset_create_started",
    thresholdPct: 35,
    direction: "min",
    note: "Uses the roadmap case-creation conversion threshold as a minimum health floor.",
  },
  {
    id: "preset_submit_to_onboarding_start_rate",
    numeratorEvent: "onboarding_started",
    denominatorEvent: "preset_create_submitted",
    thresholdPct: 85,
    direction: "min",
    note: "Roadmap onboarding start-rate threshold for member create → onboarding handoff.",
  },
  {
    id: "case_created_to_onboarding_completed_drop",
    numeratorEvent: "onboarding_completed",
    denominatorEvent: "case_created",
    thresholdPct: 25,
    direction: "max",
    note: "Roadmap maximum allowed drop between case creation and onboarding completion.",
  },
];

const emptyCounts = (): EventCounts => ({
  market_landing_view: 0,
  sample_journey_impression: 0,
  journey_cta_click: 0,
  auth_modal_open: 0,
  case_created: 0,
  preset_create_started: 0,
  preset_create_submitted: 0,
  onboarding_started: 0,
  onboarding_completed: 0,
});

const normalizeWindowInput = (value: ReviewBoardWindowInput) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid market-entry review board window value: ${String(value)}`);
  }

  return date.toISOString();
};

const toPct = (numerator: number, denominator: number) =>
  denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(1)) : 0;

const toDropPct = (completedCount: number, caseCreatedCount: number) =>
  caseCreatedCount > 0 ? Number((100 - (completedCount / caseCreatedCount) * 100).toFixed(1)) : 0;

const isEventInWindow = (event: MarketEntryEvent, weekStart: string, weekEnd: string) =>
  event.ts >= weekStart && event.ts < weekEnd;

const buildPreviousWindow = (weekStart: string, weekEnd: string) => {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  const durationMs = end.getTime() - start.getTime();

  return {
    weekStart: new Date(start.getTime() - durationMs).toISOString(),
    weekEnd: weekStart,
  };
};

const incrementCount = (counts: EventCounts, name: MarketEntryEventName) => {
  counts[name] += 1;
};

const createBaseRow = (
  label: string,
  dimension: CohortDimension,
  sample: Partial<Omit<MarketEntryReviewBoardCohortRow, "label" | "dimension" | "counts" | "rates" | "confidence">>,
): MarketEntryReviewBoardCohortRow => ({
  label,
  dimension,
  journeyId: sample.journeyId ?? null,
  presetId: sample.presetId ?? null,
  locale: sample.locale ?? null,
  isSignedIn: sample.isSignedIn ?? null,
  experimentSlotKey: sample.experimentSlotKey ?? null,
  experimentVariant: sample.experimentVariant ?? null,
  counts: emptyCounts(),
  rates: {
    landingToJourneyCtrPct: 0,
    sampleJourneyCtrPct: 0,
    journeyToPresetStartRatePct: 0,
    presetStartToCaseCreatedRatePct: 0,
    presetSubmitToOnboardingStartRatePct: 0,
    caseCreatedToOnboardingCompletedDropPct: 0,
  },
  confidence: {
    journeyClicks: "directional_only",
    sampleJourneyImpressions: "directional_only",
    caseCreated: "directional_only",
  },
});

const finalizeRow = (row: MarketEntryReviewBoardCohortRow): MarketEntryReviewBoardCohortRow => ({
  ...row,
  rates: {
    landingToJourneyCtrPct: toPct(row.counts.journey_cta_click, row.counts.market_landing_view),
    sampleJourneyCtrPct: toPct(row.counts.journey_cta_click, row.counts.sample_journey_impression),
    journeyToPresetStartRatePct: toPct(row.counts.preset_create_started, row.counts.journey_cta_click),
    presetStartToCaseCreatedRatePct: toPct(row.counts.case_created, row.counts.preset_create_started),
    presetSubmitToOnboardingStartRatePct: toPct(
      row.counts.onboarding_started,
      row.counts.preset_create_submitted,
    ),
    caseCreatedToOnboardingCompletedDropPct: toDropPct(
      row.counts.onboarding_completed,
      row.counts.case_created,
    ),
  },
  confidence: {
    journeyClicks: row.counts.journey_cta_click >= 30 ? "enough_support" : "directional_only",
    sampleJourneyImpressions:
      row.counts.sample_journey_impression >= 50 ? "enough_support" : "directional_only",
    caseCreated: row.counts.case_created >= 20 ? "enough_support" : "directional_only",
  },
});

const sortRows = (rows: MarketEntryReviewBoardCohortRow[]) =>
  rows
    .map(finalizeRow)
    .sort(
      (left, right) =>
        right.counts.journey_cta_click - left.counts.journey_cta_click ||
        right.counts.case_created - left.counts.case_created ||
        left.label.localeCompare(right.label),
    );

const buildCountsForWindow = (events: MarketEntryEvent[], weekStart: string, weekEnd: string) => {
  const counts = emptyCounts();
  events.filter((event) => isEventInWindow(event, weekStart, weekEnd)).forEach((event) => {
    incrementCount(counts, event.name);
  });
  return counts;
};

const buildKpis = (
  currentCounts: EventCounts,
  previousCounts: EventCounts,
): MarketEntryReviewBoardKpi[] =>
  KPI_CONFIG.map((config) => {
    const currentValue =
      config.id === "case_created_to_onboarding_completed_drop"
        ? toDropPct(currentCounts[config.numeratorEvent], currentCounts[config.denominatorEvent])
        : toPct(currentCounts[config.numeratorEvent], currentCounts[config.denominatorEvent]);
    const previousValue =
      previousCounts[config.denominatorEvent] > 0 || previousCounts[config.numeratorEvent] > 0
        ? config.id === "case_created_to_onboarding_completed_drop"
          ? toDropPct(previousCounts[config.numeratorEvent], previousCounts[config.denominatorEvent])
          : toPct(previousCounts[config.numeratorEvent], previousCounts[config.denominatorEvent])
        : null;
    const delta = previousValue === null ? null : Number((currentValue - previousValue).toFixed(1));

    const status: MarketEntryReviewBoardStatus =
      config.thresholdPct === null
        ? "observe"
        : config.direction === "min"
          ? currentValue >= config.thresholdPct
            ? "ok"
            : currentCounts[config.denominatorEvent] > 0
              ? "needs_attention"
              : "observe"
          : currentValue <= config.thresholdPct
            ? "ok"
            : currentCounts[config.denominatorEvent] > 0
              ? "needs_attention"
              : "observe";

    return {
      id: config.id,
      numeratorEvent: config.numeratorEvent,
      denominatorEvent: config.denominatorEvent,
      valuePct: currentValue,
      previousValuePct: previousValue,
      deltaPctPoints: delta,
      thresholdPct: config.thresholdPct,
      direction: config.direction,
      status,
      note: config.note,
    };
  });

const buildCohortRows = (
  events: MarketEntryEvent[],
  weekStart: string,
  weekEnd: string,
  topN: number,
) => {
  const filteredEvents = events.filter((event) => isEventInWindow(event, weekStart, weekEnd));
  const journeyRows = new Map<string, MarketEntryReviewBoardCohortRow>();
  const presetRows = new Map<string, MarketEntryReviewBoardCohortRow>();
  const localeRows = new Map<string, MarketEntryReviewBoardCohortRow>();
  const signedInRows = new Map<string, MarketEntryReviewBoardCohortRow>();
  const journeyPresetPairRows = new Map<string, MarketEntryReviewBoardCohortRow>();
  const experimentVariantRows = new Map<string, MarketEntryReviewBoardCohortRow>();

  filteredEvents.forEach((event) => {
    const { journeyId, presetId, locale, isSignedIn, experimentSlotKey, experimentVariant } = event.payload;

    if (journeyId) {
      const key = journeyId;
      const row =
        journeyRows.get(key) ?? createBaseRow(key, "journey", { journeyId, locale: null, isSignedIn: null });
      incrementCount(row.counts, event.name);
      journeyRows.set(key, row);
    }

    if (presetId) {
      const key = presetId;
      const row = presetRows.get(key) ?? createBaseRow(key, "preset", { presetId });
      incrementCount(row.counts, event.name);
      presetRows.set(key, row);
    }

    const localeKey = locale ?? "unknown";
    const localeRow = localeRows.get(localeKey) ?? createBaseRow(localeKey, "locale", { locale: locale ?? null });
    incrementCount(localeRow.counts, event.name);
    localeRows.set(localeKey, localeRow);

    const signedInKey = isSignedIn ? "signed_in" : "signed_out";
    const signedInRow =
      signedInRows.get(signedInKey) ??
      createBaseRow(signedInKey, "signed_in_state", { isSignedIn });
    incrementCount(signedInRow.counts, event.name);
    signedInRows.set(signedInKey, signedInRow);

    if (journeyId || presetId) {
      const pairKey = `${journeyId ?? "unknown"} → ${presetId ?? "blank"}`;
      const row =
        journeyPresetPairRows.get(pairKey) ??
        createBaseRow(pairKey, "journey_preset_pair", { journeyId, presetId });
      incrementCount(row.counts, event.name);
      journeyPresetPairRows.set(pairKey, row);
    }

    if (experimentSlotKey || experimentVariant) {
      const key = `${experimentSlotKey ?? "no_slot"} / ${experimentVariant ?? "no_variant"}`;
      const row =
        experimentVariantRows.get(key) ??
        createBaseRow(key, "experiment_variant", {
          experimentSlotKey: experimentSlotKey ?? null,
          experimentVariant: experimentVariant ?? null,
          journeyId,
          presetId,
        });
      incrementCount(row.counts, event.name);
      experimentVariantRows.set(key, row);
    }
  });

  return {
    journey: sortRows([...journeyRows.values()]).slice(0, topN),
    preset: sortRows([...presetRows.values()]).slice(0, topN),
    locale: sortRows([...localeRows.values()]).slice(0, topN),
    signedInState: sortRows([...signedInRows.values()]).slice(0, topN),
    journeyPresetPair: sortRows([...journeyPresetPairRows.values()]).slice(0, topN),
    experimentVariant: sortRows([...experimentVariantRows.values()]).slice(0, topN),
  };
};

const buildDecision = (
  currentKpis: MarketEntryReviewBoardKpi[],
  previousKpis: MarketEntryReviewBoardKpi[],
  checks: MarketEntryReviewBoard["checks"],
) => {
  const currentThresholdBreaches = currentKpis.filter((kpi) => kpi.status === "needs_attention");
  const previousThresholdBreaches = previousKpis.filter((kpi) => kpi.status === "needs_attention");

  if (
    currentThresholdBreaches.length === 0 &&
    previousThresholdBreaches.length === 0 &&
    checks.localeSkew.status !== "needs_attention" &&
    checks.experimentCoverage.status !== "needs_attention"
  ) {
    return {
      status: "ready_to_scale_traffic" as const,
      note:
        "Current and previous weekly windows both satisfy the fixed publishability thresholds, and no coverage blocker is visible in locale skew or experiment attribution.",
    };
  }

  if (currentThresholdBreaches.length > 0) {
    return {
      status: "fix_before_scale" as const,
      note:
        "At least one current-week KPI is below its fixed threshold. Hold scale plans until copy, IA, or handoff fixes are reviewed against this board.",
    };
  }

  return {
    status: "hold" as const,
    note:
      "Thresholds are not actively broken this week, but the previous week or coverage checks still lack enough confidence for a scale decision.",
  };
};

export const buildMarketEntryReviewBoard = (
  events: MarketEntryEvent[],
  { weekStart, weekEnd, topN = 10 }: MarketEntryReviewBoardOptions,
): MarketEntryReviewBoard => {
  const normalizedWeekStart = normalizeWindowInput(weekStart);
  const normalizedWeekEnd = normalizeWindowInput(weekEnd);
  const previousWindow = buildPreviousWindow(normalizedWeekStart, normalizedWeekEnd);
  const currentCounts = buildCountsForWindow(events, normalizedWeekStart, normalizedWeekEnd);
  const previousCounts = buildCountsForWindow(events, previousWindow.weekStart, previousWindow.weekEnd);
  const kpis = buildKpis(currentCounts, previousCounts);
  const previousKpis = buildKpis(previousCounts, emptyCounts());
  const cohorts = buildCohortRows(events, normalizedWeekStart, normalizedWeekEnd, topN);

  const localeRows = cohorts.locale;
  const dominantLocale = localeRows[0] ?? null;
  const localeSharePct = dominantLocale
    ? toPct(dominantLocale.counts.market_landing_view, currentCounts.market_landing_view)
    : 0;
  const attributedJourneyClicks = events.filter(
    (event) =>
      isEventInWindow(event, normalizedWeekStart, normalizedWeekEnd) &&
      event.name === "journey_cta_click" &&
      typeof event.payload.experimentSlotKey === "string" &&
      typeof event.payload.experimentVariant === "string",
  ).length;
  const experimentCoveragePct = toPct(attributedJourneyClicks, currentCounts.journey_cta_click);

  const checks: MarketEntryReviewBoard["checks"] = {
    localeSkew: {
      dominantLocale: dominantLocale?.locale ?? null,
      dominantSharePct: localeSharePct,
      status:
        currentCounts.market_landing_view === 0
          ? "needs_attention"
          : localeSharePct > 70
            ? "observe"
            : "ok",
      note:
        currentCounts.market_landing_view === 0
          ? "No landing views were recorded in the review window. Treat this as a traffic or instrumentation blocker."
          : localeSharePct > 70
            ? `Locale skew warning: ${dominantLocale?.locale ?? "unknown"} accounts for ${localeSharePct}% of landing views.`
            : "No locale exceeds the 70% skew warning threshold in the current review window.",
    },
    experimentCoverage: {
      attributedJourneyClicks,
      totalJourneyClicks: currentCounts.journey_cta_click,
      coveragePct: experimentCoveragePct,
      status:
        currentCounts.journey_cta_click === 0
          ? "observe"
          : experimentCoveragePct >= 90
            ? "ok"
            : "needs_attention",
      note:
        currentCounts.journey_cta_click === 0
          ? "No journey CTA clicks were recorded, so experiment-slot attribution could not be reviewed this week."
          : experimentCoveragePct >= 90
            ? "Experiment slot metadata is attached to at least 90% of journey clicks in the current window."
            : "Experiment slot attribution is incomplete for the current window; do not run copy-rollout decisions without checking this instrumentation gap.",
    },
  };

  const signedInRow = cohorts.signedInState.find((row) => row.isSignedIn === true) ?? null;
  const signedOutRow = cohorts.signedInState.find((row) => row.isSignedIn === false) ?? null;
  const signedInOnboardingCompletionRatePct = signedInRow
    ? toPct(signedInRow.counts.onboarding_completed, signedInRow.counts.case_created)
    : 0;
  const signedOutOnboardingCompletionRatePct = signedOutRow
    ? toPct(signedOutRow.counts.onboarding_completed, signedOutRow.counts.case_created)
    : 0;
  const signedInVsSignedOutCompletionDeltaPctPoints =
    signedInRow && signedOutRow && signedInRow.counts.case_created > 0 && signedOutRow.counts.case_created > 0
      ? Number((signedInOnboardingCompletionRatePct - signedOutOnboardingCompletionRatePct).toFixed(1))
      : null;

  return {
    window: {
      weekStart: normalizedWeekStart,
      weekEnd: normalizedWeekEnd,
    },
    previousWindow,
    summary: {
      totals: currentCounts,
      signedInOnboardingCompletionRatePct,
      signedOutOnboardingCompletionRatePct,
      signedInVsSignedOutCompletionDeltaPctPoints,
    },
    checks,
    kpis,
    cohorts,
    topDropOffJourneyPresetPairs: cohorts.journeyPresetPair
      .slice()
      .sort(
        (left, right) =>
          right.rates.caseCreatedToOnboardingCompletedDropPct -
            left.rates.caseCreatedToOnboardingCompletedDropPct ||
          right.counts.case_created - left.counts.case_created ||
          left.label.localeCompare(right.label),
      )
      .slice(0, topN),
    decision: buildDecision(kpis, previousKpis, checks),
  };
};

const formatCohortRow = (row: MarketEntryReviewBoardCohortRow) => ({
  label: row.label,
  dimension: row.dimension,
  journeyId: row.journeyId,
  presetId: row.presetId,
  locale: row.locale,
  isSignedIn: row.isSignedIn === null ? null : String(row.isSignedIn),
  experimentSlotKey: row.experimentSlotKey,
  experimentVariant: row.experimentVariant,
  marketLandingViews: row.counts.market_landing_view,
  sampleJourneyImpressions: row.counts.sample_journey_impression,
  journeyClicks: row.counts.journey_cta_click,
  presetCreateStarted: row.counts.preset_create_started,
  presetCreateSubmitted: row.counts.preset_create_submitted,
  caseCreated: row.counts.case_created,
  onboardingStarted: row.counts.onboarding_started,
  onboardingCompleted: row.counts.onboarding_completed,
  landingToJourneyCtrPct: row.rates.landingToJourneyCtrPct,
  sampleJourneyCtrPct: row.rates.sampleJourneyCtrPct,
  journeyToPresetStartRatePct: row.rates.journeyToPresetStartRatePct,
  presetStartToCaseCreatedRatePct: row.rates.presetStartToCaseCreatedRatePct,
  presetSubmitToOnboardingStartRatePct: row.rates.presetSubmitToOnboardingStartRatePct,
  caseCreatedToOnboardingCompletedDropPct: row.rates.caseCreatedToOnboardingCompletedDropPct,
  journeyClicksConfidence: row.confidence.journeyClicks,
  sampleJourneyImpressionsConfidence: row.confidence.sampleJourneyImpressions,
  caseCreatedConfidence: row.confidence.caseCreated,
});

export const formatMarketEntryReviewBoardForExport = (
  board: MarketEntryReviewBoard,
): MarketEntryReviewBoardExport => ({
  summary: {
    weekStart: board.window.weekStart,
    weekEnd: board.window.weekEnd,
    previousWeekStart: board.previousWindow.weekStart,
    previousWeekEnd: board.previousWindow.weekEnd,
    marketLandingViews: board.summary.totals.market_landing_view,
    sampleJourneyImpressions: board.summary.totals.sample_journey_impression,
    journeyClicks: board.summary.totals.journey_cta_click,
    presetCreateStarted: board.summary.totals.preset_create_started,
    presetCreateSubmitted: board.summary.totals.preset_create_submitted,
    caseCreated: board.summary.totals.case_created,
    onboardingStarted: board.summary.totals.onboarding_started,
    onboardingCompleted: board.summary.totals.onboarding_completed,
    signedInOnboardingCompletionRatePct: board.summary.signedInOnboardingCompletionRatePct,
    signedOutOnboardingCompletionRatePct: board.summary.signedOutOnboardingCompletionRatePct,
    signedInVsSignedOutCompletionDeltaPctPoints:
      board.summary.signedInVsSignedOutCompletionDeltaPctPoints,
    localeSkewDominantLocale: board.checks.localeSkew.dominantLocale,
    localeSkewDominantSharePct: board.checks.localeSkew.dominantSharePct,
    experimentCoveragePct: board.checks.experimentCoverage.coveragePct,
    decision: board.decision.status,
  },
  kpis: board.kpis.map((kpi) => ({
    id: kpi.id,
    numeratorEvent: kpi.numeratorEvent,
    denominatorEvent: kpi.denominatorEvent,
    valuePct: kpi.valuePct,
    previousValuePct: kpi.previousValuePct,
    deltaPctPoints: kpi.deltaPctPoints,
    thresholdPct: kpi.thresholdPct,
    direction: kpi.direction,
    status: kpi.status,
    note: kpi.note,
  })),
  cohorts: {
    journey: board.cohorts.journey.map(formatCohortRow),
    preset: board.cohorts.preset.map(formatCohortRow),
    locale: board.cohorts.locale.map(formatCohortRow),
    signedInState: board.cohorts.signedInState.map(formatCohortRow),
    journeyPresetPair: board.cohorts.journeyPresetPair.map(formatCohortRow),
    experimentVariant: board.cohorts.experimentVariant.map(formatCohortRow),
  },
});
