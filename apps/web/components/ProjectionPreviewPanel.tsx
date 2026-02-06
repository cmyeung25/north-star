"use client";

import { Card, Group, SegmentedControl, Stack, Text } from "@mantine/core";
import { useLocale } from "next-intl";
import { formatCurrency } from "../lib/i18n";
import type { DashboardMetrics } from "../src/domain/dashboard/metrics";

export type PreviewScope = "month" | "12m" | "horizon";

type ProjectionPreviewPanelProps = {
  title: string;
  currency: string;
  scope: PreviewScope;
  onScopeChange: (scope: PreviewScope) => void;
  labels: {
    month: string;
    twelveMonths: string;
    horizon: string;
    cashBalance: string;
    netWorth: string;
    netCashflow: string;
    minCash: string;
    deficitMonths: string;
    runway: string;
    firstMillion: string;
    endMonthScope: string;
    notReached: string;
  };
  currentMonth: {
    cashBalance: number | null;
    netWorth: number | null;
    netCashflow: number | null;
  };
  metrics: DashboardMetrics;
};

const valueOrDash = (value: number | null, currency: string, locale: string) =>
  value === null ? "--" : formatCurrency(value, currency, locale);

export default function ProjectionPreviewPanel({
  title,
  currency,
  scope,
  onScopeChange,
  labels,
  currentMonth,
  metrics,
}: ProjectionPreviewPanelProps) {
  const locale = useLocale();

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Text fw={600}>{title}</Text>
        <SegmentedControl
          fullWidth
          value={scope}
          onChange={(value) => onScopeChange(value as PreviewScope)}
          data={[
            { value: "month", label: labels.month },
            { value: "12m", label: labels.twelveMonths },
            { value: "horizon", label: labels.horizon },
          ]}
        />
        {scope === "month" && (
          <Stack gap={6}>
            <Group justify="space-between"><Text size="sm">{labels.cashBalance}</Text><Text fw={600}>{valueOrDash(currentMonth.cashBalance, currency, locale)}</Text></Group>
            <Group justify="space-between"><Text size="sm">{labels.netWorth}</Text><Text fw={600}>{valueOrDash(currentMonth.netWorth, currency, locale)}</Text></Group>
            <Group justify="space-between"><Text size="sm">{labels.netCashflow}</Text><Text fw={600}>{valueOrDash(currentMonth.netCashflow, currency, locale)}</Text></Group>
          </Stack>
        )}
        {scope === "12m" && (
          <Stack gap={6}>
            <Group justify="space-between"><Text size="sm">{labels.minCash}</Text><Text fw={600}>{metrics.minCash12m ? `${formatCurrency(metrics.minCash12m.value, currency, locale)} · ${metrics.minCash12m.month}` : "--"}</Text></Group>
            <Group justify="space-between"><Text size="sm">{labels.deficitMonths}</Text><Text fw={600}>{metrics.deficitMonthsCount12m} / 12</Text></Group>
            <Group justify="space-between"><Text size="sm">{labels.runway}</Text><Text fw={600}>{metrics.cashRunwayMonths === null ? "--" : `${metrics.cashRunwayMonths.toFixed(1)}`}</Text></Group>
          </Stack>
        )}
        {scope === "horizon" && (
          <Stack gap={6}>
            <Group justify="space-between"><Text size="sm">{labels.firstMillion}</Text><Text fw={600}>{metrics.firstMillionMonth ?? labels.notReached}</Text></Group>
            <Text size="xs" c="dimmed">{labels.endMonthScope.replace("{endMonth}", metrics.endMonth ?? "--")}</Text>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
