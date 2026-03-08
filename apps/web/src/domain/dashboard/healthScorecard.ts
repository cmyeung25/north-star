import type { DashboardMetrics } from "./metrics";

export type HealthScorecardStatus =
  | "excellent"
  | "progressing"
  | "vulnerable"
  | "informational"
  | "no-data";

export type DashboardMetricKey =
  | "minCash"
  | "deficitMonths"
  | "avgNetCashflow"
  | "cashRunway"
  | "firstMillionMonth"
  | "avgNonSalaryIncome"
  | "nonSalaryIncomeRatio"
  | "passiveIncomeCoverage"
  | "assetLinkedExpenseRatio"
  | "avgFunBudget"
  | "riskLevel";

export type HealthScorecardEntry = {
  metric: DashboardMetricKey;
  status: HealthScorecardStatus;
};

export type HealthScorecardDistribution = Record<HealthScorecardStatus, number>;

export const HEALTH_SCORECARD_METRICS: DashboardMetricKey[] = [
  "minCash",
  "deficitMonths",
  "avgNetCashflow",
  "cashRunway",
  "firstMillionMonth",
  "avgNonSalaryIncome",
  "nonSalaryIncomeRatio",
  "passiveIncomeCoverage",
  "assetLinkedExpenseRatio",
  "avgFunBudget",
  "riskLevel",
];

const emptyDistribution = (): HealthScorecardDistribution => ({
  excellent: 0,
  progressing: 0,
  vulnerable: 0,
  informational: 0,
  "no-data": 0,
});

const classifyMetric = (
  metric: DashboardMetricKey,
  dashboardMetrics: DashboardMetrics
): HealthScorecardStatus => {
  switch (metric) {
    case "minCash": {
      const value = dashboardMetrics.minCash12m?.value;
      if (value === undefined) {
        return "no-data";
      }
      if (value >= 100_000) {
        return "excellent";
      }
      return value >= 0 ? "progressing" : "vulnerable";
    }
    case "deficitMonths":
      if (dashboardMetrics.deficitMonthsCount12m === 0) {
        return "excellent";
      }
      return dashboardMetrics.deficitMonthsCount12m <= 2 ? "progressing" : "vulnerable";
    case "avgNetCashflow": {
      const value = dashboardMetrics.avgNetCashflow12m;
      if (value === null) {
        return "no-data";
      }
      if (value > 0) {
        return "excellent";
      }
      return value === 0 ? "progressing" : "vulnerable";
    }
    case "cashRunway": {
      const value = dashboardMetrics.cashRunwayMonths;
      if (value === null) {
        return "no-data";
      }
      if (value >= 12) {
        return "excellent";
      }
      return value >= 6 ? "progressing" : "vulnerable";
    }
    case "firstMillionMonth":
      return dashboardMetrics.firstMillionMonth ? "informational" : "no-data";
    case "avgNonSalaryIncome": {
      const value = dashboardMetrics.avgNonSalaryIncome12m;
      if (value === null) {
        return "no-data";
      }
      if (value >= 10_000) {
        return "excellent";
      }
      return value > 0 ? "progressing" : "vulnerable";
    }
    case "nonSalaryIncomeRatio": {
      const value = dashboardMetrics.nonSalaryIncomeRatio;
      if (value === null) {
        return "no-data";
      }
      if (value >= 0.3) {
        return "excellent";
      }
      return value >= 0.1 ? "progressing" : "vulnerable";
    }
    case "passiveIncomeCoverage": {
      const value = dashboardMetrics.passiveIncomeCoverage;
      if (value === null) {
        return "no-data";
      }
      if (value >= 1) {
        return "excellent";
      }
      return value >= 0.5 ? "progressing" : "vulnerable";
    }
    case "assetLinkedExpenseRatio": {
      const value = dashboardMetrics.assetLinkedExpenseRatio;
      if (value === null) {
        return "no-data";
      }
      if (value <= 0.35) {
        return "excellent";
      }
      return value <= 0.5 ? "progressing" : "vulnerable";
    }
    case "avgFunBudget": {
      const value = dashboardMetrics.avgFunBudget12m;
      if (value === null) {
        return "no-data";
      }
      if (value > 0) {
        return "excellent";
      }
      return value === 0 ? "progressing" : "vulnerable";
    }
    case "riskLevel":
      return dashboardMetrics.riskLevel === "red" ? "vulnerable" : "excellent";
    default:
      return "no-data";
  }
};

export const buildHealthScorecard = (
  dashboardMetrics: DashboardMetrics
): HealthScorecardEntry[] =>
  HEALTH_SCORECARD_METRICS.map((metric) => ({
    metric,
    status: classifyMetric(metric, dashboardMetrics),
  }));

export const summarizeHealthScorecard = (
  entries: HealthScorecardEntry[]
): HealthScorecardDistribution => {
  const summary = emptyDistribution();
  for (const entry of entries) {
    summary[entry.status] += 1;
  }
  return summary;
};

