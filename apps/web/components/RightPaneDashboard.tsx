"use client";

import { Card, Group, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis } from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../lib/i18n";

type SparklinePoint = {
  month: string;
  value: number;
};

type DashboardMetric = {
  key: "cash" | "netWorth" | "netCashflow";
  label: string;
  value: number | null;
  series: number[];
  color: string;
  onClick: () => void;
};

type RightPaneDashboardProps = {
  selectedMonth: string | null;
  months: string[];
  currency: string;
  cashBalance: number | null;
  netWorth: number | null;
  netCashflow: number | null;
  cashSeries: number[];
  netWorthSeries: number[];
  netCashflowSeries: number[];
  onMonthChange: (month: string) => void;
  onOpenBreakdown: (focus?: "cashflow" | "networth") => void;
};

const sparklineWindow = 24;

export default function RightPaneDashboard({
  selectedMonth,
  months,
  currency,
  cashBalance,
  netWorth,
  netCashflow,
  cashSeries,
  netWorthSeries,
  netCashflowSeries,
  onMonthChange,
  onOpenBreakdown,
}: RightPaneDashboardProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const formatValue = (value: number | null) =>
    value === null ? "--" : formatCurrency(value, currency, locale);
  const metrics: DashboardMetric[] = [
    {
      key: "cash",
      label: t("cashBalanceTitle"),
      value: cashBalance,
      series: cashSeries,
      color: "#228be6",
      onClick: () => onOpenBreakdown("cashflow"),
    },
    {
      key: "netWorth",
      label: t("netWorthTitle"),
      value: netWorth,
      series: netWorthSeries,
      color: "#12b886",
      onClick: () => onOpenBreakdown("networth"),
    },
    {
      key: "netCashflow",
      label: t("netCashflowTitle"),
      value: netCashflow,
      series: netCashflowSeries,
      color: "#f59f00",
      onClick: () => onOpenBreakdown("cashflow"),
    },
  ];

  const sparklineData = useMemo(() => {
    const startIndex = Math.max(months.length - sparklineWindow, 0);
    const visibleMonths = months.slice(startIndex);
    const buildSeries = (series: number[]) =>
      visibleMonths.map((month, index) => ({
        month,
        value: series[startIndex + index] ?? 0,
      }));
    return {
      cash: buildSeries(cashSeries),
      netWorth: buildSeries(netWorthSeries),
      netCashflow: buildSeries(netCashflowSeries),
    } satisfies Record<DashboardMetric["key"], SparklinePoint[]>;
  }, [cashSeries, months, netCashflowSeries, netWorthSeries]);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text fw={600}>{t("breakdownMonthLabel")}</Text>
        <Select
          size="xs"
          data={months.map((month) => ({ value: month, label: month }))}
          value={selectedMonth ?? null}
          disabled={months.length === 0}
          onChange={(value) => {
            if (value) {
              onMonthChange(value);
            }
          }}
        />
      </Group>
      <SimpleGrid cols={{ base: 1, sm: 3, md: 1 }} spacing="sm">
        {metrics.map((metric) => (
          <Card
            key={metric.key}
            withBorder
            radius="md"
            padding="md"
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
              <div style={{ width: "100%", height: 48 }}>
                <ResponsiveContainer>
                  <LineChart data={sparklineData[metric.key]}>
                    <XAxis dataKey="month" hide />
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
              {selectedMonth && (
                <Text size="xs" c="dimmed">
                  {selectedMonth}
                </Text>
              )}
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
