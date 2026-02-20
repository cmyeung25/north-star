import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import { createEventAdjustmentPayload } from "../adjustments/createEventAdjustment";

const baseSpec = {
  mode: "override" as const,
  amount: 1000,
  effectiveMonth: "2026-01",
};

describe("createEventAdjustmentPayload", () => {
  it("requires effective month", () => {
    const event: ScenarioEvent = {
      id: "salary",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 50000,
      startMonth: "2026-01",
    };
    expect(createEventAdjustmentPayload(event, { ...baseSpec, effectiveMonth: undefined })).toBeNull();
  });

  it("builds cashflow-adjustment payload with parent linkage", () => {
    const event: ScenarioEvent = {
      id: "salary",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 50000,
      startMonth: "2026-01",
      endMonth: "2028-12",
    };

    const payload = createEventAdjustmentPayload(event, baseSpec);

    expect(payload).toEqual({
      type: "cashflow-adjustment",
      baseEvent: {
        id: "salary",
        type: "cashflow",
        parentEventId: "salary",
        tags: ["adjustment", "salary_adjustment", "salary_parent:salary"],
        groupId: "salary",
        groupRole: "adjustment",
        effectiveMonth: "2026-01",
        meta: { kind: "adjustment", parentEventId: "salary", adjustsEventId: "salary" },
        parentStartMonth: "2026-01",
        parentEndMonth: "2028-12",
      },
      spec: baseSpec,
    });
  });

  it("builds parent linkage metadata for non-cashflow types", () => {
    const housing: ScenarioEvent = {
      id: "housing-1",
      type: "housing",
      kind: "rent",
      startMonth: "2026-01",
      endMonth: "2027-12",
      rentMonthly: 30000,
    };
    const loan: ScenarioEvent = {
      id: "loan-1",
      type: "loan",
      loanKind: "personal",
      startMonth: "2026-01",
      principal: 100000,
      annualInterestRatePct: 2,
      termYears: 2,
      liabilityId: "liability-1",
    };
    const insurance: ScenarioEvent = {
      id: "insurance-1",
      type: "insurance",
      mode: "quick",
      startMonth: "2026-01",
      endMonth: "2026-12",
      premiumMonthly: 2000,
    };
    const adjustment: ScenarioEvent = {
      id: "balance-adjustment",
      type: "adjustment",
      kind: "cash",
      month: "2026-01",
      amount: 3000,
    };

    expect(createEventAdjustmentPayload(housing, baseSpec)?.baseEvent.parentEventId).toBe("housing-1");
    expect(createEventAdjustmentPayload(loan, baseSpec)?.baseEvent.parentEndMonth).toBe("2027-12");
    expect(createEventAdjustmentPayload(insurance, baseSpec)?.baseEvent.parentEndMonth).toBe("2026-12");
    expect(createEventAdjustmentPayload(adjustment, baseSpec)?.baseEvent.parentEndMonth).toBe("2026-01");
  });
});
