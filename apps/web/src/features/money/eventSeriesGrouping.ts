import type { ScenarioEvent } from "../../domain/scenarioV2/events";
import {
  computeDisplaySegments,
  getEventSegmentRole,
  groupByBaseEventId,
} from "../../domain/scenarioV2/eventSegments";
import { compareMonthKey } from "../../utils/monthKey";
import { resolveEventCardEndMonth, resolveEventCardStartMonth } from "./eventCardUtils";

export type GroupedEventSeries = {
  baseEvent: ScenarioEvent;
  adjustments: ScenarioEvent[];
  groupStartMonth: string | null;
  groupEndMonth: string | null;
};

const toMonth = (value: string | null) => value ?? "9999-12";

export const groupEventSeries = (events: ScenarioEvent[]): GroupedEventSeries[] => {
  const groups = Array.from(groupByBaseEventId(events).values());

  return groups.map((groupEvents) => {
    const parent =
      groupEvents.find((event) => getEventSegmentRole(event) === "parent") ??
      groupEvents[0];
    if (!parent) {
      throw new Error("groupEventSeries expected non-empty group");
    }

    const childEvents = groupEvents
      .filter((event) => event.id !== parent.id)
      .sort((left, right) =>
        compareMonthKey(
          toMonth(resolveEventCardStartMonth(left)),
          toMonth(resolveEventCardStartMonth(right))
        )
      );

    const segments = computeDisplaySegments(groupEvents);
    const startMonths = segments
      .map((segment) => segment.effectiveStart)
      .filter((value): value is string => Boolean(value));
    const endMonths = segments
      .map((segment) => segment.effectiveEnd)
      .filter((value): value is string => Boolean(value));

    const groupStartMonth =
      startMonths.length > 0
        ? startMonths.sort((a, b) => compareMonthKey(a, b))[0] ?? null
        : resolveEventCardStartMonth(parent);
    const groupEndMonth =
      endMonths.length > 0
        ? endMonths.sort((a, b) => compareMonthKey(b, a))[0] ?? null
        : resolveEventCardEndMonth(parent);

    return {
      baseEvent: parent,
      adjustments: childEvents,
      groupStartMonth,
      groupEndMonth,
    };
  });
};
