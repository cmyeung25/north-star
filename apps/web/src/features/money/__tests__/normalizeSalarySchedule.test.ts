import { describe, expect, it } from "vitest";
import type { CashflowEvent } from "../../../domain/scenarioV2/events";
import { normalizeSalarySchedule } from "../normalizeSalarySchedule";

const baseEvent: CashflowEvent = {
  id: "salary-gary",
  type: "cashflow",
  kind: "income",
  cadence: "monthly",
  amount: 67000,
  startMonth: "2026-02",
  growthMode: "assumption",
};

describe("normalizeSalarySchedule", () => {
  it("builds non-overlap salary segments", () => {
    const adjustmentA: CashflowEvent = {
      id: "adj-a",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 80000,
      startMonth: "2028-02",
      tags: ["salary_adjustment", "salary_parent:salary-gary"],
      growthMode: "none",
    };
    const adjustmentB: CashflowEvent = {
      id: "adj-b",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 100000,
      startMonth: "2030-02",
      tags: ["salary_adjustment", "salary_parent:salary-gary"],
      growthMode: "none",
    };

    const normalized = normalizeSalarySchedule(baseEvent, [adjustmentB, adjustmentA]);

    expect(normalized.base.endMonth).toBe("2028-01");
    expect(normalized.adjustments[0]?.id).toBe("adj-a");
    expect(normalized.adjustments[0]?.endMonth).toBe("2030-01");
    expect(normalized.adjustments[1]?.id).toBe("adj-b");
    expect(normalized.adjustments[1]?.endMonth).toBeUndefined();
    expect(normalized.adjustments[0]?.growthMode).toBe("assumption");
    expect(normalized.issues).toEqual([]);
  });

  it("guards duplicated start months", () => {
    const normalized = normalizeSalarySchedule(baseEvent, [
      {
        id: "adj-a",
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 80000,
        startMonth: "2028-02",
      },
      {
        id: "adj-b",
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 100000,
        startMonth: "2028-02",
      },
    ]);

    expect(normalized.issues).toContain("duplicate_adjustment_start_month");
    expect(normalized.adjustments).toHaveLength(1);
  });
});
