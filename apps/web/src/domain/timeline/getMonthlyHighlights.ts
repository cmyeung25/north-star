import type { ScenarioMember } from "../../store/scenarioStore";
import type { ScenarioEventView } from "../events/types";
import type { MilestoneMarker } from "../../../features/overview/types";
import { appliesToScenario } from "../applyScope";
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
  members: ScenarioMember[];
  eventViews: ScenarioEventView[];
  milestoneMarkers?: MilestoneMarker[];
  targetMonth?: string | null;
};

const isWithinRange = (target: string, start: string, end?: string | null) =>
  target >= start && (!end || target <= end);

export const getMonthlyHighlights = ({
  scenarioId,
  members,
  eventViews,
  milestoneMarkers,
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

  const milestones = (milestoneMarkers ?? [])
    .filter((entry) => {
      const normalizedMonth = normalizeMonthStrict(entry.month);
      return normalizedMonth.ok && normalizedMonth.month === targetMonthValue;
    })
    .map((entry) => ({
      id: entry.id,
      kind: "milestone" as const,
      label: entry.label,
      memberName: entry.memberName || undefined,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

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
        if (!isWithinRange(targetMonthValue, normalizedStart.month, endMonthValue)) {
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

