"use client";

import { Card, Group, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../lib/i18n";

type DashboardMetric = {
  key: "cash" | "netWorth" | "netCashflow";
  label: string;
  value: number | null;
  onClick: () => void;
};

type RightPaneDashboardProps = {
  selectedMonth: string | null;
  months: string[];
  currency: string;
  cashBalance: number | null;
  netWorth: number | null;
  netCashflow: number | null;
  onMonthChange: (month: string) => void;
  onOpenBreakdown: (focus?: "cashflow" | "networth") => void;
};

export default function RightPaneDashboard({
  selectedMonth,
  months,
  currency,
  cashBalance,
  netWorth,
  netCashflow,
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
      onClick: () => onOpenBreakdown("cashflow"),
    },
    {
      key: "netWorth",
      label: t("netWorthTitle"),
      value: netWorth,
      onClick: () => onOpenBreakdown("networth"),
    },
    {
      key: "netCashflow",
      label: t("netCashflowTitle"),
      value: netCashflow,
      onClick: () => onOpenBreakdown("cashflow"),
    },
  ];

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
