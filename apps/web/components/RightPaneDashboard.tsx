"use client";

import { Stack } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useTranslations } from "next-intl";
import MonthRangePicker from "./MonthRangePicker";
import MoneyDashboardPanel from "./MoneyDashboardPanel";

type RightPaneDashboardProps = {
  months: string[];
  selectedRange: { fromMonth: string | null; toMonth: string | null };
  currency: string;
  cashBalance: number | null;
  netWorth: number | null;
  netCashflow: number | null;
  cashSeries: number[];
  netWorthSeries: number[];
  netCashflowSeries: number[];
  onRangeChange: (range: { fromMonth: string | null; toMonth: string | null }) => void;
  onOpenBreakdown: (focus?: "cashflow" | "networth") => void;
  showCharts?: boolean;
};


export default function RightPaneDashboard({
  months,
  selectedRange,
  currency,
  cashBalance,
  netWorth,
  netCashflow,
  cashSeries,
  netWorthSeries,
  netCashflowSeries,
  onRangeChange,
  onOpenBreakdown,
  showCharts = true,
}: RightPaneDashboardProps) {
  const t = useTranslations("overview");
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <Stack gap="md">
      <MonthRangePicker
        months={months}
        value={selectedRange}
        label={t("breakdownRangeLabel")}
        fromLabel={t("breakdownRangeFrom")}
        toLabel={t("breakdownRangeTo")}
        quickActionLabels={
          isMobile
            ? {
                previous: t("breakdownRangePrevMonth"),
                current: t("breakdownRangeCurrentMonth"),
                next: t("breakdownRangeNextMonth"),
              }
            : undefined
        }
        onChange={onRangeChange}
      />
      <MoneyDashboardPanel
        months={months}
        range={selectedRange}
        currency={currency}
        cashBalance={cashBalance}
        netWorth={netWorth}
        netCashflow={netCashflow}
        cashSeries={cashSeries}
        netWorthSeries={netWorthSeries}
        netCashflowSeries={netCashflowSeries}
        showCharts={showCharts}
        onOpenBreakdown={onOpenBreakdown}
      />
    </Stack>
  );
}
