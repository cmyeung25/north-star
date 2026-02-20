import { addMonths } from "../members/age";
import { compareMonthKey, isValidMonthKey } from "../../utils/monthKey";
import type { ScenarioEvent } from "./events";

export type SegmentRole = "parent" | "child";

export type SegmentDisplay<TEvent extends ScenarioEvent = ScenarioEvent> = {
  sourceEventId: string;
  event: TEvent;
  effectiveStart: string;
  effectiveEnd: string | null;
};

export type SegmentIssue =
  | "missing_segment_start_month"
  | "duplicate_segment_start_month"
  | "segment_before_parent_start"
  | "segment_after_parent_end"
  | "missing_parent";

const monthBefore = (month: string) => addMonths(month, -1);

const minMonth = (...values: Array<string | undefined>): string | undefined => {
  const valid = values.filter((value): value is string => Boolean(value));
  if (valid.length === 0) {
    return undefined;
  }
  return valid.sort((a, b) => compareMonthKey(a, b))[0];
};

export const getEventBaseEventId = (event: ScenarioEvent): string => {
  const metaParentId =
    typeof event.meta?.parentEventId === "string" ? event.meta.parentEventId : undefined;
  const adjustsEventId =
    typeof event.meta?.adjustsEventId === "string" ? event.meta.adjustsEventId : undefined;
  return (
    (event as { baseEventId?: string }).baseEventId ??
    event.parentEventId ??
    metaParentId ??
    adjustsEventId ??
    event.id
  );
};

export const getEventSegmentRole = (event: ScenarioEvent): SegmentRole => {
  const explicit = (event as { segmentRole?: SegmentRole }).segmentRole;
  if (explicit === "child" || event.groupRole === "adjustment") {
    return "child";
  }
  if (explicit === "parent") {
    return "parent";
  }
  return getEventBaseEventId(event) === event.id ? "parent" : "child";
};

export const getEventStartMonth = (event: ScenarioEvent): string | null => {
  if (getEventSegmentRole(event) === "child" && event.effectiveMonth) {
    return event.effectiveMonth;
  }
  if (event.type === "adjustment") {
    return event.month ?? null;
  }
  if (event.type === "cashflow") {
    return event.cadence === "oneOff" ? event.occurrenceMonth ?? null : event.startMonth ?? null;
  }
  return event.startMonth ?? null;
};

export const getEventEndMonth = (event: ScenarioEvent): string | null => {
  if (event.type === "cashflow") {
    if (event.cadence === "oneOff") {
      return event.occurrenceMonth ?? null;
    }
    return event.endMonth ?? null;
  }
  if (event.type === "housing" || event.type === "insurance") {
    return event.endMonth ?? null;
  }
  if (event.type === "loan") {
    const termMonths = Math.max(0, Math.round((event.termYears ?? 0) * 12));
    if (!event.startMonth || termMonths <= 0) {
      return null;
    }
    return addMonths(event.startMonth, termMonths - 1);
  }
  if (event.type === "adjustment") {
    return event.month ?? null;
  }
  return null;
};

const withEffectiveRange = <TEvent extends ScenarioEvent>(
  event: TEvent,
  startMonth: string,
  endMonth: string | null
): TEvent => {
  if (event.type === "adjustment") {
    return { ...event, month: startMonth, baseEventId: getEventBaseEventId(event), segmentRole: getEventSegmentRole(event) } as TEvent;
  }
  if (event.type === "cashflow") {
    if (event.cadence === "oneOff") {
      return {
        ...event,
        occurrenceMonth: startMonth,
        baseEventId: getEventBaseEventId(event),
        segmentRole: getEventSegmentRole(event),
      } as TEvent;
    }
    return {
      ...event,
      startMonth,
      endMonth: endMonth ?? undefined,
      baseEventId: getEventBaseEventId(event),
      segmentRole: getEventSegmentRole(event),
    } as TEvent;
  }
  if (event.type === "housing" || event.type === "insurance") {
    return {
      ...event,
      startMonth,
      endMonth: endMonth ?? undefined,
      baseEventId: getEventBaseEventId(event),
      segmentRole: getEventSegmentRole(event),
    } as TEvent;
  }
  if (event.type === "loan") {
    return {
      ...event,
      startMonth,
      endMonth: endMonth ?? undefined,
      baseEventId: getEventBaseEventId(event),
      segmentRole: getEventSegmentRole(event),
    } as TEvent;
  }
  return { ...event, startMonth, baseEventId: getEventBaseEventId(event), segmentRole: getEventSegmentRole(event) } as TEvent;
};

