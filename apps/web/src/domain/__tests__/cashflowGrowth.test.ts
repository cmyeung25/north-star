import { describe, expect, it } from "vitest";
import { applyAnnualGrowth } from "../cashflowGrowth";

describe("applyAnnualGrowth", () => {
  it("compounds monthly growth from an annual rate", () => {
    const baseAmount = 30000;
    const annualGrowthPct = 3;
    const monthIndex = 12;
    const monthlyRate = Math.pow(1 + annualGrowthPct / 100, 1 / 12) - 1;
    const expected = baseAmount * Math.pow(1 + monthlyRate, monthIndex);

    expect(applyAnnualGrowth(baseAmount, annualGrowthPct, monthIndex)).toBeCloseTo(
      expected,
      6
    );
  });
});
