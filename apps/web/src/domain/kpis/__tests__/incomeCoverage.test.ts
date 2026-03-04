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
    expect(ratios.breakdown.totalIncome).toBe(25_000);
    expect(ratios.breakdown.nonSalaryIncome).toBe(5_000);
  });

  it("treats salary subtype as salary even when text does not include salary keyword", () => {
    const ratios = computeIncomeCoverageRatios(
      ["2025-01"],
      {
        "2025-01": [
          {
            month: "2025-01",
            amount: 20_000,
            source: "event",
            sourceId: "evt-uuid-1",
            label: "每月薪金",
            category: "income",
            incomeSubtype: "salary",
          },
          {
            month: "2025-01",
            amount: 5_000,
            source: "event",
            sourceId: "evt-uuid-2",
            label: "股息",
            category: "dividend",
            incomeSubtype: "dividend",
          },
        ],
      }
    );

    expect(ratios.nonSalaryIncomeRatio).toBeCloseTo(5_000 / 25_000);
    expect(ratios.breakdown.fallbackClassifiedIncome).toBe(0);
  });
});
