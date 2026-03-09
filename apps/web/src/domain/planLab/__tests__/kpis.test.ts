import { describe, expect, it } from "vitest";
import type { ProjectionResult } from "@north-star/engine";
import { computePlanLabKpis } from "../kpis";

const projection = {
  baseMonth: "2025-01",
  months: ["2025-01", "2025-02"],
  cashBalance: [1000, 500],
  netWorth: [10000, 12000],
  lowestMonthlyBalance: { value: 500, month: "2025-02" },
  netCashflow: [],
  assets: { total: [] },
  liabilities: { total: [] },
  breakdown: { cashflow: { byKey: {} } },
} as unknown as ProjectionResult;

describe("computePlanLabKpis", () => {
  it("includes income composition ratios", () => {
    const result = computePlanLabKpis(
      projection,
      null,
      {
        "2025-01": [
          { month: "2025-01", amount: 10_000, source: "event", sourceId: "salary-main", category: "salary" },
          { month: "2025-01", amount: 2_000, source: "event", sourceId: "dividend", category: "dividend" },
          { month: "2025-01", amount: -4_000, source: "event", sourceId: "rent", category: "property_ownership" },
          { month: "2025-01", amount: -1_200, source: "event", sourceId: "school", category: "education" },
        ],
      }
    );

    expect(result?.nonSalaryIncomeRatio).toBeCloseTo(2_000 / 12_000);
    expect(result?.passiveIncomeCoverage).toBeCloseTo(2_000 / 5_200);
    expect(result?.assetLinkedExpenseRatio).toBeCloseTo(4_000 / 5_200);
    expect(result?.educationExpenseRatio).toBeCloseTo(1_200 / 5_200);
  });
});
