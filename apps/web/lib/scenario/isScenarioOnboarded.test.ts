import { describe, expect, it } from "vitest";
import { isScenarioOnboarded } from "./isScenarioOnboarded";

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
              meta: { onboarded: true },
              events: [],
            },
          ],
        },
        "scenario-1",
      ),
    ).toBe(true);
  });

  it("falls back to root meta when scenario entry is missing", () => {
    expect(
      isScenarioOnboarded({
        meta: { onboarded: true },
        events: [],
        scenarios: [],
      }),
    ).toBe(true);
  });

  it("returns false when onboarded but events is not an array", () => {
    expect(
      isScenarioOnboarded(
        {
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
    ).toBe(false);
  });
});
