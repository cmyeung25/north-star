import { monthIndex, type ProjectionResult } from "@north-star/engine";
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

export type PlanLabKpiDiff = {
  minCash: number | null;
  firstNegativeCashMonth: number | null;
  endNetWorth: number | null;
  targetMonth: number | null;
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

export const diffPlanLabKpis = (
  kpiA: PlanLabKpiMetrics | null,
  kpiB: PlanLabKpiMetrics | null,
  baseMonth: string | null
): PlanLabKpiDiff => {
  const monthDelta = (a: string | null, b: string | null) => {
    if (!baseMonth || !a || !b) {
      return null;
    }
    return monthIndex(baseMonth, a) - monthIndex(baseMonth, b);
  };

  const numberDelta = (a: number | null | undefined, b: number | null | undefined) => {
    if (typeof a !== "number" || typeof b !== "number") {
      return null;
    }
    return a - b;
  };

  return {
    minCash: numberDelta(kpiA?.minCash?.value, kpiB?.minCash?.value),
    firstNegativeCashMonth: monthDelta(
      kpiA?.firstNegativeCashMonth ?? null,
      kpiB?.firstNegativeCashMonth ?? null
    ),
    endNetWorth: numberDelta(kpiA?.endNetWorth, kpiB?.endNetWorth),
    targetMonth: monthDelta(kpiA?.targetMonth ?? null, kpiB?.targetMonth ?? null),
  };
};
