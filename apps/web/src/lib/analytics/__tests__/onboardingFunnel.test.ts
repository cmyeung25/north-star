import { describe, expect, it } from "vitest";
import {
  ONBOARDING_FUNNEL_ALLOWED_PAYLOAD_KEYS,
  buildPendingGuardrailFix,
  resolveCompletedGuardrailFixes,
  sanitizeOnboardingFunnelPayload,
  trackOnboardingFunnelEvent,
} from "../onboardingFunnel";

describe("trackOnboardingFunnelEvent", () => {
  it("uses the injected tracker when available", () => {
    const calls: unknown[] = [];
    const windowStub = {
      __NS_ONBOARDING_FUNNEL_TRACKER__: (event: unknown) => {
        calls.push(event);
      },
    };

    (globalThis as { window?: unknown }).window = windowStub;

    trackOnboardingFunnelEvent("onboarding_review_viewed", {
      locale: "en",
      flowVersion: "onboarding_v3",
      reviewSessionId: "review_123",
      reviewSourceContext: "initial_review",
      guardrailCount: 2,
      monthlyIncomeAmount: 90000,
    });

    expect(calls.length).toBe(1);
    expect(calls[0]).toMatchObject({
      name: "onboarding_review_viewed",
      payload: {
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewSessionId: "review_123",
        reviewSourceContext: "initial_review",
        guardrailCount: 2,
      },
    });
    expect(calls[0]).not.toMatchObject({
      payload: {
        monthlyIncomeAmount: 90000,
      },
    });

    delete (globalThis as { window?: unknown }).window;
  });

  it("falls back to console logging when no tracker is registered", () => {
    const originalInfo = console.info;
    const consoleCalls: unknown[][] = [];
    console.info = (...args: unknown[]) => {
      consoleCalls.push(args);
    };
    (globalThis as { window?: unknown }).window = {};

    trackOnboardingFunnelEvent("guardrail_shown", {
      locale: "zh-HK",
      flowVersion: "onboarding_v3",
      reviewSessionId: "review_abc",
      reviewSourceContext: "returned_from_fix",
      guardrailId: "mortgage_core_fields_missing",
      guardrailSeverity: "critical",
      targetStepId: "assets",
      targetSection: "mortgage",
    });

    expect(consoleCalls.length).toBe(1);
    expect(consoleCalls[0]?.[0]).toBe("[onboarding-funnel]");
    expect(consoleCalls[0]?.[1]).toMatchObject({
      name: "guardrail_shown",
      payload: {
        locale: "zh-HK",
        flowVersion: "onboarding_v3",
        reviewSessionId: "review_abc",
        reviewSourceContext: "returned_from_fix",
        guardrailId: "mortgage_core_fields_missing",
      },
    });

    delete (globalThis as { window?: unknown }).window;
    console.info = originalInfo;
  });
});

