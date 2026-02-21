import { describe, expect, it } from "vitest";
import {
  CURRENT_ONBOARDING_VERSION,
  deriveScenarioLifecycleState,
} from "../lifecycle";

describe("deriveScenarioLifecycleState", () => {
  it("derives seed lifecycle flags", () => {
    const lifecycle = deriveScenarioLifecycleState({ source: "seed" });

    expect(lifecycle.meta.isSeeded).toBe(true);
    expect(lifecycle.meta.skipOnboarding).toBe(true);
    expect(lifecycle.meta.onboardingVersion).toBe(CURRENT_ONBOARDING_VERSION);
    expect(lifecycle.clientComputed.onboardingCompleted).toBe(true);
  });

  it("derives onboarding lifecycle flags", () => {
    const lifecycle = deriveScenarioLifecycleState({
      source: "onboarding",
      nowIso: "2026-01-01T00:00:00.000Z",
    });

    expect(lifecycle.meta.onboarded).toBe(true);
    expect(lifecycle.meta.onboardedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(lifecycle.meta.onboardingVersion).toBe(CURRENT_ONBOARDING_VERSION);
    expect(lifecycle.clientComputed.onboardingCompleted).toBe(true);
  });
});
