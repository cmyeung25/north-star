import { describe, expect, it } from "vitest";
import { scenarioAssumptionSchema } from "../scenarioAssumptions";

describe("scenarioAssumptionSchema", () => {
  it("accepts negative growth rates within supported range", () => {
    const result = scenarioAssumptionSchema.safeParse({
      inflationRate: -2.5,
      salaryGrowthRate: -3,
      rentAnnualGrowthPct: -1,
      propertyAppreciationPct: -5,
      cashYieldPct: -0.5,
    });

    expect(result.success).toBe(true);
  });

  it("rejects values below the hard floor", () => {
    const result = scenarioAssumptionSchema.safeParse({
      inflationRate: -120,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("validation.assumptionGrowthHardMin");
    }
  });

  it("keeps car depreciation non-negative", () => {
    const result = scenarioAssumptionSchema.safeParse({
      carDepreciationRatePct: -1,
    });

    expect(result.success).toBe(false);
  });
});
