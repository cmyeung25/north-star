import { describe, expect, it } from "vitest";
import { migrateLegacyMemberMilestonesToEvents, buildLegacyMemberMilestoneEventId } from "../migrateLegacyMemberMilestones";
import type { ScenarioMember } from "../../../store/scenarioStore";

const buildMember = (patch?: Partial<ScenarioMember>): ScenarioMember => ({
  id: "m1",
  name: "Alex",
  kind: "person",
  birthMonth: "2000-01",
  applyScope: { scope: "all" },
  milestones: [],
  ...patch,
});

describe("migrateLegacyMemberMilestonesToEvents", () => {
  it("converts legacy milestones into marker milestone events", () => {
    const members: ScenarioMember[] = [
      buildMember({
        milestones: [
          {
            id: "birth",
            kind: "birth",
            label: "Born",
          },
          {
            id: "school",
            kind: "schoolStart",
            label: "School",
            atAgeYears: 6,
          },
          {
            id: "custom",
            kind: "custom",
            label: "Trip",
            month: "2030-09",
          },
        ],
      }),
    ];

    const result = migrateLegacyMemberMilestonesToEvents({
      scenarioId: "s1",
      members,
      baseMonth: "2026-01",
      nowMs: 123,
    });

    expect(result.addedCount).toBe(3);
    expect(result.skippedCount).toBe(0);
    expect(result.milestoneEvents).toEqual([
      {
        id: "legacy-member-milestone:m1:birth",
        mode: "marker",
        templateType: "member_birth",
        memberId: "m1",
        effectiveMonth: "2000-01",
        notes: "Born",
        createdAt: 123,
        updatedAt: 123,
      },
      {
        id: "legacy-member-milestone:m1:school",
        mode: "marker",
        templateType: "member_school_start",
        memberId: "m1",
        effectiveMonth: "2026-01",
        notes: "School",
        createdAt: 123,
        updatedAt: 123,
      },
      {
        id: "legacy-member-milestone:m1:custom",
        mode: "marker",
        templateType: "custom",
        memberId: "m1",
        effectiveMonth: "2030-09",
        notes: "Trip",
        createdAt: 123,
        updatedAt: 123,
      },
    ]);
  });

  it("skips milestones without resolvable month and logs warning", () => {
    let warnCalls = 0;
    const result = migrateLegacyMemberMilestonesToEvents({
      scenarioId: "s1",
      members: [
        buildMember({
          birthMonth: undefined,
          ageAtBaseMonth: undefined,
          milestones: [{ id: "bad", kind: "retirement", label: "Retire" }],
        }),
      ],
      baseMonth: "2026-01",
      logger: { warn: () => { warnCalls += 1; } },
    });

    expect(result.addedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(warnCalls).toBe(1);
  });

  it("is idempotent when migration event id already exists", () => {
    const existingId = buildLegacyMemberMilestoneEventId("m1", "retire");
    const result = migrateLegacyMemberMilestonesToEvents({
      scenarioId: "s1",
      baseMonth: "2026-01",
      members: [
        buildMember({
          milestones: [
            {
              id: "retire",
              kind: "retirement",
              label: "Retire",
              atAgeYears: 65,
            },
          ],
        }),
      ],
      milestoneEvents: [
        {
          id: existingId,
          mode: "marker",
          templateType: "member_retirement",
          memberId: "m1",
          effectiveMonth: "2065-01",
          notes: "Retire",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    expect(result.addedCount).toBe(0);
    expect(result.milestoneEvents).toHaveLength(1);
    expect(result.milestoneEvents[0]?.id).toBe(existingId);
  });
});

