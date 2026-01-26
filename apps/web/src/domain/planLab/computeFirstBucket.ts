import type { ProjectionResult } from "@north-star/engine";

export type FirstBucketResult = {
  achievedMonth: string | null;
  achievedIndex: number | null;
  minCash: {
    value: number;
    month: string | null;
  };
};

export const computeFirstBucket = (
  projection: ProjectionResult | null | undefined,
  targetAmount?: number | null
): FirstBucketResult | null => {
  if (!projection || targetAmount === null || targetAmount === undefined) {
    return null;
  }
  if (!Number.isFinite(targetAmount)) {
    return null;
  }

  const achievedIndex = projection.netWorth.findIndex(
    (value) => value >= targetAmount
  );
  if (achievedIndex < 0) {
    return {
      achievedMonth: null,
      achievedIndex: null,
      minCash: { value: 0, month: null },
    };
  }

  let minCashValue = Number.POSITIVE_INFINITY;
  let minCashIndex = -1;
  for (let index = 0; index <= achievedIndex; index += 1) {
    const value = projection.cashBalance[index] ?? 0;
    if (value < minCashValue) {
      minCashValue = value;
      minCashIndex = index;
    }
  }

  const achievedMonth = projection.months[achievedIndex] ?? null;
  const minCashMonth =
    minCashIndex >= 0 ? projection.months[minCashIndex] ?? null : null;

  return {
    achievedMonth,
    achievedIndex,
    minCash: {
      value: Number.isFinite(minCashValue) ? minCashValue : 0,
      month: minCashMonth,
    },
  };
};
