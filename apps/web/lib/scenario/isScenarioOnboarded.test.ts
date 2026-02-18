import { describe, expect, it } from "vitest";
import { isScenarioOnboarded, isScenarioOnboardedV2 } from "./isScenarioOnboarded";

describe("isScenarioOnboardedV2", () => {
  it("returns true when scenario meta is onboarded", () => {
    expect(
      isScenarioOnboardedV2({
        meta: { onboarded: true },
      }),
    ).toBe(true);
  });

  it("returns true when onboardingCompleted is true", () => {
    expect(
      isScenarioOnboardedV2({
        meta: { onboarded: false },
        clientComputed: { onboardingCompleted: true },
      }),
    ).toBe(true);
  });

  it("returns true when onboardedAt is set", () => {
    expect(
      isScenarioOnboardedV2({
        meta: { onboardedAt: "2026-01-01T00:00:00.000Z" },
      }),
    ).toBe(true);
  });
});

describe("isScenarioOnboarded", () => {
  it("prefers route scenario meta over root meta", () => {
    expect(
      isScenarioOnboarded(
        {
          meta: { onboarded: false },
          activeScenarioId: "scenario-1",
          scenarios: [
            {
              id: "scenario-1",
              meta: { onboarded: true },
            },
          ],
        },
        "scenario-1",
      ),
    ).toBe(true);
  });

  it("returns false when scenario entry is missing", () => {
    expect(
      isScenarioOnboarded({
        meta: { onboarded: true },
        scenarios: [],
      }),
    ).toBe(false);
  });

  it("returns true when active scenario has onboardedAt", () => {
    expect(
      isScenarioOnboarded(
        {
          activeScenarioId: "scenario-1",
          scenarios: [
            {
              id: "scenario-1",
              meta: { onboardedAt: "2026-01-01T00:00:00.000Z" },
            },
          ],
        },
        "scenario-1",
      ),
    ).toBe(true);
  });
});
