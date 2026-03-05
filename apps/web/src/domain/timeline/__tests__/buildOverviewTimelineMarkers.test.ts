import { describe, expect, it } from "vitest";
import { buildOverviewTimelineMarkers } from "../buildOverviewTimelineMarkers";

describe("buildOverviewTimelineMarkers", () => {
  it("builds unified markers from milestone events and highlighted events", () => {
    const result = buildOverviewTimelineMarkers({
      scenarioId: "s1",
      baseMonth: "2026-01",
      horizonMonths: 24,
      members: [
        { id: "m1", name: "Alex", kind: "person", applyScope: { scope: "all" } },
      ],
      milestoneEvents: [
        {
          id: "me-1",
          eventType: "expense",
          templateType: "member_school_start",
          effectiveMonth: "2026-09",
          payload: {
            kind: "money",
            data: {
              cadence: "oneOff",
              amount: 1000,
              currency: "HKD",
              category: "education",
              month: "2026-09",
            },
          },
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      highlightedEvents: [
        {
          id: "ev-1",
          name: "Summer Trip",
          startMonth: "2026-06",
          highlighted: true,
          memberId: "m1",
        },
      ],
    });

    expect(result.markers.map((entry) => entry.id)).toEqual(["highlight-ev-1", "me-1"]);
    expect(result.markers[0]).toMatchObject({
      label: "Summer Trip",
      memberName: "Alex",
      kind: "highlighted_event",
    });
    expect(result.markers[1]).toMatchObject({
      kind: "member_school_start",
    });
  });
});
