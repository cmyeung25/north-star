import type { MilestoneMarker } from "../../../features/overview/types";
import { normalizeMonthStrict } from "../../utils/month";

type EventLike = {
  id: string;
  name: string;
  startMonth?: string;
  highlighted?: boolean;
};

export type NextKeyEvent = {
  id: string;
  label: string;
  month: string;
  kind: "event" | "milestone";
};

export const getNextKeyEvent = ({
  events,
  milestones,
  baseMonth,
}: {
  events: EventLike[];
  milestones: MilestoneMarker[];
  baseMonth?: string | null;
}): NextKeyEvent | null => {
  const normalizedBase = baseMonth ? normalizeMonthStrict(baseMonth) : null;
  const base = normalizedBase?.ok ? normalizedBase.month : null;

  const candidates: NextKeyEvent[] = [];
  events.forEach((event) => {
    if (!event.highlighted || !event.startMonth) {
      return;
    }
    const normalized = normalizeMonthStrict(event.startMonth);
    if (!normalized.ok) {
      return;
    }
    if (base && normalized.month < base) {
      return;
    }
    candidates.push({
      id: event.id,
      label: event.name,
      month: normalized.month,
      kind: "event",
    });
  });

  milestones.forEach((milestone) => {
    const normalized = normalizeMonthStrict(milestone.month);
    if (!normalized.ok) {
      return;
    }
    if (base && normalized.month < base) {
      return;
    }
    candidates.push({
      id: milestone.id,
      label: milestone.label,
      month: normalized.month,
      kind: "milestone",
    });
  });

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((a, b) => a.month.localeCompare(b.month))[0] ?? null;
};
