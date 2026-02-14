import { describe, expect, it } from "vitest";
import type { CashflowEvent } from "../../../domain/scenarioV2/events";
import { computeEffectiveRanges } from "../salaryAdjustmentGrouping";

describe("computeEffectiveRanges", () => {
  it("chains salary ranges without inverted months", () => {
    const base: CashflowEvent = {
      id: "base",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 67000,
      startMonth: "2026-02",
    };
    const adjA: CashflowEvent = {
      id: "adj-a",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 80000,
      startMonth: "2028-02",
      parentEventId: "base",
      tags: ["salary_adjustment", "salary_parent:base"],
    };
    const adjB: CashflowEvent = {
      id: "adj-b",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 100000,
      startMonth: "2030-02",
      parentEventId: "base",
      tags: ["salary_adjustment", "salary_parent:base"],
    };

    const ranges = computeEffectiveRanges(base, [adjA, adjB]);
    expect(ranges.map((entry) => [entry.from, entry.to])).toEqual([
      ["2026-02", "2028-01"],
      ["2028-02", "2030-01"],
      ["2030-02", null],
    ]);
  });
});
