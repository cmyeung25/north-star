import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import { groupEventSeries } from "../eventSeriesGrouping";

describe("groupEventSeries", () => {
  it("groups parent-child housing events into one series", () => {
    const events: ScenarioEvent[] = [
      {
        id: "rent-base",
        type: "housing",
        kind: "rent",
        startMonth: "2026-01",
        endMonth: "2028-12",
        rentMonthly: 20000,
      },
      {
        id: "rent-adj-1",
        type: "housing",
        kind: "rent",
        startMonth: "2027-06",
        rentMonthly: 24000,
        parentEventId: "rent-base",
        meta: { kind: "adjustment", adjustsEventId: "rent-base" },
      },
    ];

    const grouped = groupEventSeries(events);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.baseEvent.id).toBe("rent-base");
    expect(grouped[0]?.adjustments.map((event) => event.id)).toEqual(["rent-adj-1"]);
    expect(grouped[0]?.groupStartMonth).toBe("2026-01");
    expect(grouped[0]?.groupEndMonth).toBe("2028-12");
  });

  it("keeps standalone events as individual groups", () => {
    const events: ScenarioEvent[] = [
      {
        id: "loan-base",
        type: "loan",
        loanKind: "personal",
        startMonth: "2026-01",
        principal: 100000,
        annualInterestRatePct: 3,
        termYears: 5,
        liabilityId: "liability-loan",
      },
      {
        id: "one-off-adjust",
        type: "adjustment",
        kind: "cash",
        month: "2026-03",
        amount: -1000,
      },
    ];

    const grouped = groupEventSeries(events);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((item) => item.baseEvent.id).sort()).toEqual([
      "loan-base",
      "one-off-adjust",
    ]);
  });
});
