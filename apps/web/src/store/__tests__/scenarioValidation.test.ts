import { describe, expect, it } from "vitest";
import { HomePositionSchema } from "../scenarioValidation";

describe("HomePositionSchema", () => {
  it("fails when purchasePrice is missing", () => {
    const result = HomePositionSchema.safeParse({
      downPayment: 500000,
      purchaseMonth: "2026-01",
      annualAppreciationPct: 2,
      mortgageRatePct: 3.5,
      mortgageTermYears: 30,
    });

    expect(result.success).toBe(false);
  });

  it("fails when downPayment exceeds purchasePrice", () => {
    const result = HomePositionSchema.safeParse({
      purchasePrice: 1000000,
      downPayment: 1500000,
      purchaseMonth: "2026-01",
      annualAppreciationPct: 2,
      mortgageRatePct: 3.5,
      mortgageTermYears: 30,
    });

    expect(result.success).toBe(false);
  });
});
