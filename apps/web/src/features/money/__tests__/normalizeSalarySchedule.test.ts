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
  it("keeps baseline and child storage ranges unchanged", () => {
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

    expect(normalized.base.endMonth).toBeUndefined();
    expect(normalized.base.groupId).toBe("salary-gary");
    expect(normalized.base.groupRole).toBe("base");
    expect(normalized.adjustments[0]?.id).toBe("adj-a");
    expect(normalized.adjustments[0]?.endMonth).toBeUndefined();
    expect(normalized.adjustments[1]?.id).toBe("adj-b");
    expect(normalized.adjustments[1]?.endMonth).toBeUndefined();
    expect(normalized.adjustments[0]?.groupId).toBe("salary-gary");
    expect(normalized.adjustments[0]?.groupRole).toBe("adjustment");
    expect(normalized.adjustments[0]?.effectiveMonth).toBe("2028-02");
    expect(normalized.adjustments[0]?.growthMode).toBe("none");
    expect(normalized.adjustments[1]?.growthMode).toBe("none");
    expect(normalized.adjustments[0]?.meta?.parentEventId).toBe("salary-gary");
    expect(normalized.adjustments[0]?.meta?.relationType).toBe("adjustment");
    expect(normalized.adjustments[0]?.meta?.adjustableKey).toBe("salary");
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
    expect(normalized.adjustments).toHaveLength(2);
  });

  it("guards adjustments starting after base end month", () => {
    const normalized = normalizeSalarySchedule(
      {
        ...baseEvent,
        endMonth: "2028-12",
      },
      [
        {
          id: "adj-a",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 80000,
          startMonth: "2029-01",
        },
      ]
    );

    expect(normalized.issues).toContain("adjustment_after_base_end");
    expect(normalized.adjustments).toHaveLength(1);
  });

  it("does not mutate baseline temporal fields when adjustments exist", () => {
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
        startMonth: "2030-02",
      },
    ]);

    expect(normalized.base.startMonth).toBe("2026-02");
    expect(normalized.base.endMonth).toBeUndefined();
  });

});
