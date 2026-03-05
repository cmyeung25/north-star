import type { ScenarioMember } from "../../store/scenarioStore";
import type { MilestoneEvent } from "../milestoneEvents/types";
import type { ScenarioEventView } from "../events/types";
import { appliesToScenario } from "../applyScope";
import { computeMilestonesForScenario } from "../members/milestones";
import { normalizeMonthStrict } from "../../utils/month";

export type MonthlyHighlight = {
  id: string;
  kind: "milestone" | "event";
  label: string;
  memberName?: string;
};

export type MonthlyHighlights = {
  milestones: MonthlyHighlight[];
  events: MonthlyHighlight[];
};

type GetMonthlyHighlightsParams = {
  scenarioId: string;
  baseMonth?: string | null;
  horizonMonths?: number;
  members: ScenarioMember[];
  milestoneEvents?: MilestoneEvent[];
  eventViews: ScenarioEventView[];
  targetMonth?: string | null;
};

const isWithinRange = (target: string, start: string, end?: string | null) =>
  target >= start && (!end || target <= end);

export const getMonthlyHighlights = ({
  scenarioId,
  baseMonth,
  horizonMonths = 0,
  members,
  milestoneEvents,
  eventViews,
  targetMonth,
}: GetMonthlyHighlightsParams): MonthlyHighlights => {
  const normalizedTarget = targetMonth ? normalizeMonthStrict(targetMonth) : null;
  if (!normalizedTarget || !normalizedTarget.ok) {
    return { milestones: [], events: [] };
  }
  const targetMonthValue = normalizedTarget.month;

  const memberLookup = new Map(
    members
      .filter((member) => appliesToScenario(member.applyScope, scenarioId))
      .map((member) => [member.id, member.name])
  );

  const normalizedBaseMonth = baseMonth ? normalizeMonthStrict(baseMonth) : null;
  const normalizedMilestoneEvents = milestoneEvents ?? [];
  const milestones =
    normalizedMilestoneEvents.length > 0
      ? normalizedMilestoneEvents
          .filter((event) => {
            const normalizedMonth = normalizeMonthStrict(event.effectiveMonth);
            return normalizedMonth.ok && normalizedMonth.month === targetMonthValue;
          })
          .map((event) => ({
            id: event.id,
            kind: "milestone" as const,
            label: event.notes?.trim() || "Milestone",
            memberName:
              event.payload.kind === "money" && event.payload.data.memberId
                ? memberLookup.get(event.payload.data.memberId)
                : undefined,
          }))
      : normalizedBaseMonth?.ok && horizonMonths > 0
      ? computeMilestonesForScenario(
          scenarioId,
          members,
          normalizedBaseMonth.month,
          horizonMonths
        )
          .filter((entry) => {
            const normalizedMonth = normalizeMonthStrict(entry.month);
            return normalizedMonth.ok && normalizedMonth.month === targetMonthValue;
          })
          .map((entry) => ({
            id: entry.id,
            kind: "milestone" as const,
            label: entry.label,
            memberName: entry.memberName,
          }))
      : [];

  const events = eventViews
    .filter((view) => view.ref.highlighted && view.definition.kind === "cashflow")
    .flatMap((view) => {
      const rule = view.rule;
      if (rule.mode === "schedule" && rule.schedule) {
        const hasMatch = rule.schedule.some((entry) => {
          const normalized = normalizeMonthStrict(entry.month);
          return normalized.ok && normalized.month === normalizedTarget.month;
        });
        if (!hasMatch) {
          return [];
        }
      } else {
        const startMonth = rule.startMonth ?? "";
        const normalizedStart = normalizeMonthStrict(startMonth);
        if (!normalizedStart.ok) {
          return [];
        }
        const endMonth = rule.endMonth ?? null;
        const normalizedEnd = endMonth ? normalizeMonthStrict(endMonth) : null;
        if (endMonth && (!normalizedEnd || !normalizedEnd.ok)) {
          return [];
        }
        const endMonthValue = normalizedEnd?.ok ? normalizedEnd.month : null;
        if (
          !isWithinRange(targetMonthValue, normalizedStart.month, endMonthValue)
        ) {
          return [];
        }
      }

      const memberName = view.definition.memberId
        ? memberLookup.get(view.definition.memberId)
        : undefined;

      return [
        {
          id: view.definition.id,
          kind: "event" as const,
          label: view.definition.title,
          memberName,
        },
      ];
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return { milestones, events };
};
