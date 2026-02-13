export type ProjectionXDomain = {
  startMonthIdx: number;
  endMonthIdx: number;
  months: string[];
};

export const getProjectionXDomain = (
  series: Array<{ month: string }>
): ProjectionXDomain => {
  const months = Array.from(new Set(series.map((entry) => entry.month))).sort();
  if (months.length === 0) {
    return {
      startMonthIdx: 0,
      endMonthIdx: 0,
      months: [],
    };
  }
  return {
    startMonthIdx: 0,
    endMonthIdx: months.length - 1,
    months,
  };
};

