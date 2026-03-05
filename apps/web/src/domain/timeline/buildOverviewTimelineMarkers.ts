import type { MilestoneMarker } from "../../../features/overview/types";
import type { MilestoneEvent, MilestoneEventTemplateType } from "../milestoneEvents/types";
import type { ScenarioMember } from "../../store/scenarioStore";
import { appliesToScenario } from "../applyScope";
import { normalizeMonthStrict } from "../../utils/month";

export type HighlightedTimelineEventInput = {
  id: string;
  name: string;
  startMonth?: string;
  highlighted?: boolean;
  memberId?: string;
};

export type BuildOverviewTimelineMarkersParams = {
  scenarioId: string;
  baseMonth?: string | null;
  horizonMonths?: number;
  members: ScenarioMember[];
  milestoneEvents?: MilestoneEvent[];
  highlightedEvents: HighlightedTimelineEventInput[];
};

export type OverviewTimelineMarkerSelectorResult = {
  markers: MilestoneMarker[];
  highlightedEvents: HighlightedTimelineEventInput[];
};

const fallbackTemplateLabelByType: Record<MilestoneEventTemplateType, string> = {
  member_birth: "Birth",
  member_school_start: "School start",
  member_retirement: "Retirement",
  custom: "Milestone",
};

const isWithinHorizon = (
  month: string,
  baseMonth?: string | null,
  horizonMonths?: number
) => {
  const normalizedBase = baseMonth ? normalizeMonthStrict(baseMonth) : null;
  if (!normalizedBase?.ok || !horizonMonths || horizonMonths <= 0) {
    return true;
  }

  if (month < normalizedBase.month) {
    return false;
  }

  const [baseYear, baseMonthNum] = normalizedBase.month.split("-").map(Number);
  const [year, monthNum] = month.split("-").map(Number);
  const monthDiff = (year - baseYear) * 12 + (monthNum - baseMonthNum);
  return monthDiff >= 0 && monthDiff < horizonMonths;
};

const normalizeMarkerMonth = (month?: string | null) => {
  if (!month) {
    return null;
  }
  const normalized = normalizeMonthStrict(month);
  return normalized.ok ? normalized.month : null;
};

const buildMilestoneEventMarker = (
  event: MilestoneEvent,
  memberLookup: Map<string, string>
): MilestoneMarker | null => {
  const month = normalizeMarkerMonth(event.effectiveMonth);
  if (!month) {
    return null;
  }

  const templateType = event.templateType ?? "custom";
  const memberName = event.memberId ? memberLookup.get(event.memberId) ?? "" : "";

  return {
    id: event.id,
    month,
    label: event.notes?.trim() || fallbackTemplateLabelByType[templateType],
    memberName,
    kind: templateType,
  };
};

const buildHighlightedEventMarker = (
  event: HighlightedTimelineEventInput,
  memberName: string
): MilestoneMarker | null => {
  const month = normalizeMarkerMonth(event.startMonth);
  if (!month || !event.highlighted) {
    return null;
  }

  return {
    id: `highlight-${event.id}`,
    month,
    label: event.name,
    memberName,
    kind: "highlighted_event",
  };
};

export const buildOverviewTimelineMarkers = ({
  scenarioId,
  baseMonth,
  horizonMonths,
  members,
  milestoneEvents,
  highlightedEvents,
}: BuildOverviewTimelineMarkersParams): OverviewTimelineMarkerSelectorResult => {
  const scenarioMembers = members.filter((member) =>
    appliesToScenario(member.applyScope, scenarioId)
  );
  const memberLookup = new Map(scenarioMembers.map((member) => [member.id, member.name]));

  const markers = [
    ...(milestoneEvents ?? []).flatMap((event) => {
      const marker = buildMilestoneEventMarker(event, memberLookup);
      return marker ? [marker] : [];
    }),
    ...highlightedEvents.flatMap((event) => {
      const memberName = event.memberId ? memberLookup.get(event.memberId) ?? "" : "";
      const marker = buildHighlightedEventMarker(event, memberName);
      return marker ? [marker] : [];
    }),
  ]
    .filter((marker) => isWithinHorizon(marker.month, baseMonth, horizonMonths))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    markers,
    highlightedEvents: highlightedEvents.filter((event) => {
      const normalized = normalizeMarkerMonth(event.startMonth);
      return Boolean(normalized && isWithinHorizon(normalized, baseMonth, horizonMonths));
    }),
  };
};

