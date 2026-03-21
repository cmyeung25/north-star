import { describe, expect, it } from "vitest";
import type { MarketEntryEvent } from "../marketEntry";
import {
  buildMarketEntryReviewBoard,
  formatMarketEntryReviewBoardForExport,
} from "../marketEntryReviewBoard";
import {
  buildWeeklyProductAnalyticsDashboard,
  formatWeeklyProductAnalyticsDashboardAsCsv,
} from "../weeklyProductAnalyticsDashboard";
import type { OnboardingFunnelEvent } from "../onboardingFunnel";

const createMarketEvent = (
  name: MarketEntryEvent["name"],
  ts: string,
  payload: MarketEntryEvent["payload"],
): MarketEntryEvent => ({ name, ts, payload });

const createOnboardingEvent = (
  name: OnboardingFunnelEvent["name"],
  ts: string,
  payload: OnboardingFunnelEvent["payload"],
): OnboardingFunnelEvent => ({ name, ts, payload });

describe("buildMarketEntryReviewBoard", () => {
  it("builds KPI, cohort, attribution-coverage, and decision outputs for the fixed weekly board", () => {
    const previousWeekEvents: MarketEntryEvent[] = [
      createMarketEvent("market_landing_view", "2026-03-03T09:00:00.000Z", {
        locale: "en",
        journeyId: null,
        presetId: null,
        isSignedIn: false,
      }),
      createMarketEvent("journey_cta_click", "2026-03-03T09:00:01.000Z", {
        locale: "en",
        journeyId: "officeSaver",
        presetId: "single-renter",
        isSignedIn: false,
        experimentSlotKey: "landing.sample_journey.summary",
        experimentVariant: "control_v1",
      }),
      createMarketEvent("preset_create_started", "2026-03-03T09:00:02.000Z", {
        locale: "en",
        journeyId: "officeSaver",
        presetId: "single-renter",
        isSignedIn: false,
        experimentSlotKey: "landing.sample_journey.summary",
        experimentVariant: "control_v1",
      }),
      createMarketEvent("case_created", "2026-03-03T09:00:03.000Z", {
        locale: "en",
        journeyId: "officeSaver",
        presetId: "single-renter",
        isSignedIn: false,
        experimentSlotKey: "landing.sample_journey.summary",
        experimentVariant: "control_v1",
      }),
      createMarketEvent("onboarding_completed", "2026-03-03T09:00:04.000Z", {
        locale: "en",
        journeyId: "officeSaver",
        presetId: "single-renter",
        isSignedIn: false,
        experimentSlotKey: "landing.sample_journey.summary",
        experimentVariant: "control_v1",
      }),
    ];

    const currentWeekEvents: MarketEntryEvent[] = [];

    for (let index = 0; index < 40; index += 1) {
      const ts = `2026-03-10T09:${String(index).padStart(2, "0")}:00.000Z`;
      currentWeekEvents.push(
        createMarketEvent("market_landing_view", ts, {
          locale: index < 32 ? "en" : "zh-HK",
          journeyId: null,
          presetId: null,
          isSignedIn: index % 2 === 0,
        }),
      );
    }

    for (let index = 0; index < 16; index += 1) {
      const isSignedIn = index < 10;
      currentWeekEvents.push(
        createMarketEvent("sample_journey_impression", `2026-03-10T10:${String(index).padStart(2, "0")}:00.000Z`, {
          locale: index < 12 ? "en" : "zh-HK",
          journeyId: "officeSaver",
          presetId: "single-renter",
          isSignedIn,
          experimentSlotKey: "landing.sample_journey.summary",
          experimentVariant: "clarity_first_v1",
        }),
        createMarketEvent("journey_cta_click", `2026-03-10T10:${String(index).padStart(2, "0")}:01.000Z`, {
          locale: index < 12 ? "en" : "zh-HK",
          journeyId: "officeSaver",
          presetId: "single-renter",
          isSignedIn,
          experimentSlotKey: index === 15 ? undefined : "landing.sample_journey.summary",
          experimentVariant: index === 15 ? undefined : "clarity_first_v1",
        }),
        createMarketEvent("preset_create_started", `2026-03-10T10:${String(index).padStart(2, "0")}:02.000Z`, {
          locale: index < 12 ? "en" : "zh-HK",
          journeyId: "officeSaver",
          presetId: "single-renter",
          isSignedIn,
          experimentSlotKey: "landing.sample_journey.summary",
          experimentVariant: "clarity_first_v1",
        }),
      );

      if (index < 12) {
        currentWeekEvents.push(
          createMarketEvent("preset_create_submitted", `2026-03-10T10:${String(index).padStart(2, "0")}:03.000Z`, {
            locale: index < 9 ? "en" : "zh-HK",
            journeyId: "officeSaver",
            presetId: "single-renter",
            isSignedIn,
            experimentSlotKey: "landing.sample_journey.summary",
            experimentVariant: "clarity_first_v1",
          }),
          createMarketEvent("case_created", `2026-03-10T10:${String(index).padStart(2, "0")}:04.000Z`, {
            locale: index < 9 ? "en" : "zh-HK",
            journeyId: "officeSaver",
            presetId: "single-renter",
            isSignedIn,
            experimentSlotKey: "landing.sample_journey.summary",
            experimentVariant: "clarity_first_v1",
          }),
        );
      }

      if (index < 9) {
        currentWeekEvents.push(
          createMarketEvent("onboarding_started", `2026-03-10T10:${String(index).padStart(2, "0")}:05.000Z`, {
            locale: index < 7 ? "en" : "zh-HK",
            journeyId: "officeSaver",
            presetId: "single-renter",
            isSignedIn,
            experimentSlotKey: "landing.sample_journey.summary",
            experimentVariant: "clarity_first_v1",
          }),
        );
      }

      if (index < 6) {
        currentWeekEvents.push(
          createMarketEvent("onboarding_completed", `2026-03-10T10:${String(index).padStart(2, "0")}:06.000Z`, {
            locale: index < 4 ? "en" : "zh-HK",
            journeyId: "officeSaver",
            presetId: "single-renter",
            isSignedIn,
            experimentSlotKey: "landing.sample_journey.summary",
            experimentVariant: "clarity_first_v1",
          }),
        );
      }
    }

    const board = buildMarketEntryReviewBoard([...previousWeekEvents, ...currentWeekEvents], {
      weekStart: "2026-03-10T00:00:00.000Z",
      weekEnd: "2026-03-17T00:00:00.000Z",
      topN: 10,
    });

    expect(board.summary.totals).toMatchObject({
      market_landing_view: 40,
      sample_journey_impression: 16,
      journey_cta_click: 16,
      preset_create_started: 16,
      preset_create_submitted: 12,
      case_created: 12,
      onboarding_started: 9,
      onboarding_completed: 6,
    });
    expect(board.kpis.find((kpi) => kpi.id === "landing_to_journey_ctr")).toMatchObject({
      valuePct: 40,
      thresholdPct: 12,
      status: "ok",
    });
    expect(board.kpis.find((kpi) => kpi.id === "preset_submit_to_onboarding_start_rate")).toMatchObject({
      valuePct: 75,
      thresholdPct: 85,
      status: "needs_attention",
    });
    expect(board.kpis.find((kpi) => kpi.id === "case_created_to_onboarding_completed_drop")).toMatchObject({
      valuePct: 50,
      thresholdPct: 25,
      status: "needs_attention",
    });
    expect(board.checks.localeSkew).toMatchObject({
      dominantLocale: "en",
      dominantSharePct: 80,
      status: "observe",
    });
    expect(board.checks.experimentCoverage).toMatchObject({
      attributedJourneyClicks: 15,
      totalJourneyClicks: 16,
      coveragePct: 93.8,
      status: "ok",
    });
    expect(board.summary.signedInVsSignedOutCompletionDeltaPctPoints).toBe(60);
    expect(board.cohorts.journeyPresetPair[0]).toMatchObject({
      label: "officeSaver → single-renter",
      counts: {
        case_created: 12,
        onboarding_completed: 6,
      },
      rates: {
        caseCreatedToOnboardingCompletedDropPct: 50,
      },
    });
    expect(board.decision).toMatchObject({
      status: "fix_before_scale",
    });

    expect(formatMarketEntryReviewBoardForExport(board)).toMatchObject({
      summary: {
        marketLandingViews: 40,
        onboardingCompleted: 6,
        decision: "fix_before_scale",
      },
      cohorts: {
        experimentVariant: [
          {
            label: "landing.sample_journey.summary / clarity_first_v1",
            dimension: "experiment_variant",
            journeyId: "officeSaver",
            presetId: "single-renter",
            locale: null,
            isSignedIn: null,
            experimentSlotKey: "landing.sample_journey.summary",
            experimentVariant: "clarity_first_v1",
            marketLandingViews: 0,
            sampleJourneyImpressions: 16,
            journeyClicks: 15,
            presetCreateStarted: 16,
            presetCreateSubmitted: 12,
            caseCreated: 12,
            onboardingStarted: 9,
            onboardingCompleted: 6,
            landingToJourneyCtrPct: 0,
            sampleJourneyCtrPct: 93.8,
            journeyToPresetStartRatePct: 106.7,
            presetStartToCaseCreatedRatePct: 75,
            presetSubmitToOnboardingStartRatePct: 75,
            caseCreatedToOnboardingCompletedDropPct: 50,
            journeyClicksConfidence: "directional_only",
            sampleJourneyImpressionsConfidence: "directional_only",
            caseCreatedConfidence: "directional_only",
          },
        ],
      },
    });
  });

  it("formats the combined weekly dashboard as CSV", () => {
    const dashboard = buildWeeklyProductAnalyticsDashboard({
      now: "2026-03-21T12:00:00.000Z",
      marketEntryEvents: [
        createMarketEvent("market_landing_view", "2026-03-10T09:00:00.000Z", {
          locale: "en",
          journeyId: null,
          presetId: null,
          isSignedIn: false,
        }),
      ],
      onboardingEvents: [
        createOnboardingEvent("onboarding_review_viewed", "2026-03-10T09:00:00.000Z", {
          locale: "en",
          flowVersion: "onboarding_v3",
          reviewStepId: "review",
          reviewSessionId: "review_1",
          reviewSourceContext: "initial_review",
          guardrailLevel: "warning",
          guardrailCount: 1,
          criticalGuardrailCount: 0,
          warningGuardrailCount: 1,
          infoGuardrailCount: 0,
        }),
      ],
    });

    const csv = formatWeeklyProductAnalyticsDashboardAsCsv(dashboard);

    expect(csv).toContain("onboarding_summary");
    expect(csv).toContain("market_entry_summary");
    expect(csv).toContain("market_entry_kpis");
  });
});
