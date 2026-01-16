"use client";

import { Card, Group, Stack, Text } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../../lib/i18n";

export type CashflowPreviewPoint = {
  month: string;
  amount: number;
};

type CashflowPreviewChartProps = {
  series: CashflowPreviewPoint[];
  currency: string;
  disabled?: boolean;
  onSelectMonth?: (point: CashflowPreviewPoint) => void;
};

const getLabelStride = (length: number) => {
  if (length <= 6) {
    return 1;
  }
  return Math.ceil(length / 6);
};

export default function CashflowPreviewChart({
  series,
  currency,
  disabled = false,
  onSelectMonth,
}: CashflowPreviewChartProps) {
  const t = useTranslations("timeline");
  const locale = useLocale();

  if (disabled) {
    return (
      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Text fw={600}>{t("cashflowPreviewTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("cashflowPreviewDisabled")}
          </Text>
        </Stack>
      </Card>
    );
  }

  if (series.length === 0) {
    return (
      <Card withBorder padding="md" radius="md">
        <Stack gap="xs">
          <Text fw={600}>{t("cashflowPreviewTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("cashflowPreviewEmpty")}
          </Text>
        </Stack>
      </Card>
    );
  }

  const total = series.reduce((sum, point) => sum + point.amount, 0);
  const totalIncome = series.reduce(
    (sum, point) => sum + (point.amount > 0 ? point.amount : 0),
    0
  );
  const totalExpense = series.reduce(
    (sum, point) => sum + (point.amount < 0 ? point.amount : 0),
    0
  );
  const peakPoint = series.reduce((current, point) => {
    if (!current) {
      return point;
    }
    return Math.abs(point.amount) > Math.abs(current.amount) ? point : current;
  }, series[0]);
  const maxAbs = Math.max(...series.map((point) => Math.abs(point.amount)), 0);
  const labelStride = getLabelStride(series.length);

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Text fw={600}>{t("cashflowPreviewTitle")}</Text>
        <div
          style={{
            position: "relative",
            height: 140,
            display: "flex",
            gap: 4,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 1,
              background: "var(--mantine-color-gray-4)",
            }}
          />
          {series.map((point) => {
            const barHeight = maxAbs === 0 ? 0 : (Math.abs(point.amount) / maxAbs) * 50;
            const isPositive = point.amount >= 0;
            return (
              <div
                key={point.month}
                style={{
                  position: "relative",
                  flex: 1,
                  minWidth: 4,
                  cursor: onSelectMonth ? "pointer" : "default",
                }}
                role={onSelectMonth ? "button" : undefined}
                tabIndex={onSelectMonth ? 0 : undefined}
                onClick={() => onSelectMonth?.(point)}
                onKeyDown={(event) => {
                  if (!onSelectMonth) {
                    return;
                  }
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectMonth(point);
                  }
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: `${barHeight}%`,
                    background: isPositive
                      ? "var(--mantine-color-teal-6)"
                      : "var(--mantine-color-red-6)",
                    borderRadius: 4,
                    bottom: isPositive ? "50%" : "auto",
                    top: isPositive ? "auto" : "50%",
                  }}
                />
              </div>
            );
          })}
        </div>
        <Group gap="xs" justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              {t("cashflowPreviewTotal")}
            </Text>
            <Text size="sm" fw={600}>
              {formatCurrency(total, currency, locale)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              {t("cashflowPreviewIncome")}
            </Text>
            <Text size="sm" fw={600}>
              {formatCurrency(totalIncome, currency, locale)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              {t("cashflowPreviewExpense")}
            </Text>
            <Text size="sm" fw={600}>
              {formatCurrency(totalExpense, currency, locale)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              {t("cashflowPreviewPeak")}
            </Text>
            <Text size="sm" fw={600}>
              {peakPoint.month} · {formatCurrency(peakPoint.amount, currency, locale)}
            </Text>
          </Stack>
        </Group>
        <Group gap="xs" justify="space-between" align="flex-start" wrap="nowrap">
          {series.map((point, index) => {
            if (index % labelStride !== 0 && index !== series.length - 1) {
              return (
                <Text key={point.month} size="xs" c="transparent">
                  {point.month}
                </Text>
              );
            }
            return (
              <Text key={point.month} size="xs" c="dimmed">
                {point.month}
              </Text>
            );
          })}
        </Group>
      </Stack>
    </Card>
  );
}
