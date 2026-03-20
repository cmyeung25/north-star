import { describe, expect, it } from "vitest";
import { trackOnboardingFunnelEvent } from "../onboardingFunnel";

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
      guardrailCount: 2,
    });

    expect(calls.length).toBe(1);
    expect(calls[0]).toMatchObject({
      name: "onboarding_review_viewed",
      payload: {
        locale: "en",
        flowVersion: "onboarding_v3",
        guardrailCount: 2,
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
      guardrailId: "mortgage_core_fields_missing",
      guardrailSeverity: "critical",
    });

    expect(consoleCalls.length).toBe(1);
    expect(consoleCalls[0]?.[0]).toBe("[onboarding-funnel]");
    expect(consoleCalls[0]?.[1]).toMatchObject({
      name: "guardrail_shown",
      payload: {
        locale: "zh-HK",
        flowVersion: "onboarding_v3",
        guardrailId: "mortgage_core_fields_missing",
      },
    });

    delete (globalThis as { window?: unknown }).window;
    console.info = originalInfo;
  });
});
