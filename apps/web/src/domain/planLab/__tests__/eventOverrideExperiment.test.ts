import { describe, expect, it } from "vitest";
import { buildEventOverridePatch, type EventOverrideExperimentSpec } from "../eventOverrideExperiment";
import type { ScenarioEvent } from "../../scenarioV2/events";

const baseEvent: ScenarioEvent = {
  id: "salary-1",
  type: "cashflow",
  kind: "income",
  cadence: "monthly",
  amount: 30000,
  startMonth: "2026-01",
  endMonth: "2030-12",
  label: "固定薪金",
};

describe("buildEventOverridePatch", () => {
  it("applies amount multiplier and month shift", () => {
    const spec: EventOverrideExperimentSpec = {
      id: "exp-1",
      title: "薪金 +10%",
      type: "event_override",
      targetEventId: "salary-1",
      changes: {
        amountMultiplier: 1.1,
        startMonthShift: 2,
      },
    };

    expect(buildEventOverridePatch(baseEvent, spec)).toMatchObject({
      amount: 33000,
      startMonth: "2026-03",
    });
  });

  it("supports end month override", () => {
    const spec: EventOverrideExperimentSpec = {
      id: "exp-2",
      title: "提早結束",
      type: "event_override",
      targetEventId: "salary-1",
      changes: {
        endMonthShift: -3,
      },
    };

    expect(buildEventOverridePatch(baseEvent, spec)).toMatchObject({
      endMonth: "2030-09",
    });
  });
});
