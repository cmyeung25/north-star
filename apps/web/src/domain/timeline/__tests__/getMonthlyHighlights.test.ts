import { describe, expect, it } from "vitest";
import { getMonthlyHighlights } from "../getMonthlyHighlights";

describe("getMonthlyHighlights", () => {
  it("returns milestone highlights from unified milestone markers", () => {
    const result = getMonthlyHighlights({
      scenarioId: "s1",
      targetMonth: "2026-06",
      members: [
        { id: "m1", name: "Alex", kind: "person", applyScope: { scope: "all" } },
      ],
      eventViews: [],
      milestoneMarkers: [
        {
          id: "milestone-1",
          month: "2026-06",
          label: "School starts",
          memberName: "Alex",
          kind: "member_school_start",
        },
      ],
    });

    expect(result.milestones).toEqual([
      {
        id: "milestone-1",
        kind: "milestone",
        label: "School starts",
        memberName: "Alex",
      },
    ]);
  });

  it("keeps highlighted event logic unchanged", () => {
    const result = getMonthlyHighlights({
      scenarioId: "s1",
      targetMonth: "2026-06",
      members: [
        { id: "m1", name: "Alex", kind: "person", applyScope: { scope: "all" } },
      ],
      eventViews: [
        {
          definition: {
            id: "ev-1",
            title: "Summer Trip",
            type: "travel",
            kind: "cashflow",
            memberId: "m1",
            rule: { mode: "params", startMonth: "2026-06" },
          },
          ref: { refId: "ev-1", enabled: true, highlighted: true },
          rule: { mode: "params", startMonth: "2026-06" },
        },
      ],
      milestoneMarkers: [],
    });

    expect(result.events).toEqual([
      {
        id: "ev-1",
        kind: "event",
        label: "Summer Trip",
        memberName: "Alex",
      },
    ]);
  });
});

