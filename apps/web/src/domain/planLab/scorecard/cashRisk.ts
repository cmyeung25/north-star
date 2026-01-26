export type CashRiskScorecardResult = {
  minCash: {
    month: string;
    amount: number;
  } | null;
  worst3: Array<{
    month: string;
    amount: number;
  }>;
  flags: {
    belowZero: boolean;
    belowBuffer: boolean;
  };
};

export type ComputeCashRiskScorecardParams = {
  cashSeries: Array<{ month: string; value: number }>;
  bufferThreshold?: number;
};

/**
 * Computes cash risk scorecard metrics from a cash balance series.
 * Returns minimum cash balance with month, worst 3 months, and warning flags.
 *
 * @param params - Configuration with cash series and optional buffer threshold
 * @returns Cash risk scorecard with minimum balance, worst months, and flags
 */
export const computeCashRiskScorecard = ({
  cashSeries,
  bufferThreshold,
}: ComputeCashRiskScorecardParams): CashRiskScorecardResult => {
  if (cashSeries.length === 0) {
    return {
      minCash: null,
      worst3: [],
      flags: {
        belowZero: false,
        belowBuffer: false,
      },
    };
  }

  // Find minimum cash balance
  let minCash: CashRiskScorecardResult["minCash"] = null;
  let minIndex = 0;
  let minAmount = cashSeries[0].value;

  for (let i = 0; i < cashSeries.length; i++) {
    const value = cashSeries[i].value;
    if (value < minAmount) {
      minAmount = value;
      minIndex = i;
    }
  }

  if (minAmount !== Infinity && minIndex < cashSeries.length) {
    minCash = {
      month: cashSeries[minIndex].month,
      amount: minAmount,
    };
  }

  // Find worst 3 months (lowest cash balances)
  const sorted = cashSeries
    .map((entry, index) => ({
      ...entry,
      originalIndex: index,
    }))
    .sort((a, b) => a.value - b.value);

  const worst3 = sorted
    .slice(0, 3)
    .map((entry) => ({
      month: entry.month,
      amount: entry.value,
    }));

  // Determine warning flags
  const belowZero = minCash ? minCash.amount < 0 : false;
  const belowBuffer =
    minCash && bufferThreshold !== undefined ? minCash.amount < bufferThreshold : false;

  return {
    minCash,
    worst3,
    flags: {
      belowZero,
      belowBuffer,
    },
  };
};

/**
 * Computes a 3-month expense buffer threshold based on historical monthly outflows.
 * Examines the first N months to determine average absolute outflows and multiplies by 3.
 *
 * @param ledgerItems - Array of cashflow items with signed amounts
 * @param months - List of months in order
 * @param lookbackMonths - Number of months to analyze for average outflow (default: 6)
 * @returns Buffer threshold (absolute positive amount) or undefined if cannot compute
 */
export const computeBufferThresholdFromLedger = (
  ledgerItems: Array<{ month: string; amount: number }>,
  months: string[],
  lookbackMonths: number = 6
): number | undefined => {
  if (ledgerItems.length === 0 || months.length === 0) {
    return undefined;
  }

  // Group ledger items by month and sum them
  const monthlyOutflows: Record<string, number> = {};
  ledgerItems.forEach((item) => {
    if (!monthlyOutflows[item.month]) {
      monthlyOutflows[item.month] = 0;
    }
    // Only count negative flows (outflows)
    if (item.amount < 0) {
      monthlyOutflows[item.month] += Math.abs(item.amount);
    }
  });

  // Average the first lookbackMonths
  const monthsToAnalyze = months.slice(0, lookbackMonths);
  let totalOutflow = 0;
  let countedMonths = 0;

  for (const month of monthsToAnalyze) {
    const outflow = monthlyOutflows[month] ?? 0;
    if (outflow > 0) {
      totalOutflow += outflow;
      countedMonths++;
    }
  }

  if (countedMonths === 0) {
    return undefined;
  }

  const avgMonthlyOutflow = totalOutflow / countedMonths;
  return Math.max(0, avgMonthlyOutflow * 3);
};
