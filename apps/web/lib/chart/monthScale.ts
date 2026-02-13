export type MonthScale = {
  months: string[];
  monthCount: number;
  monthToIndex: Map<string, number>;
  pxPerMonth: number;
  chartInnerWidth: number;
  leftGutterPx: number;
  rightPaddingPx: number;
  totalWidth: number;
  xOfMonth: (monthKey: string) => number;
};

type BuildMonthScaleOptions = {
  isMobile?: boolean;
  leftGutterPx?: number;
  rightPaddingPx?: number;
  mobilePxPerMonth?: number;
  desktopPxPerMonth?: number;
};

export const buildMonthScale = (
  series: Array<{ month: string }>,
  options: BuildMonthScaleOptions = {}
): MonthScale => {
  const months = Array.from(new Set(series.map((entry) => entry.month).filter(Boolean))).sort();
  const monthToIndex = new Map(months.map((month, index) => [month, index]));
  const monthCount = months.length;
  const pxPerMonth = options.isMobile ? (options.mobilePxPerMonth ?? 28) : (options.desktopPxPerMonth ?? 20);
  const chartInnerWidth = Math.max(monthCount, 1) * pxPerMonth;
  const leftGutterPx = options.leftGutterPx ?? 72;
  const rightPaddingPx = options.rightPaddingPx ?? 24;

  const xOfMonth = (monthKey: string) => {
    const index = monthToIndex.get(monthKey);
    if (typeof index !== "number") {
      return leftGutterPx;
    }
    return leftGutterPx + index * pxPerMonth;
  };

  return {
    months,
    monthCount,
    monthToIndex,
    pxPerMonth,
    chartInnerWidth,
    leftGutterPx,
    rightPaddingPx,
    totalWidth: leftGutterPx + chartInnerWidth + rightPaddingPx,
    xOfMonth,
  };
};
