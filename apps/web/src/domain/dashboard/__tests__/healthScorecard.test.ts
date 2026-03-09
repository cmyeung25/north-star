import { describe, expect, it } from "vitest";
import {
  buildHealthScorecard,
  summarizeHealthScorecard,
} from "../healthScorecard";
import type { DashboardMetrics } from "../metrics";

const makeMetrics = (overrides: Partial<DashboardMetrics>): DashboardMetrics => ({
  minCash12m: null,
  avgNetCashflow12m: null,
  deficitMonthsCount12m: 0,
  cashRunwayMonths: null,
  firstMillionMonth: null,
  avgNonSalaryIncome12m: null,
  nonSalaryIncomeRatio: null,
  passiveIncomeCoverage: null,
  assetLinkedExpenseRatio: null,
  avgFunBudget12m: null,
  savingsRate12m: null,
  expenseToIncomeRatio12m: null,
  debtToAssetRatio: null,
  netWorthGrowth12m: null,
  riskLevel: "green",
  endMonth: "2030-12",
  ...overrides,
});

describe("healthScorecard", () => {
  it("classifies each KPI into a health status", () => {
    const entries = buildHealthScorecard(
      makeMetrics({
        minCash12m: { month: "2026-03", value: -5000 },
        deficitMonthsCount12m: 1,
        avgNetCashflow12m: 2000,
        cashRunwayMonths: 8,
        firstMillionMonth: "2028-01",
        avgNonSalaryIncome12m: 400,
        nonSalaryIncomeRatio: 0.05,
        passiveIncomeCoverage: 1.2,
        assetLinkedExpenseRatio: 0.42,
        avgFunBudget12m: -10,
        savingsRate12m: 0.22,
        expenseToIncomeRatio12m: 0.95,
        debtToAssetRatio: 0.4,
        netWorthGrowth12m: -0.02,
        riskLevel: "red",
      })
    );

    const byMetric = new Map(entries.map((entry) => [entry.metric, entry.status]));

    expect(byMetric.get("minCash")).toBe("vulnerable");
    expect(byMetric.get("deficitMonths")).toBe("progressing");
    expect(byMetric.get("avgNetCashflow")).toBe("excellent");
    expect(byMetric.get("cashRunway")).toBe("vulnerable");
    expect(byMetric.get("firstMillionMonth")).toBe("informational");
    expect(byMetric.get("avgNonSalaryIncome")).toBe("progressing");
    expect(byMetric.get("nonSalaryIncomeRatio")).toBe("vulnerable");
    expect(byMetric.get("passiveIncomeCoverage")).toBe("excellent");
    expect(byMetric.get("assetLinkedExpenseRatio")).toBe("progressing");
    expect(byMetric.get("avgFunBudget")).toBe("vulnerable");
    expect(byMetric.get("savingsRate")).toBe("excellent");
    expect(byMetric.get("expenseToIncomeRatio")).toBe("vulnerable");
    expect(byMetric.get("debtToAssetRatio")).toBe("progressing");
    expect(byMetric.get("netWorthGrowth")).toBe("vulnerable");
    expect(byMetric.get("riskLevel")).toBe("vulnerable");
  });

  it("summarizes status distribution counts", () => {
    const entries = buildHealthScorecard(
      makeMetrics({
        minCash12m: { month: "2026-03", value: 120000 },
        deficitMonthsCount12m: 4,
        avgNetCashflow12m: 0,
        cashRunwayMonths: null,
        firstMillionMonth: null,
        avgNonSalaryIncome12m: 15000,
        nonSalaryIncomeRatio: 0.25,
        passiveIncomeCoverage: 0.2,
        assetLinkedExpenseRatio: null,
        avgFunBudget12m: 5000,
        savingsRate12m: null,
        expenseToIncomeRatio12m: 0.65,
        debtToAssetRatio: 0.25,
        netWorthGrowth12m: 0.12,
        riskLevel: "green",
      })
    );

    expect(summarizeHealthScorecard(entries)).toEqual({
      excellent: 6,
      progressing: 2,
      vulnerable: 2,
      informational: 0,
      "no-data": 5,
    });
  });
});
