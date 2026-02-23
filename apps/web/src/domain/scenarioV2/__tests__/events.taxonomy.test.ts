import { describe, expect, it } from "vitest";
import { ScenarioEventSchema } from "../events";

describe("ScenarioEventSchema taxonomy", () => {
  it("validates housing/loan/insurance/adjustment without falling back to cashflow", () => {
    const housing = ScenarioEventSchema.parse({
      id: "h1",
      type: "housing",
      kind: "rent",
      startMonth: "2026-01",
      rentMonthly: 12000,
    });
    const loan = ScenarioEventSchema.parse({
      id: "l1",
      type: "loan",
      loanKind: "personal",
      startMonth: "2026-01",
      principal: 200000,
      annualInterestRatePct: 2.5,
      termYears: 5,
      liabilityId: "liab-1",
    });
    const insurance = ScenarioEventSchema.parse({
      id: "i1",
      type: "insurance",
      mode: "quick",
      startMonth: "2026-01",
      premiumMonthly: 1500,
    });
    const adjustment = ScenarioEventSchema.parse({
      id: "a1",
      type: "adjustment",
      kind: "cash",
      month: "2026-03",
      amount: 300,
    });

    expect(housing.type).toBe("housing");
    expect(loan.type).toBe("loan");
    expect(insurance.type).toBe("insurance");
    expect(adjustment.type).toBe("adjustment");
  });
});
