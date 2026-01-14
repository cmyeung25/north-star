export type HomeValueParams = {
  purchasePrice: number;
  annualAppreciation: number;
  startIndex: number;
  horizonMonths: number;
};

export function computeHomeValueSeries(params: HomeValueParams): number[] {
  const { purchasePrice, annualAppreciation, startIndex, horizonMonths } = params;
  const series = Array.from({ length: horizonMonths }, () => 0);

  if (purchasePrice <= 0 || horizonMonths <= 0) {
    return series;
  }

  const monthlyGrowth = Math.pow(1 + annualAppreciation, 1 / 12) - 1;
  const start = Math.max(0, startIndex);

  for (let i = start; i < horizonMonths; i += 1) {
    if (i === start) {
      series[i] = purchasePrice;
    } else {
      series[i] = series[i - 1] * (1 + monthlyGrowth);
    }
  }

  return series;
}
