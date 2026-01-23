"use client";

import { Card, ScrollArea, Select, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { useEffect, useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis } from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../lib/i18n";
import { monthsBetween } from "../src/domain/members/age";

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
};

const sparklineWindow = 24;
const rangeLimit = 200;

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
  const locale = useLocale();
  const formatValue = (value: number | null) =>
    value === null ? "--" : formatCurrency(value, currency, locale);
  const resolveMonth = (value: string | null, fallback: string) => {
    if (months.length === 0) {
      return null;
    }
    const baseMonth = months[0];
    const index = monthsBetween(baseMonth, value ?? fallback);
    const clampedIndex = Math.min(Math.max(index, 0), months.length - 1);
    return months[clampedIndex] ?? null;
  };
  const fallbackMonth = months[0] ?? null;
  const fromMonth = fallbackMonth
    ? resolveMonth(selectedRange.fromMonth ?? fallbackMonth, fallbackMonth)
    : null;
  const toMonth =
    fromMonth && fallbackMonth
      ? resolveMonth(selectedRange.toMonth ?? fromMonth, fromMonth)
      : null;

  useEffect(() => {
    if (!fallbackMonth || !fromMonth || !toMonth) {
      return;
    }
    const nextFrom = fromMonth;
    let nextTo = toMonth;
    if (monthsBetween(nextFrom, nextTo) < 0) {
      nextTo = nextFrom;
    }
    if (
      selectedRange.fromMonth !== nextFrom ||
      selectedRange.toMonth !== nextTo
    ) {
      onRangeChange({ fromMonth: nextFrom, toMonth: nextTo });
    }
  }, [fallbackMonth, fromMonth, onRangeChange, selectedRange, toMonth]);
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

  const rangeRows = useMemo(() => {
    if (!fromMonth || !toMonth || months.length === 0) {
      return [];
    }
    const baseMonth = months[0];
    const startIndex = Math.max(monthsBetween(baseMonth, fromMonth), 0);
    const endIndex = Math.min(
      Math.max(monthsBetween(baseMonth, toMonth), 0),
      months.length - 1
    );
    const [fromIndex, toIndex] =
      startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
    return months.slice(fromIndex, toIndex + 1).map((month, offset) => {
      const index = fromIndex + offset;
      return {
        month,
        netCashflow: netCashflowSeries[index] ?? 0,
        cashBalance: cashSeries[index] ?? null,
        netWorth: netWorthSeries[index] ?? null,
      };
    });
  }, [cashSeries, fromMonth, months, netCashflowSeries, netWorthSeries, toMonth]);
  const totalNetCashflow = useMemo(
    () => rangeRows.reduce((total, row) => total + row.netCashflow, 0),
    [rangeRows]
  );
  const netWorthDelta =
    rangeRows.length > 1 &&
    rangeRows[0].netWorth !== null &&
    rangeRows.at(-1)?.netWorth !== null
      ? (rangeRows.at(-1)?.netWorth ?? 0) - (rangeRows[0]?.netWorth ?? 0)
      : null;
  const isTruncated = rangeRows.length > rangeLimit;
  const visibleRows = isTruncated
    ? rangeRows.slice(-rangeLimit)
    : rangeRows;

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Text fw={600}>{t("breakdownRangeLabel")}</Text>
        <SimpleGrid cols={2} spacing="xs">
          <Select
            size="xs"
            label={t("breakdownRangeFrom")}
            data={months.map((month) => ({ value: month, label: month }))}
            value={fromMonth ?? null}
            disabled={months.length === 0}
            onChange={(value) => {
              if (!value || !fallbackMonth) {
                return;
              }
              const nextFrom = resolveMonth(value, fallbackMonth);
              const nextTo = resolveMonth(toMonth ?? value, nextFrom ?? value);
              if (!nextFrom || !nextTo) {
                return;
              }
              onRangeChange({
                fromMonth: nextFrom,
                toMonth: monthsBetween(nextFrom, nextTo) < 0 ? nextFrom : nextTo,
              });
            }}
          />
          <Select
            size="xs"
            label={t("breakdownRangeTo")}
            data={months.map((month) => ({ value: month, label: month }))}
            value={toMonth ?? null}
            disabled={months.length === 0}
            onChange={(value) => {
              if (!value || !fallbackMonth) {
                return;
              }
              const nextTo = resolveMonth(value, fallbackMonth);
              const nextFrom = resolveMonth(fromMonth ?? value, nextTo ?? value);
              if (!nextFrom || !nextTo) {
                return;
              }
              onRangeChange({
                fromMonth: monthsBetween(nextFrom, nextTo) < 0 ? nextTo : nextFrom,
                toMonth: nextTo,
              });
            }}
          />
        </SimpleGrid>
      </Stack>
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
              {toMonth && (
                <Text size="xs" c="dimmed">
                  {toMonth}
                </Text>
              )}
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      <Stack gap="xs">
        {rangeRows.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("breakdownRangeEmpty")}
          </Text>
        ) : (
          <>
            <Text size="sm">
              {t("breakdownRangeSummary", {
                count: rangeRows.length,
                netCashflow: formatValue(totalNetCashflow),
                netWorthDelta: formatValue(netWorthDelta),
              })}
            </Text>
            {isTruncated && (
              <Text size="xs" c="orange">
                {t("breakdownRangeLimit", {
                  count: rangeRows.length,
                  limit: rangeLimit,
                })}
              </Text>
            )}
            <ScrollArea.Autosize mah={320} offsetScrollbars>
              <Table striped withColumnBorders highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t("breakdownMonth")}</Table.Th>
                    <Table.Th>{t("netCashflowTitle")}</Table.Th>
                    <Table.Th>{t("cashBalanceTitle")}</Table.Th>
                    <Table.Th>{t("netWorthTitle")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {visibleRows.map((row) => (
                    <Table.Tr key={row.month}>
                      <Table.Td>{row.month}</Table.Td>
                      <Table.Td>{formatValue(row.netCashflow)}</Table.Td>
                      <Table.Td>{formatValue(row.cashBalance)}</Table.Td>
                      <Table.Td>{formatValue(row.netWorth)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          </>
        )}
      </Stack>
    </Stack>
  );
}
