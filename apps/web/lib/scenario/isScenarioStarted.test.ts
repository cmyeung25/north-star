import { describe, expect, it } from "vitest";
import { isScenarioStarted } from "./isScenarioStarted";

describe("isScenarioStarted", () => {
  it("returns true when meta.onboarded is true", () => {
    expect(
      isScenarioStarted({
        meta: { onboarded: true },
      }),
    ).toBe(true);
  });

  it("returns true when members are present", () => {
    expect(
      isScenarioStarted({
        members: [{ id: "member-1" }],
      }),
    ).toBe(true);
  });

  it("returns true when active scenario has v2 events", () => {
    expect(
      isScenarioStarted({
        activeScenarioId: "scenario-1",
        scenarios: [{ id: "scenario-1", events: [{ id: "event-1" }] }],
      }),
    ).toBe(true);
  });

  it("returns true when assumptions differ from defaults", () => {
    expect(
      isScenarioStarted({
        activeScenarioId: "scenario-1",
        scenarios: [
          {
            id: "scenario-1",
            assumptions: {
              horizonMonths: 60,
              initialCash: 0,
              baseMonth: "2025-01",
            },
          },
        ],
      }),
    ).toBe(true);
  });

  it("returns false for empty payload", () => {
    expect(
      isScenarioStarted({
        scenarios: [],
        members: [],
        meta: { onboarded: false },
      }),
    ).toBe(false);
  });
});
