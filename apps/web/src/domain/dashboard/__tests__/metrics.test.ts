import { describe, expect, it } from "vitest";
import type { ProjectionResult } from "@north-star/engine";
import { computeDashboardMetrics } from "../metrics";
import type { CashflowItem } from "../../ledger/types";

const baseProjection = {
  baseMonth: "2025-01",
  months: [
    "2025-01","2025-02","2025-03","2025-04","2025-05","2025-06",
    "2025-07","2025-08","2025-09","2025-10","2025-11","2025-12",
  ],
  cashBalance: [100_000, 90_000, 80_000, 70_000, 60_000, 50_000, 40_000, 30_000, 20_000, 10_000, -5_000, -8_000],
  netWorth: [900_000, 910_000, 930_000, 950_000, 970_000, 995_000, 1_010_000, 1_020_000, 1_030_000, 1_040_000, 1_050_000, 1_060_000],
  netCashflow: [],
  assets: { total: [] },
  liabilities: { total: [] },
  breakdown: { cashflow: { byKey: {} } },
} as unknown as ProjectionResult;

describe("computeDashboardMetrics", () => {
  it("computes 12m metrics with strict months", () => {
    const fullLedger: Record<string, CashflowItem[]> = Object.fromEntries(
      baseProjection.months.map((month) => [month, [] as CashflowItem[]])
    );
    fullLedger["2025-01"] = [
      { month: "2025-01", amount: 20_000, source: "event", sourceId: "salary-main" },
      { month: "2025-01", amount: 3_000, source: "event", sourceId: "dividend" },
      { month: "2025-01", amount: -10_000, source: "event", sourceId: "rent", category: "property_ownership" },
    ];
    const metrics = computeDashboardMetrics(
      baseProjection,
      {
        "2025-01": 1000, "2025-02": 1000, "2025-03": -500, "2025-04": -500,
        "2025-05": 1000, "2025-06": 1000, "2025-07": 1000, "2025-08": 1000,
        "2025-09": 1000, "2025-10": 1000, "2025-11": -500, "2025-12": -500,
      },
      fullLedger
    );

    expect(metrics.minCash12m).toEqual({ month: "2025-12", value: -8_000 });
    expect(metrics.deficitMonthsCount12m).toBe(4);
    expect(metrics.firstMillionMonth).toBe("2025-07");
    expect(metrics.riskLevel).toBe("red");
    expect(metrics.avgNonSalaryIncome12m).toBe(250);
    expect(metrics.nonSalaryIncomeRatio).toBeCloseTo(3_000 / 23_000);
    expect(metrics.passiveIncomeCoverage).toBeCloseTo(3_000 / 10_000);
    expect(metrics.assetLinkedExpenseRatio).toBeCloseTo(10_000 / 10_000);
    expect(metrics.savingsRate12m).toBeCloseTo(6_000 / 23_000);
    expect(metrics.expenseToIncomeRatio12m).toBeCloseTo(10_000 / 23_000);
    expect(metrics.debtToAssetRatio).toBeNull();
    expect(metrics.netWorthGrowth12m).toBeCloseTo((1_060_000 - 900_000) / 900_000);
  });

  it("returns null ratios when 12m ledger/projection inputs are incomplete", () => {
    const metrics = computeDashboardMetrics(
      {
        ...baseProjection,
        assets: { total: [1_000_000] },
        liabilities: { total: [300_000] },
      } as unknown as ProjectionResult,
      {
        "2025-01": 1_000,
      },
      {
        "2025-01": [
          { month: "2025-01", amount: 20_000, source: "event", sourceId: "salary-main" },
          { month: "2025-01", amount: -10_000, source: "event", sourceId: "rent" },
        ],
      }
    );

    expect(metrics.savingsRate12m).toBeNull();
    expect(metrics.expenseToIncomeRatio12m).toBeNull();
    expect(metrics.debtToAssetRatio).toBeCloseTo(0.3);
    expect(metrics.netWorthGrowth12m).toBeCloseTo((1_060_000 - 900_000) / 900_000);
    expect(metrics.avgNetCashflow12m).toBeNull();
    expect(metrics.avgNonSalaryIncome12m).toBeNull();
    expect(metrics.avgFunBudget12m).toBeNull();
  });

  it("returns null percentage ratios when denominator is zero", () => {
    const months = baseProjection.months;
    const netCashflow = Object.fromEntries(months.map((month) => [month, 500]));
    const ledger: Record<string, CashflowItem[]> = Object.fromEntries(
      months.map((month) => [
        month,
        [{ month, amount: -2_000, source: "event", sourceId: "living" }],
      ])
    );

    const metrics = computeDashboardMetrics(baseProjection, netCashflow, ledger);

    expect(metrics.savingsRate12m).toBeNull();
    expect(metrics.expenseToIncomeRatio12m).toBeNull();
    expect(metrics.nonSalaryIncomeRatio).toBeNull();
    expect(metrics.passiveIncomeCoverage).toBeNull();
    expect(metrics.assetLinkedExpenseRatio).toBeNull();
  });

  it("supports negative savings rate under sustained negative cashflow", () => {
    const months = baseProjection.months;
    const projection = {
      ...baseProjection,
      assets: { total: [800_000] },
      liabilities: { total: [500_000] },
      netWorth: [1_000_000, 990_000, 980_000, 970_000, 960_000, 950_000, 940_000, 930_000, 920_000, 910_000, 900_000, 880_000],
    } as unknown as ProjectionResult;
    const netCashflow = Object.fromEntries(months.map((month) => [month, -2_000]));
    const ledger: Record<string, CashflowItem[]> = Object.fromEntries(
      months.map((month) => [
        month,
        [
          { month, amount: 10_000, source: "event", sourceId: "salary-main" },
          { month, amount: -12_000, source: "event", sourceId: "living" },
        ],
      ])
    );

    const metrics = computeDashboardMetrics(projection, netCashflow, ledger);

    expect(metrics.savingsRate12m).toBeCloseTo(-0.2);
    expect(metrics.expenseToIncomeRatio12m).toBeCloseTo(1.2);
    expect(metrics.debtToAssetRatio).toBeCloseTo(0.625);
    expect(metrics.netWorthGrowth12m).toBeCloseTo(-0.12);
  });

  it("returns empty when projection is unavailable", () => {
    const metrics = computeDashboardMetrics(null, {}, {});
    expect(metrics.minCash12m).toBeNull();
    expect(metrics.avgNetCashflow12m).toBeNull();
  });
});
