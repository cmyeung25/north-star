"use client";

import { Button, Card, Group, SegmentedControl, Select, Stack, Text } from "@mantine/core";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../lib/i18n";
import type { MonthSnapshot } from "../src/engine/projectionSelectors";
import DiffBadge from "./DiffBadge";

type MoneyMonthSnapshotPanelProps = {
  title: string;
  currency: string;
  months: string[];
  currentMonthKey: string | null;
  selectedMonthKey: string | null;
  snapshot: MonthSnapshot | null;
  currentSnapshot: MonthSnapshot | null;
  loading: boolean;
  labels: {
    modeCurrent: string;
    modeSelect: string;
    inputMonth: string;
    inputDate: string;
    monthLabel: string;
    dateLabel: string;
    dateSnapHint: string;
    selectedMonthHint: string;
    empty: string;
    viewMonthlyDetails: string;
    cashEom: string;
    netWorth: string;
    netCashflow: string;
    inflow: string;
    outflow: string;
    assetsTotal: string;
    liabilitiesTotal: string;
    loading: string;
  };
  onSelectMonth: (month: string) => void;
  onOpenMonthlyDetails: () => void;
};

type MetricPolarity = "higherIsBetter" | "lowerIsBetter";
type MetricKey =
  | "cashEom"
  | "netWorth"
  | "netCashflow"
  | "inflow"
  | "outflow"
  | "assetsTotal"
  | "liabilitiesTotal";

const metricConfigs: Array<{ key: MetricKey; labelKey: MetricKey; polarity: MetricPolarity }> = [
  { key: "cashEom", labelKey: "cashEom", polarity: "higherIsBetter" },
  { key: "netWorth", labelKey: "netWorth", polarity: "higherIsBetter" },
  { key: "netCashflow", labelKey: "netCashflow", polarity: "higherIsBetter" },
  { key: "inflow", labelKey: "inflow", polarity: "higherIsBetter" },
  { key: "outflow", labelKey: "outflow", polarity: "lowerIsBetter" },
  { key: "assetsTotal", labelKey: "assetsTotal", polarity: "higherIsBetter" },
  { key: "liabilitiesTotal", labelKey: "liabilitiesTotal", polarity: "lowerIsBetter" },
];

export default function MoneyMonthSnapshotPanel({
  title,
  currency,
  months,
  currentMonthKey,
  selectedMonthKey,
  snapshot,
  currentSnapshot,
  loading,
  labels,
  onSelectMonth,
  onOpenMonthlyDetails,
}: MoneyMonthSnapshotPanelProps) {
  const locale = useLocale();
  const [mode, setMode] = useState<"current" | "selected">("current");
  const [inputMode, setInputMode] = useState<"month" | "date">("month");
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    if (mode === "current" && currentMonthKey) {
      onSelectMonth(currentMonthKey);
    }
  }, [currentMonthKey, mode, onSelectMonth]);

  useEffect(() => {
    if (selectedMonthKey && currentMonthKey && selectedMonthKey !== currentMonthKey) {
      setMode("selected");
    }
  }, [currentMonthKey, selectedMonthKey]);

  const monthOptions = useMemo(
    () => months.map((month) => ({ value: month, label: month })),
    [months]
  );
  const formatValue = (value: number) => formatCurrency(value, currency, locale);

  const metricDiffs = useMemo(() => {
    if (!snapshot || !currentSnapshot) {
      return [];
    }

    return metricConfigs.map((config) => ({
      ...config,
      value: snapshot[config.key],
      delta: snapshot[config.key] - currentSnapshot[config.key],
      base: currentSnapshot[config.key],
    }));
  }, [currentSnapshot, snapshot]);

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Text fw={600}>{title}</Text>
        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(value) => setMode(value as "current" | "selected")}
          data={[
            { value: "current", label: labels.modeCurrent },
            { value: "selected", label: labels.modeSelect },
          ]}
        />

        {mode === "selected" && (
          <Stack gap="xs">
            <SegmentedControl
              value={inputMode}
              onChange={(value) => setInputMode(value as "month" | "date")}
              data={[
                { value: "month", label: labels.inputMonth },
                { value: "date", label: labels.inputDate },
              ]}
            />
            {inputMode === "month" ? (
              <Select
                label={labels.monthLabel}
                value={selectedMonthKey}
                data={monthOptions}
                onChange={(value) => {
                  if (value) {
                    onSelectMonth(value);
                  }
                }}
                searchable
                nothingFoundMessage="--"
              />
            ) : (
              <>
                <Text size="sm">{labels.dateLabel}</Text>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setSelectedDate(value);
                    const snappedMonth = value.slice(0, 7);
                    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(snappedMonth)) {
                      onSelectMonth(snappedMonth);
                    }
                  }}
                />
                {selectedDate ? (
                  <Text size="xs" c="dimmed">
                    {labels.dateSnapHint.replace("{month}", selectedDate.slice(0, 7))}
                  </Text>
                ) : null}
              </>
            )}
          </Stack>
        )}

        {selectedMonthKey ? (
          <Text size="xs" c="dimmed">
            {labels.selectedMonthHint.replace("{month}", selectedMonthKey)}
          </Text>
        ) : null}

        {loading ? (
          <Text size="sm" c="dimmed">
            {labels.loading}
          </Text>
        ) : !snapshot ? (
          <Text size="sm" c="dimmed">
            {labels.empty}
          </Text>
        ) : (
          <Stack gap={6}>
            {metricDiffs.map((metric) => (
              <Group key={metric.key} justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                <Text size="sm">{labels[metric.labelKey]}</Text>
                <Stack gap={4} align="flex-end" style={{ minWidth: 0 }}>
                  <Text fw={600} style={{ overflowWrap: "anywhere", textAlign: "right" }}>
                    {formatValue(metric.value)}
                  </Text>
                  {selectedMonthKey !== currentMonthKey ? (
                    <DiffBadge
                      delta={metric.delta}
                      base={metric.base}
                      polarity={metric.polarity}
                      formatter={formatValue}
                    />
                  ) : null}
                </Stack>
              </Group>
            ))}
          </Stack>
        )}

        <Button variant="light" onClick={onOpenMonthlyDetails} disabled={!selectedMonthKey}>
          {labels.viewMonthlyDetails}
        </Button>
      </Stack>
    </Card>
  );
}
