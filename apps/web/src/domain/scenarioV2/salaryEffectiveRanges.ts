import type { CashflowEvent, ScenarioEvent } from "./events";
import {
  computeDisplaySegments,
  getEventBaseEventId,
  getEventSegmentRole,
  type SegmentIssue,
} from "./eventSegments";

export const SALARY_ADJUSTMENT_PARENT_PREFIX = "salary_parent:";

export type SalaryEffectiveRangeIssue =
  | "missing_adjustment_start_month"
  | "adjustment_before_base_start"
  | "duplicate_adjustment_start_month"
  | "adjustment_after_base_end"
  | "missing_parent"
  | "invalid_parent_type";

export type SalaryEffectiveRangeSegment = {
  sourceEventId: string;
  event: CashflowEvent;
  from: string | null;
  to: string | null;
};

export type DerivedAdjustableRange = {
  sourceEventId: string;
  event: CashflowEvent;
  effectiveStart: string;
  effectiveEnd: string | null;
};

const isSalaryEvent = (event: ScenarioEvent): event is CashflowEvent =>
  event.type === "cashflow" && event.kind === "income" && event.cadence === "monthly";

const syncGrowthFromBase = (base: CashflowEvent, event: CashflowEvent): CashflowEvent => ({
  ...event,
  growthMode: event.growthMode ?? base.growthMode,
  growthSource: event.growthSource ?? base.growthSource,
  customGrowthRatePct: event.customGrowthRatePct ?? base.customGrowthRatePct,
});

const toLegacyIssue = (issue: SegmentIssue): SalaryEffectiveRangeIssue => {
  switch (issue) {
    case "missing_segment_start_month":
      return "missing_adjustment_start_month";
    case "duplicate_segment_start_month":
      return "duplicate_adjustment_start_month";
    case "segment_before_parent_start":
      return "adjustment_before_base_start";
    case "segment_after_parent_end":
      return "adjustment_after_base_end";
    default:
      return "missing_parent";
  }
};

export const getSalaryAdjustmentParentId = (event: ScenarioEvent): string | null => {
  const parentTag = event.tags?.find((tag) => tag.startsWith(SALARY_ADJUSTMENT_PARENT_PREFIX));
  const taggedParentId = parentTag?.slice(SALARY_ADJUSTMENT_PARENT_PREFIX.length);
  const baseEventId = getEventBaseEventId(event);
  if (baseEventId !== event.id) {
    return baseEventId;
  }
  return taggedParentId ?? null;
};

export const computeSalaryEffectiveRangeSegments = (
  events: ScenarioEvent[]
): { segments: SalaryEffectiveRangeSegment[]; issues: SalaryEffectiveRangeIssue[] } => {
  const salaryEvents = events.filter(isSalaryEvent);
  const groupMap = new Map<string, CashflowEvent[]>();
  salaryEvents.forEach((event) => {
    const baseEventId = getEventBaseEventId(event);
    const bucket = groupMap.get(baseEventId) ?? [];
    bucket.push(event);
    groupMap.set(baseEventId, bucket);
  });

  const issues: SalaryEffectiveRangeIssue[] = [];
  const segments = Array.from(groupMap.values()).flatMap<SalaryEffectiveRangeSegment>((groupEvents) => {
    const parent =
      groupEvents.find((event) => getEventSegmentRole(event) === "parent") ?? groupEvents[0];
    const localIssues: SegmentIssue[] = [];
    const derived = computeDisplaySegments(groupEvents, localIssues);
    issues.push(...localIssues.map(toLegacyIssue));
    return derived.map((segment) => ({
      sourceEventId: segment.sourceEventId,
      event: {
        ...syncGrowthFromBase(parent, segment.event),
        baseEventId: getEventBaseEventId(segment.event),
        segmentRole: getEventSegmentRole(segment.event),
      },
      from: segment.effectiveStart,
      to: segment.effectiveEnd,
    }));
  });

  return { segments, issues };
};

export const deriveEffectiveRangesForAdjustableGroup = (
  events: CashflowEvent[],
  existingIssues: SalaryEffectiveRangeIssue[] = []
): DerivedAdjustableRange[] => {
  const localIssues: SegmentIssue[] = [];
  const segments = computeDisplaySegments(events, localIssues);
  existingIssues.push(...localIssues.map(toLegacyIssue));
  return segments.map((segment) => ({
    sourceEventId: segment.sourceEventId,
    event: segment.event,
    effectiveStart: segment.effectiveStart,
    effectiveEnd: segment.effectiveEnd,
  }));
};
