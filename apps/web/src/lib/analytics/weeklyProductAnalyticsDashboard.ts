import type { MarketEntryEvent } from "./marketEntry";
import {
  buildMarketEntryReviewBoard,
  formatMarketEntryReviewBoardForExport,
  type MarketEntryReviewBoard,
} from "./marketEntryReviewBoard";
import type { OnboardingFunnelEvent } from "./onboardingFunnel";
import {
  buildOnboardingWeeklyReviewWorkflow,
  formatOnboardingReviewPackForExport,
  getPreviousFullWeekWindow,
  type OnboardingWeeklyReviewWorkflow,
} from "./onboardingReviewPack";

type WeeklyProductAnalyticsDashboardInput = {
  onboardingEvents: OnboardingFunnelEvent[];
  marketEntryEvents: MarketEntryEvent[];
  now?: string | Date;
  locales?: string[];
  topN?: number;
};

export type WeeklyProductAnalyticsDashboard = {
  generatedAt: string;
  window: {
    weekStart: string;
    weekEnd: string;
  };
  onboarding: OnboardingWeeklyReviewWorkflow;
  marketEntry: MarketEntryReviewBoard;
};

const escapeCsvCell = (value: number | string | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
};

const tableToCsv = (title: string, rows: Array<Record<string, number | string | null>>) => {
  if (rows.length === 0) {
    return `${title}\nempty\n`;
  }

  const columns = Object.keys(rows[0]);
  const lines = [title, columns.join(",")];
  rows.forEach((row) => {
    lines.push(columns.map((column) => escapeCsvCell(row[column])).join(","));
  });
  return `${lines.join("\n")}\n`;
};

export const buildWeeklyProductAnalyticsDashboard = ({
  onboardingEvents,
  marketEntryEvents,
  now = new Date(),
  locales = ["en", "zh-HK"],
  topN = 10,
}: WeeklyProductAnalyticsDashboardInput): WeeklyProductAnalyticsDashboard => {
  const window = getPreviousFullWeekWindow(now);

  return {
    generatedAt: new Date().toISOString(),
    window,
    onboarding: buildOnboardingWeeklyReviewWorkflow(onboardingEvents, {
      weekStart: window.weekStart,
      weekEnd: window.weekEnd,
      locales,
      topN,
    }),
    marketEntry: buildMarketEntryReviewBoard(marketEntryEvents, {
      weekStart: window.weekStart,
      weekEnd: window.weekEnd,
      topN,
    }),
  };
};

export const formatWeeklyProductAnalyticsDashboardForExport = (
  dashboard: WeeklyProductAnalyticsDashboard,
) => ({
  generatedAt: dashboard.generatedAt,
  window: dashboard.window,
  onboarding: {
    workflow: dashboard.onboarding,
    aggregatePack: formatOnboardingReviewPackForExport(dashboard.onboarding.aggregatePack),
    localePacks: dashboard.onboarding.localePacks.map((pack) => formatOnboardingReviewPackForExport(pack)),
  },
  marketEntry: formatMarketEntryReviewBoardForExport(dashboard.marketEntry),
});

export const formatWeeklyProductAnalyticsDashboardAsCsv = (
  dashboard: WeeklyProductAnalyticsDashboard,
) => {
  const exportPayload = formatWeeklyProductAnalyticsDashboardForExport(dashboard);
  const sections: string[] = [];

  sections.push(
    tableToCsv("onboarding_summary", [exportPayload.onboarding.aggregatePack.summary]),
    tableToCsv("onboarding_top_shown_guardrails", exportPayload.onboarding.aggregatePack.tables.topShownGuardrails),
    tableToCsv(
      "onboarding_lowest_fix_success_guardrails",
      exportPayload.onboarding.aggregatePack.tables.lowestFixSuccessGuardrails,
    ),
    tableToCsv(
      "onboarding_review_without_completion_candidates",
      exportPayload.onboarding.aggregatePack.tables.reviewWithoutCompletionCandidates,
    ),
    tableToCsv("market_entry_summary", [exportPayload.marketEntry.summary]),
    tableToCsv("market_entry_kpis", exportPayload.marketEntry.kpis),
    tableToCsv("market_entry_journey_cohorts", exportPayload.marketEntry.cohorts.journey),
    tableToCsv("market_entry_preset_cohorts", exportPayload.marketEntry.cohorts.preset),
    tableToCsv("market_entry_locale_cohorts", exportPayload.marketEntry.cohorts.locale),
    tableToCsv("market_entry_signed_in_state_cohorts", exportPayload.marketEntry.cohorts.signedInState),
    tableToCsv("market_entry_journey_preset_pair_cohorts", exportPayload.marketEntry.cohorts.journeyPresetPair),
    tableToCsv("market_entry_experiment_variant_cohorts", exportPayload.marketEntry.cohorts.experimentVariant),
  );

  return sections.join("\n");
};
