import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../domain/scenarioV2/events";
import { createEventAdjustmentPayload } from "../adjustments/createEventAdjustment";

const baseSpec = {
  mode: "override" as const,
  amount: 1000,
  effectiveMonth: "2026-01",
};

describe("createEventAdjustmentPayload", () => {
  it("builds cashflow-adjustment payload with salary metadata for monthly income cashflow", () => {
    const event: ScenarioEvent = {
      id: "salary",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 50000,
      startMonth: "2026-01",
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
      },
      spec: baseSpec,
    });
  });

  it("builds cashflow-adjustment payload for non-salary cashflow", () => {
    const event: ScenarioEvent = {
      id: "expense",
      type: "cashflow",
      kind: "expense",
      cadence: "monthly",
      amount: 8000,
      startMonth: "2026-01",
    };

    const payload = createEventAdjustmentPayload(event, baseSpec);

    expect(payload).toEqual({
      type: "cashflow-adjustment",
      baseEvent: { id: "expense", type: "cashflow" },
      spec: baseSpec,
    });
  });

  it("builds housing-adjustment payload", () => {
    const event: ScenarioEvent = {
      id: "housing-1",
      type: "housing",
      kind: "rent",
      startMonth: "2026-01",
      rentMonthly: 30000,
    };

    const payload = createEventAdjustmentPayload(event, baseSpec);

    expect(payload).toEqual({
      type: "housing-adjustment",
      baseEvent: { id: "housing-1", type: "housing" },
      spec: baseSpec,
    });
  });

  it("builds loan-adjustment payload", () => {
    const event: ScenarioEvent = {
      id: "loan-1",
      type: "loan",
      loanKind: "personal",
      startMonth: "2026-01",
      principal: 100000,
      annualInterestRatePct: 2,
      termYears: 5,
      liabilityId: "liability-1",
    };

    const payload = createEventAdjustmentPayload(event, baseSpec);

    expect(payload).toEqual({
      type: "loan-adjustment",
      baseEvent: { id: "loan-1", type: "loan" },
      spec: baseSpec,
    });
  });

  it("builds insurance-adjustment payload", () => {
    const event: ScenarioEvent = {
      id: "insurance-1",
      type: "insurance",
      mode: "quick",
      startMonth: "2026-01",
      premiumMonthly: 2000,
    };

    const payload = createEventAdjustmentPayload(event, baseSpec);

    expect(payload).toEqual({
      type: "insurance-adjustment",
      baseEvent: { id: "insurance-1", type: "insurance" },
      spec: baseSpec,
    });
  });

  it("builds adjustment-adjustment payload", () => {
    const event: ScenarioEvent = {
      id: "balance-adjustment",
      type: "adjustment",
      kind: "cash",
      month: "2026-01",
      amount: 3000,
    };

    const payload = createEventAdjustmentPayload(event, baseSpec);

    expect(payload).toEqual({
      type: "adjustment-adjustment",
      baseEvent: { id: "balance-adjustment", type: "adjustment" },
      spec: baseSpec,
    });
  });
});
