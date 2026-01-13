export type StressType = "job_loss" | "rate_hike" | "medical";

export type StressConfig = {
  type: StressType;
  label: string;
  params: Record<string, unknown>;
};

export type Kpis = {
  lowestMonthlyBalance: number;
  runwayMonths: number;
  netWorthYear5: number;
  riskLevel: "Low" | "Medium" | "High";
};

export type TimeSeriesPoint = {
  month: string;
  value: number;
};
