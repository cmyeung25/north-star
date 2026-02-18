import { describe, expect, it } from "vitest";
import { isScenarioOnboarded, isScenarioOnboardedV2 } from "./isScenarioOnboarded";

describe("isScenarioOnboardedV2", () => {
  it("returns true when scenario meta is onboarded and uses V2 events", () => {
    expect(
      isScenarioOnboardedV2({
        meta: { schemaVersion: 2, onboarded: true },
        events: [],
      }),
    ).toBe(true);
  });

  it("returns true when onboardingCompleted is true and schema/event requirements are satisfied", () => {
    expect(
      isScenarioOnboardedV2({
        meta: { schemaVersion: 2, onboarded: false },
        clientComputed: { onboardingCompleted: true },
        events: [],
      }),
    ).toBe(true);
  });

  it("returns false when schema version is not v2", () => {
    expect(
      isScenarioOnboardedV2({
        meta: { schemaVersion: 1, onboarded: true },
        events: [],
      }),
    ).toBe(false);
  });
});

describe("isScenarioOnboarded", () => {
  it("prefers route scenario meta over root meta", () => {
    expect(
      isScenarioOnboarded(
        {
          meta: { onboarded: false },
          events: [],
          activeScenarioId: "scenario-1",
          scenarios: [
            {
              id: "scenario-1",
              meta: { schemaVersion: 2, onboarded: true },
              events: [],
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
        events: [],
        scenarios: [],
      }),
    ).toBe(false);
  });

  it("returns false when onboarded but events is not an array", () => {
    expect(
      isScenarioOnboarded(
        {
          activeScenarioId: "scenario-1",
          scenarios: [
            {
              id: "scenario-1",
              meta: { schemaVersion: 2, onboarded: true },
            },
          ],
        },
        "scenario-1",
      ),
    ).toBe(false);
  });
});
