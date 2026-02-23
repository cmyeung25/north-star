import { describe, expect, it } from "vitest";
import { computeIncomeCoverageRatios } from "../incomeCoverage";

describe("computeIncomeCoverageRatios", () => {
  it("computes non-salary ratio and passive coverage against core living expenses", () => {
    const ratios = computeIncomeCoverageRatios(
      ["2025-01"],
      {
        "2025-01": [
          { month: "2025-01", amount: 20_000, source: "event", sourceId: "salary-main", category: "salary" },
          { month: "2025-01", amount: 3_000, source: "event", sourceId: "dividend-income", category: "dividend" },
          { month: "2025-01", amount: 2_000, source: "event", sourceId: "rental-income", category: "rental" },
          { month: "2025-01", amount: -8_000, source: "event", sourceId: "rent", category: "property_ownership" },
          { month: "2025-01", amount: -2_000, source: "event", sourceId: "daily", category: "daily_living" },
          { month: "2025-01", amount: -1_000, source: "event", sourceId: "car", category: "vehicle_ownership" },
        ],
      }
    );

    expect(ratios.nonSalaryIncomeRatio).toBeCloseTo(5_000 / 25_000);
    expect(ratios.passiveIncomeCoverage).toBeCloseTo(5_000 / 11_000);
    expect(ratios.assetLinkedExpenseRatio).toBeCloseTo(9_000 / 11_000);
  });
});
