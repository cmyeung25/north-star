import { appliesToScenario } from "../applyScope";
import { monthAtAge } from "../members/age";
import { normalizeMonthStrict } from "../../utils/month";
import type { MilestoneEvent, MilestoneEventTemplateType } from "./types";
import type { ScenarioMember, MemberMilestone } from "../../store/scenarioStore";

export type LegacyMemberMilestoneMigrationResult = {
  milestoneEvents: MilestoneEvent[];
  addedCount: number;
  skippedCount: number;
  legacyCount: number;
};

type MigrateLegacyMemberMilestonesParams = {
  scenarioId: string;
  members?: ScenarioMember[];
  milestoneEvents?: MilestoneEvent[];
  baseMonth?: string | null;
  nowMs?: number;
  logger?: Pick<Console, "warn">;
};

const templateTypeByKind: Record<string, MilestoneEventTemplateType> = {
  birth: "member_birth",
  schoolStart: "member_school_start",
  retirement: "member_retirement",
};

export const buildLegacyMemberMilestoneEventId = (
  memberId: string,
  milestoneId: string
): string => `legacy-member-milestone:${memberId}:${milestoneId}`;

const normalizeMonthOrNull = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const normalized = normalizeMonthStrict(value);
  return normalized.ok ? normalized.month : null;
};

const resolveMilestoneMonth = ({
  member,
  milestone,
  baseMonth,
}: {
  member: ScenarioMember;
  milestone: MemberMilestone;
  baseMonth?: string | null;
}): string | null => {
  const explicit = normalizeMonthOrNull(milestone.month);
  if (explicit) {
    return explicit;
  }

  const normalizedBase = normalizeMonthOrNull(baseMonth);
  if (typeof milestone.atAgeYears === "number" && normalizedBase) {
    const atAge = monthAtAge(member, milestone.atAgeYears, normalizedBase);
    return normalizeMonthOrNull(atAge);
  }

  if (milestone.kind === "birth") {
    return normalizeMonthOrNull(member.birthMonth);
  }

  return null;
};

export const migrateLegacyMemberMilestonesToEvents = ({
  scenarioId,
  members,
  milestoneEvents,
  baseMonth,
  nowMs = Date.now(),
  logger = console,
}: MigrateLegacyMemberMilestonesParams): LegacyMemberMilestoneMigrationResult => {
  const existing = [...(milestoneEvents ?? [])];
  const existingIds = new Set(existing.map((event) => event.id));

  let addedCount = 0;
  let skippedCount = 0;
  let legacyCount = 0;

  (members ?? [])
    .filter((member) => appliesToScenario(member.applyScope, scenarioId))
    .forEach((member) => {
      (member.milestones ?? [])
        .filter((milestone) => appliesToScenario(milestone.applyScope, scenarioId))
        .forEach((milestone) => {
          legacyCount += 1;
          const id = buildLegacyMemberMilestoneEventId(member.id, milestone.id);
          if (existingIds.has(id)) {
            return;
          }

          const effectiveMonth = resolveMilestoneMonth({ member, milestone, baseMonth });
          if (!effectiveMonth) {
            skippedCount += 1;
            logger.warn(
              `[milestone-migration] skipped milestone without resolvable month (scenario=${scenarioId}, member=${member.id}, milestone=${milestone.id})`
            );
            return;
          }

          const note = milestone.label?.trim();
          const templateType = templateTypeByKind[milestone.kind] ?? "custom";

          existing.push({
            id,
            mode: "marker",
            templateType,
            memberId: member.id,
            effectiveMonth,
            notes: note && note.length > 0 ? note : undefined,
            createdAt: nowMs,
            updatedAt: nowMs,
          });
          existingIds.add(id);
          addedCount += 1;
        });
    });

  return {
    milestoneEvents: existing,
    addedCount,
    skippedCount,
    legacyCount,
  };
};

