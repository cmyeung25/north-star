import { describe, expect, it } from "vitest";
import type { OnboardingFunnelEvent } from "../onboardingFunnel";
import {
  buildOnboardingReviewPack,
  formatOnboardingReviewPackForExport,
} from "../onboardingReviewPack";

const baseTs = "2026-03-10T09:00:00.000Z";

const createEvent = (
  name: OnboardingFunnelEvent["name"],
  ts: string,
  payload: OnboardingFunnelEvent["payload"]
): OnboardingFunnelEvent => ({
  name,
  ts,
  payload,
});

describe("buildOnboardingReviewPack", () => {
  it("aggregates weekly review conversion, guardrail show rates, fix success, and review-without-completion rows", () => {
    const events: OnboardingFunnelEvent[] = [
      createEvent("onboarding_review_viewed", baseTs, {
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_1",
        reviewSourceContext: "initial_review",
        guardrailLevel: "critical",
        guardrailCount: 2,
        criticalGuardrailCount: 1,
        warningGuardrailCount: 1,
        infoGuardrailCount: 0,
      }),
      createEvent("guardrail_shown", "2026-03-10T09:00:01.000Z", {
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_1",
        reviewSourceContext: "initial_review",
        guardrailId: "mortgage_core_fields_missing",
        guardrailSeverity: "critical",
        guardrailCategory: "key_missing",
        targetStepId: "assets",
        targetSection: "mortgage",
      }),
      createEvent("guardrail_shown", "2026-03-10T09:00:02.000Z", {
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_1",
        reviewSourceContext: "initial_review",
        guardrailId: "duplicate_rent_expense_inputs",
        guardrailSeverity: "info",
        guardrailCategory: "potential_double_counting",
        targetStepId: "expense",
        targetSection: "housing",
      }),
      createEvent("onboarding_review_viewed", "2026-03-11T09:00:00.000Z", {
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_2",
        reviewSourceContext: "returned_from_fix",
        guardrailLevel: "warning",
        guardrailCount: 1,
        criticalGuardrailCount: 0,
        warningGuardrailCount: 1,
        infoGuardrailCount: 0,
      }),
      createEvent("guardrail_shown", "2026-03-11T09:00:01.000Z", {
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_2",
        reviewSourceContext: "returned_from_fix",
        guardrailId: "duplicate_rent_expense_inputs",
        guardrailSeverity: "info",
        guardrailCategory: "potential_double_counting",
        targetStepId: "expense",
        targetSection: "housing",
      }),
      createEvent("guardrail_fixed", "2026-03-11T09:00:02.000Z", {
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_2",
        reviewSourceContext: "returned_from_fix",
        guardrailId: "mortgage_core_fields_missing",
        guardrailSeverity: "critical",
        guardrailCategory: "key_missing",
        targetStepId: "assets",
        targetSection: "mortgage",
      }),
      createEvent("onboarding_completed", "2026-03-11T09:00:03.000Z", {
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_2",
        reviewSourceContext: "returned_from_fix",
        guardrailLevel: "warning",
        guardrailCount: 1,
        criticalGuardrailCount: 0,
        warningGuardrailCount: 1,
        infoGuardrailCount: 0,
      }),
      createEvent("onboarding_review_viewed", "2026-03-12T09:00:00.000Z", {
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_3",
        reviewSourceContext: "initial_review",
        guardrailLevel: "warning",
        guardrailCount: 1,
        criticalGuardrailCount: 0,
        warningGuardrailCount: 1,
        infoGuardrailCount: 0,
      }),
      createEvent("guardrail_shown", "2026-03-12T09:00:01.000Z", {
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_3",
        reviewSourceContext: "initial_review",
        guardrailId: "duplicate_rent_expense_inputs",
        guardrailSeverity: "info",
        guardrailCategory: "potential_double_counting",
        targetStepId: "expense",
        targetSection: "housing",
      }),
      createEvent("onboarding_review_viewed", "2026-03-12T10:00:00.000Z", {
        locale: "zh-HK",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_zh_1",
        reviewSourceContext: "initial_review",
        guardrailLevel: "warning",
        guardrailCount: 1,
        criticalGuardrailCount: 0,
        warningGuardrailCount: 1,
        infoGuardrailCount: 0,
      }),
      createEvent("guardrail_shown", "2026-03-12T10:00:01.000Z", {
        locale: "zh-HK",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_zh_1",
        reviewSourceContext: "initial_review",
        guardrailId: "property_usage_missing",
        guardrailSeverity: "warning",
        guardrailCategory: "key_missing",
        targetStepId: "assets",
        targetSection: "property",
      }),
    ];

    const pack = buildOnboardingReviewPack(events, {
      weekStart: "2026-03-10T00:00:00.000Z",
      weekEnd: "2026-03-17T00:00:00.000Z",
      locale: "en",
    });

    expect(pack.totals.reviewSessionCount).toBe(3);
    expect(pack.totals.completedReviewSessionCount).toBe(1);
    expect(pack.totals.reviewToCompletedConversionRate).toBe(33.3);
    expect(pack.totals.reviewWithoutCompletionSessionCount).toBe(2);
    expect(pack.totals.reviewWithoutCompletionRate).toBe(66.7);
    expect(pack.totals.reviewSourceContextCounts).toEqual({
      initial_review: 2,
      returned_from_fix: 1,
    });
    expect(pack.totals.severityMix).toEqual({
      critical: 1,
      warning: 3,
      info: 0,
      total: 4,
      averagePerReview: 1.33,
    });

    expect(pack.sections.topShownGuardrails).toEqual([
      {
        guardrailId: "duplicate_rent_expense_inputs",
        severity: "info",
        category: "potential_double_counting",
        targetStepId: "expense",
        targetSection: "housing",
        shownEventCount: 3,
        shownReviewCount: 3,
        shownRate: 100,
        fixedReviewCount: 0,
        fixSuccessRate: 0,
        incompleteReviewCount: 2,
        incompleteShareOfShown: 66.7,
      },
      {
        guardrailId: "mortgage_core_fields_missing",
        severity: "critical",
        category: "key_missing",
        targetStepId: "assets",
        targetSection: "mortgage",
        shownEventCount: 1,
        shownReviewCount: 1,
        shownRate: 33.3,
        fixedReviewCount: 1,
        fixSuccessRate: 100,
        incompleteReviewCount: 1,
        incompleteShareOfShown: 100,
      },
    ]);

    expect(pack.sections.lowestFixSuccessGuardrails[0]).toMatchObject({
      guardrailId: "duplicate_rent_expense_inputs",
      fixSuccessRate: 0,
    });
    expect(pack.sections.reviewWithoutCompletionCandidates[0]).toMatchObject({
      guardrailId: "duplicate_rent_expense_inputs",
      incompleteReviewCount: 2,
      incompleteShareOfShown: 66.7,
    });
  });

  it("formats the review pack into a simple exportable summary and tables", () => {
    const pack = buildOnboardingReviewPack(
      [
        createEvent("onboarding_review_viewed", baseTs, {
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
        createEvent("guardrail_shown", "2026-03-10T09:00:01.000Z", {
          locale: "en",
          flowVersion: "onboarding_v3",
          reviewStepId: "review",
          reviewSessionId: "review_1",
          reviewSourceContext: "initial_review",
          guardrailId: "property_usage_missing",
          guardrailSeverity: "warning",
          guardrailCategory: "key_missing",
          targetStepId: "assets",
          targetSection: "property",
        }),
      ],
      {
        weekStart: "2026-03-10T00:00:00.000Z",
        weekEnd: "2026-03-17T00:00:00.000Z",
      }
    );

    expect(formatOnboardingReviewPackForExport(pack)).toEqual({
      summary: {
        locale: "all",
        weekStart: "2026-03-10T00:00:00.000Z",
        weekEnd: "2026-03-17T00:00:00.000Z",
        reviewSessions: 1,
        completedReviewSessions: 0,
        reviewToCompletedConversionPct: 0,
        reviewWithoutCompletionSessions: 1,
        reviewWithoutCompletionPct: 100,
        criticalGuardrailsShown: 0,
        warningGuardrailsShown: 1,
        infoGuardrailsShown: 0,
        totalGuardrailsShown: 1,
        averageGuardrailsPerReview: 1,
        initialReviewSessions: 1,
        returnedFromFixSessions: 0,
      },
      tables: {
        topShownGuardrails: [
          {
            guardrailId: "property_usage_missing",
            severity: "warning",
            category: "key_missing",
            targetStepId: "assets",
            targetSection: "property",
            shownEventCount: 1,
            shownReviewCount: 1,
            shownRatePct: 100,
            fixedReviewCount: 0,
            fixSuccessRatePct: 0,
            reviewWithoutCompletionCount: 1,
            reviewWithoutCompletionPct: 100,
          },
        ],
        lowestFixSuccessGuardrails: [
          {
            guardrailId: "property_usage_missing",
            severity: "warning",
            category: "key_missing",
            targetStepId: "assets",
            targetSection: "property",
            shownEventCount: 1,
            shownReviewCount: 1,
            shownRatePct: 100,
            fixedReviewCount: 0,
            fixSuccessRatePct: 0,
            reviewWithoutCompletionCount: 1,
            reviewWithoutCompletionPct: 100,
          },
        ],
        reviewWithoutCompletionCandidates: [
          {
            guardrailId: "property_usage_missing",
            severity: "warning",
            category: "key_missing",
            targetStepId: "assets",
            targetSection: "property",
            shownEventCount: 1,
            shownReviewCount: 1,
            shownRatePct: 100,
            fixedReviewCount: 0,
            fixSuccessRatePct: 0,
            reviewWithoutCompletionCount: 1,
            reviewWithoutCompletionPct: 100,
          },
        ],
      },
    });
  });
});
