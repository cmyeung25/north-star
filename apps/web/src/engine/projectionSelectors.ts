import type { ProjectionResult } from "@north-star/engine";

export type ProjectionMonthlyRow = {
  month: string;
  cash: number;
  netWorth: number;
  assetsTotal?: number;
  liabilitiesTotal?: number;
};

export const getMonthlyRows = (projection: ProjectionResult): ProjectionMonthlyRow[] =>
  projection.months.map((month, index) => ({
    month,
    cash: projection.cashBalance[index] ?? 0,
    netWorth: projection.netWorth[index] ?? 0,
    assetsTotal: projection.assets?.total?.[index],
    liabilitiesTotal: projection.liabilities?.total?.[index],
  }));
