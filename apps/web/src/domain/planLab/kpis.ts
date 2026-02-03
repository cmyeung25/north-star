import type { ProjectionResult } from "@north-star/engine";
import { computeFirstBucket } from "./computeFirstBucket";

export type PlanLabKpiMetrics = {
  minCash: {
    value: number;
    month: string | null;
  } | null;
  firstNegativeCashMonth: string | null;
  endNetWorth: number | null;
  targetMonth: string | null;
};

export const computePlanLabKpis = (
  projection: ProjectionResult | null | undefined,
  targetAmount?: number | null
): PlanLabKpiMetrics | null => {
  if (!projection) {
    return null;
  }

  const minCash = projection.lowestMonthlyBalance
    ? {
        value: projection.lowestMonthlyBalance.value,
        month: projection.lowestMonthlyBalance.month ?? null,
      }
    : null;

  const negativeIndex = projection.cashBalance.findIndex((value) => value < 0);
  const firstNegativeCashMonth =
    negativeIndex >= 0 ? projection.months[negativeIndex] ?? null : null;

  const endNetWorth =
    projection.netWorth.length > 0
      ? projection.netWorth[projection.netWorth.length - 1] ?? null
      : null;

  const targetResult = computeFirstBucket(projection, targetAmount);
  const targetMonth = targetResult?.achievedMonth ?? null;

  return {
    minCash,
    firstNegativeCashMonth,
    endNetWorth,
    targetMonth,
  };
};