export const groupByBaseEventId = <TEvent extends ScenarioEvent>(events: TEvent[]) => {
  const grouped = new Map<string, TEvent[]>();
  events.forEach((event) => {
    const baseEventId = getEventBaseEventId(event);
    const bucket = grouped.get(baseEventId) ?? [];
    bucket.push(event);
    grouped.set(baseEventId, bucket);
  });
  return grouped;
};

export const computeDisplaySegments = <TEvent extends ScenarioEvent>(
  events: TEvent[],
  existingIssues: SegmentIssue[] = []
): SegmentDisplay<TEvent>[] => {
  if (events.length === 0) {
    return [];
  }
  const parent =
    events.find((event) => getEventSegmentRole(event) === "parent") ??
    events.find((event) => getEventBaseEventId(event) === event.id) ??
    events[0];

  const parentStart = getEventStartMonth(parent);
  if (!parentStart || !isValidMonthKey(parentStart)) {
    return [];
  }

  const parentEnd = getEventEndMonth(parent) ?? undefined;
  const sorted = [...events].sort((left, right) => {
    const leftStart = getEventStartMonth(left) ?? "9999-12";
    const rightStart = getEventStartMonth(right) ?? "9999-12";
    const startCompare = compareMonthKey(leftStart, rightStart);
    if (startCompare !== 0) {
      return startCompare;
    }
    return left.id.localeCompare(right.id);
  });

  const uniqueByStart = new Map<string, TEvent>();
  sorted.forEach((event) => {
    const startMonth = getEventStartMonth(event);
    if (!startMonth || !isValidMonthKey(startMonth)) {
      if (event.id !== parent.id) {
        existingIssues.push("missing_segment_start_month");
      }
      return;
    }
    if (event.id !== parent.id && compareMonthKey(startMonth, parentStart) < 0) {
      existingIssues.push("segment_before_parent_start");
      return;
    }
    if (event.id !== parent.id && parentEnd && compareMonthKey(startMonth, parentEnd) > 0) {
      existingIssues.push("segment_after_parent_end");
      return;
    }
    if (uniqueByStart.has(startMonth)) {
      existingIssues.push("duplicate_segment_start_month");
    }
    uniqueByStart.set(startMonth, event);
  });

  const valid = Array.from(uniqueByStart.entries())
    .sort(([left], [right]) => compareMonthKey(left, right))
    .map(([, event]) => event);

  return valid.flatMap((event, index) => {
    const startMonth = getEventStartMonth(event);
    if (!startMonth) {
      return [];
    }
    const nextEvent = valid[index + 1];
    const nextStart = nextEvent ? getEventStartMonth(nextEvent) ?? undefined : undefined;
    const effectiveEnd = minMonth(
      event.id === parent.id ? parentEnd : getEventEndMonth(event) ?? undefined,
      nextStart ? monthBefore(nextStart) : undefined,
      index === valid.length - 1 ? parentEnd : undefined
    );
    if (effectiveEnd && compareMonthKey(startMonth, effectiveEnd) > 0) {
      return [];
    }
    return [
      {
        sourceEventId: event.id,
        event: withEffectiveRange(event, startMonth, effectiveEnd ?? null),
        effectiveStart: startMonth,
        effectiveEnd: effectiveEnd ?? null,
      },
    ];
  });
};

export const resolveEffectiveSegment = <TEvent extends ScenarioEvent>(
  segments: SegmentDisplay<TEvent>[],
  month: string
): SegmentDisplay<TEvent> | null => {
  let selected: SegmentDisplay<TEvent> | null = null;
  segments.forEach((segment) => {
    if (compareMonthKey(segment.effectiveStart, month) > 0) {
      return;
    }
    if (segment.effectiveEnd && compareMonthKey(segment.effectiveEnd, month) < 0) {
      return;
    }
    if (!selected || compareMonthKey(selected.effectiveStart, segment.effectiveStart) < 0) {
      selected = segment;
    }
  });
  return selected;
};
