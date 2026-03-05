import { describe, expect, it } from "vitest";
import { getMonthlyHighlights } from "../getMonthlyHighlights";

describe("getMonthlyHighlights", () => {
  it("prefers scenario milestoneEvents over legacy member milestones", () => {
    const result = getMonthlyHighlights({
      scenarioId: "s1",
      baseMonth: "2026-01",
      horizonMonths: 24,
      members: [
        {
          id: "member-1",
          name: "Alex",
          kind: "person",
          applyScope: { scope: "all" },
          milestones: [
            {
              id: "legacy-ms-1",
              kind: "schoolStart",
              label: "Legacy School",
              month: "2026-09",
              applyScope: { scope: "all" },
            },
          ],
        },
      ],
      milestoneEvents: [
        {
          id: "evt-ms-1",
          eventType: "expense",
          effectiveMonth: "2026-09",
          notes: "New School Event",
          payload: {
            kind: "money",
            data: {
              cadence: "oneOff",
              amount: 0,
              currency: "HKD",
              category: "education",
              memberId: "member-1",
            },
          },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      eventViews: [],
      targetMonth: "2026-09",
    });

    expect(result.milestones).toEqual([
      {
        id: "evt-ms-1",
        kind: "milestone",
        label: "New School Event",
        memberName: "Alex",
      },
    ]);
  });

  it("falls back to member milestones when scenario milestoneEvents is empty and keeps scenario isolation", () => {
    const result = getMonthlyHighlights({
      scenarioId: "s1",
      baseMonth: "2026-01",
      horizonMonths: 24,
      members: [
        {
          id: "member-1",
          name: "Alex",
          kind: "person",
          applyScope: { scope: "include", scenarioIds: ["s1"] },
          milestones: [
            {
              id: "legacy-s1",
              kind: "retirement",
              label: "S1 milestone",
              month: "2026-09",
              applyScope: { scope: "all" },
            },
          ],
        },
        {
          id: "member-2",
          name: "Case2",
          kind: "person",
          applyScope: { scope: "include", scenarioIds: ["s2"] },
          milestones: [
            {
              id: "legacy-s2",
              kind: "retirement",
              label: "S2 milestone",
              month: "2026-09",
              applyScope: { scope: "all" },
            },
          ],
        },
      ],
      milestoneEvents: [],
      eventViews: [],
      targetMonth: "2026-09",
    });

    expect(result.milestones.map((entry) => entry.id)).toEqual(["legacy-s1"]);
  });
});
