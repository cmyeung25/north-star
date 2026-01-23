"use client";

import { Stack } from "@mantine/core";
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
}: RightPaneDashboardProps) {
  const t = useTranslations("overview");

  return (
    <Stack gap="md">
      <MonthRangePicker
        months={months}
        value={selectedRange}
        label={t("breakdownRangeLabel")}
        fromLabel={t("breakdownRangeFrom")}
        toLabel={t("breakdownRangeTo")}
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
        onOpenBreakdown={onOpenBreakdown}
      />
    </Stack>
  );
}
