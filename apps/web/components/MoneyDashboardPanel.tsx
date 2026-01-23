"use client";

import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "../lib/i18n";
import { addMonths, monthsBetween } from "../src/domain/members/age";

type MoneyDashboardPanelProps = {
  months: string[];
  range: { fromMonth: string | null; toMonth: string | null };
  currency: string;
  cashBalance: number | null;
  netWorth: number | null;
  netCashflow: number | null;
  cashSeries: number[];
  netWorthSeries: number[];
  netCashflowSeries: number[];
  onOpenBreakdown: (focus?: "cashflow" | "networth") => void;
};

type ChartDatum = {
  month: string;
  value: number;
};

const buildRangeWindow = (
  months: string[],
  range: { fromMonth: string | null; toMonth: string | null }
) => {
  if (months.length === 0 || !range.fromMonth || !range.toMonth) {
    return { baseMonth: null, startIndex: 0, endIndex: -1, months: [] as string[] };
  }
  const baseMonth = months[0];
  const startIndex = Math.max(monthsBetween(baseMonth, range.fromMonth), 0);
  const endIndex = Math.min(
    Math.max(monthsBetween(baseMonth, range.toMonth), 0),
    months.length - 1
  );
  const [fromIndex, toIndex] =
    startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
  return {
    baseMonth,
    startIndex: fromIndex,
    endIndex: toIndex,
    months: months.slice(fromIndex, toIndex + 1),
  };
};

export default function MoneyDashboardPanel({
  months,
  range,
  currency,
  cashBalance,
  netWorth,
  netCashflow,
  cashSeries,
  netWorthSeries,
  netCashflowSeries,
  onOpenBreakdown,
}: MoneyDashboardPanelProps) {
  const t = useTranslations("overview");
  const nav = useTranslations("nav");
  const locale = useLocale();
  const formatValue = (value: number | null) =>
    value === null ? "--" : formatCurrency(value, currency, locale);

  const rangeWindow = useMemo(() => buildRangeWindow(months, range), [months, range]);
  const chartData = useMemo(() => {
    if (!rangeWindow.baseMonth || rangeWindow.months.length === 0) {
      return {
        cash: [] as ChartDatum[],
        netWorth: [] as ChartDatum[],
        netCashflow: [] as ChartDatum[],
      };
    }
    const buildSeries = (series: number[]) =>
      rangeWindow.months.map((_, offset) => {
        const index = rangeWindow.startIndex + offset;
        return {
          month: addMonths(rangeWindow.baseMonth, index),
          value: series[index] ?? 0,
        };
      });
    return {
      cash: buildSeries(cashSeries),
      netWorth: buildSeries(netWorthSeries),
      netCashflow: buildSeries(netCashflowSeries),
    };
  }, [
    cashSeries,
    netCashflowSeries,
    netWorthSeries,
    rangeWindow.baseMonth,
    rangeWindow.months,
    rangeWindow.startIndex,
  ]);

  const metrics = [
    {
      key: "cash",
      label: t("cashBalanceTitle"),
      value: cashBalance,
      series: chartData.cash,
      color: "#228be6",
      onClick: () => onOpenBreakdown("cashflow"),
    },
    {
      key: "netWorth",
      label: t("netWorthTitle"),
      value: netWorth,
      series: chartData.netWorth,
      color: "#12b886",
      onClick: () => onOpenBreakdown("networth"),
    },
    {
      key: "netCashflow",
      label: t("netCashflowTitle"),
      value: netCashflow,
      series: chartData.netCashflow,
      color: "#f59f00",
      onClick: () => onOpenBreakdown("cashflow"),
    },
  ] as const;

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600}>{nav("dashboard")}</Text>
          {range.fromMonth && range.toMonth && (
            <Text size="xs" c="dimmed">
              {range.fromMonth} → {range.toMonth}
            </Text>
          )}
        </Group>
        {rangeWindow.months.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("breakdownRangeEmpty")}
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 1 }} spacing="sm">
            {metrics.map((metric) => (
              <Card
                key={metric.key}
                withBorder
                radius="md"
                padding="sm"
                component="button"
                type="button"
                onClick={metric.onClick}
                style={{ textAlign: "left", cursor: "pointer" }}
              >
                <Stack gap={4}>
                  <Text size="sm" fw={600}>
                    {metric.label}
                  </Text>
                  <Text size="lg" fw={600}>
                    {formatValue(metric.value)}
                  </Text>
                  <div style={{ width: "100%", height: 140 }}>
                    <ResponsiveContainer>
                      <LineChart data={metric.series}>
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis hide />
                        <Tooltip
                          formatter={(value) =>
                            formatValue(typeof value === "number" ? value : Number(value))
                          }
                          labelFormatter={(label: string) => label}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={metric.color}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Card>
  );
}
