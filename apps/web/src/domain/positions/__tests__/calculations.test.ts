import { describe, expect, it } from "vitest";
import { buildAmortizationSchedule, computeMonthlyPayment } from "../calculations";

describe("amortization calculations", () => {
  it("returns 0 payment when term is 0", () => {
    expect(computeMonthlyPayment(100000, 0.05, 0)).toBe(0);
  });

  it("handles zero interest rate", () => {
    expect(computeMonthlyPayment(120000, 0, 12)).toBeCloseTo(10000);
  });

  it("guards schedule with zero term", () => {
    const schedule = buildAmortizationSchedule({
      principal: 100000,
      annualRateDecimal: 0.05,
      termMonths: 0,
      startMonth: "2024-01",
    });
    expect(schedule).toHaveLength(0);
  });
});
