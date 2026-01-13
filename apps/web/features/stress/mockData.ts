import { defaultCurrency } from "../../lib/i18n";
import type { Kpis, TimeSeriesPoint } from "./types";

type ScenarioSummary = {
  id: string;
  name: string;
  baseCurrency: string;
  isActive: boolean;
};

const buildSeries = (months: number): TimeSeriesPoint[] => {
  const start = new Date();
  const points: TimeSeriesPoint[] = [];
  let value = 42000;

  for (let i = 0; i < months; i += 1) {
    const current = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const monthLabel = `${current.getFullYear()}-${String(
      current.getMonth() + 1
    ).padStart(2, "0")}`;
    value += 1200 + Math.sin(i / 3) * 800;
    points.push({ month: monthLabel, value: Math.round(value) });
  }

  return points;
};

export const mockScenarios: ScenarioSummary[] = [
  {
    id: "scenario-1",
    name: "方案 A · 租屋 + 寶寶",
    baseCurrency: defaultCurrency,
    isActive: true,
  },
  {
    id: "scenario-2",
    name: "方案 B · 買樓",
    baseCurrency: defaultCurrency,
    isActive: false,
  },
  {
    id: "scenario-3",
    name: "方案 C · 延後買車",
    baseCurrency: defaultCurrency,
    isActive: false,
  },
];

export const baselineKpis: Kpis = {
  lowestMonthlyBalance: 12000,
  runwayMonths: 18,
  netWorthYear5: 1850000,
  riskLevel: "Low",
};

export const baselineSeries: TimeSeriesPoint[] = buildSeries(36);
