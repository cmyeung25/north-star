import { describe, expect, it } from "vitest";
import type { CashflowEvent } from "../events";
import {
  computeDisplaySegments,
  resolveEffectiveSegment,
} from "../eventSegments";
import type { SegmentIssue } from "../eventSegments";

describe("eventSegments", () => {
  it("computes display periods from next segment start", () => {
    const parent: CashflowEvent = {
      id: "income-base",
      baseEventId: "income-base",
      segmentRole: "parent",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 30000,
      startMonth: "2026-02",
    };
    const childA: CashflowEvent = {
      id: "income-child-a",
      baseEventId: "income-base",
      segmentRole: "child",
      parentEventId: "income-base",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 36000,
      startMonth: "2028-02",
    };
    const childB: CashflowEvent = {
      id: "income-child-b",
      baseEventId: "income-base",
      segmentRole: "child",
      parentEventId: "income-base",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 42000,
      startMonth: "2030-02",
    };

    const segments = computeDisplaySegments([parent, childA, childB]);

    expect(segments.map((segment) => [segment.sourceEventId, segment.effectiveStart, segment.effectiveEnd])).toEqual([
      ["income-base", "2026-02", "2028-01"],
      ["income-child-a", "2028-02", "2030-01"],
      ["income-child-b", "2030-02", null],
    ]);
  });

  it("resolves effective segment with latest-start-wins", () => {
    const events: CashflowEvent[] = [
      {
        id: "expense-base",
        baseEventId: "expense-base",
        segmentRole: "parent",
        type: "cashflow",
        kind: "expense",
        cadence: "monthly",
        amount: -10000,
        startMonth: "2026-01",
      },
      {
        id: "expense-child",
        baseEventId: "expense-base",
        segmentRole: "child",
        parentEventId: "expense-base",
        type: "cashflow",
        kind: "expense",
        cadence: "monthly",
        amount: -14000,
        startMonth: "2027-01",
      },
    ];

    const segments = computeDisplaySegments(events);
    expect(resolveEffectiveSegment(segments, "2026-06")?.sourceEventId).toBe("expense-base");
    expect(resolveEffectiveSegment(segments, "2027-06")?.sourceEventId).toBe("expense-child");
  });

  it("warns duplicate start months within same base group", () => {
    const parent: CashflowEvent = {
      id: "base",
      baseEventId: "base",
      segmentRole: "parent",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 100,
      startMonth: "2026-01",
    };
    const childA: CashflowEvent = {
      id: "a",
      baseEventId: "base",
      segmentRole: "child",
      parentEventId: "base",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 110,
      startMonth: "2027-01",
    };
    const childB: CashflowEvent = {
      id: "b",
      baseEventId: "base",
      segmentRole: "child",
      parentEventId: "base",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 120,
      startMonth: "2027-01",
    };

    const issues: SegmentIssue[] = [];
    const segments = computeDisplaySegments([parent, childA, childB], issues);

    expect(issues).toContain("duplicate_segment_start_month");
    expect(segments).toHaveLength(2);
  });
});