describe("onboarding funnel payload contract", () => {
  it("matches the documented metadata-only payload allowlist", () => {
    expect(ONBOARDING_FUNNEL_ALLOWED_PAYLOAD_KEYS).toEqual([
      "locale",
      "flowVersion",
      "reviewStepId",
      "reviewSessionId",
      "reviewSourceContext",
      "completenessLevel",
      "completenessScorePct",
      "guardrailLevel",
      "guardrailCount",
      "criticalGuardrailCount",
      "warningGuardrailCount",
      "infoGuardrailCount",
      "guardrailId",
      "guardrailSeverity",
      "guardrailCategory",
      "targetStepId",
      "targetSection",
    ]);
  });

  it("drops non-contract fields from the payload", () => {
    expect(
      sanitizeOnboardingFunnelPayload({
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_789",
        reviewSourceContext: "returned_from_fix",
        guardrailCount: 1,
        guardrailId: "property_usage_missing",
        targetStepId: "assets",
        targetSection: "property",
        scenarioId: "scenario-secret",
        cashAmount: 12345,
      }),
    ).toEqual({
      locale: "en",
      flowVersion: "onboarding_v3",
      reviewStepId: "review",
      reviewSessionId: "review_789",
      reviewSourceContext: "returned_from_fix",
      guardrailCount: 1,
      guardrailId: "property_usage_missing",
      targetStepId: "assets",
      targetSection: "property",
    });
  });

  it("keeps only metadata-safe fields for each onboarding funnel event contract", () => {
    expect(
      sanitizeOnboardingFunnelPayload({
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_contract_1",
        reviewSourceContext: "initial_review",
        completenessLevel: "needs_attention",
        completenessScorePct: 80,
        guardrailLevel: "warning",
        guardrailCount: 2,
        criticalGuardrailCount: 0,
        warningGuardrailCount: 1,
        infoGuardrailCount: 1,
        scenarioId: "scenario-secret",
        totalAssetsAmount: 1200000,
      }),
    ).toEqual({
      locale: "en",
      flowVersion: "onboarding_v3",
      reviewStepId: "review",
      reviewSessionId: "review_contract_1",
      reviewSourceContext: "initial_review",
      completenessLevel: "needs_attention",
      completenessScorePct: 80,
      guardrailLevel: "warning",
      guardrailCount: 2,
      criticalGuardrailCount: 0,
      warningGuardrailCount: 1,
      infoGuardrailCount: 1,
    });

    expect(
      sanitizeOnboardingFunnelPayload({
        locale: "en",
        flowVersion: "onboarding_v3",
        reviewStepId: "review",
        reviewSessionId: "review_contract_1",
        reviewSourceContext: "returned_from_fix",
        guardrailId: "property_usage_missing",
        guardrailSeverity: "warning",
        guardrailCategory: "key_missing",
        targetStepId: "assets",
        targetSection: "property",
        propertyMarketValue: 999999,
      }),
    ).toEqual({
      locale: "en",
      flowVersion: "onboarding_v3",
      reviewStepId: "review",
      reviewSessionId: "review_contract_1",
      reviewSourceContext: "returned_from_fix",
      guardrailId: "property_usage_missing",
      guardrailSeverity: "warning",
      guardrailCategory: "key_missing",
      targetStepId: "assets",
      targetSection: "property",
    });
  });
});

describe("resolveCompletedGuardrailFixes", () => {
  it("emits fixed only after the user returns to a later review pass and the guardrail disappears", () => {
    const pendingFixes = new Map([
      [
        "mortgage_core_fields_missing",
        buildPendingGuardrailFix(
          {
            id: "mortgage_core_fields_missing",
            severity: "critical",
            category: "key_missing",
            messageKey: "guardrails.rules.mortgageCoreFieldsMissing.message",
            actionHintKey: "guardrails.rules.mortgageCoreFieldsMissing.action",
            target: { stepId: "assets", section: "mortgage" },
            evidence: { propertyCount: 1 },
          },
          "review_a",
        ),
      ],
    ]);

    const sameReviewPass = resolveCompletedGuardrailFixes({
      pendingFixes,
      currentGuardrails: [],
      currentReviewSessionId: "review_a",
    });
    expect(sameReviewPass.fixedGuardrails).toEqual([]);

    const guardrailStillPresent = resolveCompletedGuardrailFixes({
      pendingFixes,
      currentGuardrails: [
        {
          id: "mortgage_core_fields_missing",
          severity: "critical",
          category: "key_missing",
          messageKey: "guardrails.rules.mortgageCoreFieldsMissing.message",
          actionHintKey: "guardrails.rules.mortgageCoreFieldsMissing.action",
          target: { stepId: "assets", section: "mortgage" },
          evidence: { propertyCount: 1 },
        },
      ],
      currentReviewSessionId: "review_b",
    });
    expect(guardrailStillPresent.fixedGuardrails).toEqual([]);

    const fixedAfterReturn = resolveCompletedGuardrailFixes({
      pendingFixes,
      currentGuardrails: [],
      currentReviewSessionId: "review_b",
    });
    expect(fixedAfterReturn.fixedGuardrails).toEqual([
      {
        guardrailId: "mortgage_core_fields_missing",
        guardrailSeverity: "critical",
        guardrailCategory: "key_missing",
        targetStepId: "assets",
        targetSection: "mortgage",
        originReviewSessionId: "review_a",
      },
    ]);
    expect([...fixedAfterReturn.remainingPendingFixes.keys()]).toEqual([]);
  });
});
