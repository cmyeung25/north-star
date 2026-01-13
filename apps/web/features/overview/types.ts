export type RiskLevel = "Low" | "Medium" | "High";

export interface OverviewKpis {
  lowestMonthlyBalance: number;
  runwayMonths: number;
  netWorthYear5: number;
  riskLevel: RiskLevel;
}

export interface TimeSeriesPoint {
  month: string;
  value: number;
}
