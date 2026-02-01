import type { ScenarioMember, MemberMilestone } from "../../store/scenarioStore";
// import { addMonths } from "./age";
import { appliesToScenario } from "../applyScope";
import { monthAtAge } from "./age";

const defaultMilestoneLabels: Record<string, string> = {
  birth: "出生",
  schoolStart: "上學",
  graduation: "畢業",
  retirement: "退休",
  custom: "里程碑",
};

const normalizeLabel = (milestone: MemberMilestone) =>
  milestone.label?.trim() || defaultMilestoneLabels[milestone.kind] || "里程碑";

const buildBirthMilestone = (member: ScenarioMember): MemberMilestone | null => {
  if (!member.birthMonth) {
    return null;
  }
  return {
    id: `birth-${member.id}`,
    kind: "birth",
    label: defaultMilestoneLabels.birth,
    month: member.birthMonth,
    applyScope: { scope: "all" },
  };
};

// const clampMonthToHorizon = (
//   month: string,
//   baseMonth: string,
//   horizonMonths: number
// ) => {
//   const horizonEnd = addMonths(baseMonth, Math.max(horizonMonths - 1, 0));
//   if (month < baseMonth) {
//     return baseMonth;
//   }
//   if (month > horizonEnd) {
//     return horizonEnd;
//   }
//   return month;
// };

export const computeMilestonesForScenario = (
  scenarioId: string,
  members: ScenarioMember[],
  baseMonth: string,
  horizonMonths: number
) => {
  if (!baseMonth || horizonMonths <= 0) {
    return [];
  }

  return members
    .filter((member) => appliesToScenario(member.applyScope, scenarioId))
    .flatMap((member) => {
      const milestones = [...(member.milestones ?? [])];
      const hasBirthMilestone = milestones.some((milestone) => milestone.kind === "birth");
      const birthMilestone = hasBirthMilestone ? null : buildBirthMilestone(member);
      if (birthMilestone) {
        milestones.push(birthMilestone);
      }

      return milestones
        .filter((milestone) => appliesToScenario(milestone.applyScope, scenarioId))
        .map((milestone) => {
          let month = milestone.month;
          if (!month && typeof milestone.atAgeYears === "number") {
            month = monthAtAge(member, milestone.atAgeYears, baseMonth) ?? undefined;
          }
          if (!month && milestone.kind === "birth") {
            month = member.birthMonth;
          }

          if (!month) {
            return null;
          }

          // const clampedMonth = clampMonthToHorizon(month, baseMonth, horizonMonths);

          return {
            id: milestone.id,
            month: month,
            label: normalizeLabel(milestone),
            memberName: member.name,
            kind: milestone.kind,
            atAgeYears: milestone.atAgeYears,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    })
    .sort((a, b) => a.month.localeCompare(b.month));
};
