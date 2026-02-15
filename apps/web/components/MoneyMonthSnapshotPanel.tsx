"use client";

import { Button, Card, Group, SegmentedControl, Select, Stack, Text } from "@mantine/core";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../lib/i18n";
import type { MonthSnapshot } from "../src/engine/projectionSelectors";

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
    diffVsCurrent: string;
    loading: string;
  };
  onSelectMonth: (month: string) => void;
  onOpenMonthlyDetails: () => void;
};

const plusSign = (value: number, formatted: string) => (value > 0 ? `+${formatted}` : formatted);

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

  const delta =
    snapshot && currentSnapshot
      ? {
          cash: snapshot.cashEom - currentSnapshot.cashEom,
          netWorth: snapshot.netWorth - currentSnapshot.netWorth,
          netCashflow: snapshot.netCashflow - currentSnapshot.netCashflow,
        }
      : null;

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
          <Text size="sm" c="dimmed">{labels.loading}</Text>
        ) : !snapshot ? (
          <Text size="sm" c="dimmed">{labels.empty}</Text>
        ) : (
          <Stack gap={6}>
            <Group justify="space-between"><Text size="sm">{labels.cashEom}</Text><Text fw={600}>{formatValue(snapshot.cashEom)}</Text></Group>
            <Group justify="space-between"><Text size="sm">{labels.netWorth}</Text><Text fw={600}>{formatValue(snapshot.netWorth)}</Text></Group>
            <Group justify="space-between"><Text size="sm">{labels.netCashflow}</Text><Text fw={600}>{formatValue(snapshot.netCashflow)}</Text></Group>
            <Group justify="space-between"><Text size="sm">{labels.inflow}</Text><Text fw={600}>{formatValue(snapshot.inflow)}</Text></Group>
            <Group justify="space-between"><Text size="sm">{labels.outflow}</Text><Text fw={600}>{formatValue(snapshot.outflow)}</Text></Group>
            <Group justify="space-between"><Text size="sm">{labels.assetsTotal}</Text><Text fw={600}>{formatValue(snapshot.assetsTotal)}</Text></Group>
            <Group justify="space-between"><Text size="sm">{labels.liabilitiesTotal}</Text><Text fw={600}>{formatValue(snapshot.liabilitiesTotal)}</Text></Group>

            {delta ? (
              <Text size="xs" c="dimmed">
                {labels.diffVsCurrent
                  .replace("{cash}", plusSign(delta.cash, formatValue(delta.cash)))
                  .replace("{netWorth}", plusSign(delta.netWorth, formatValue(delta.netWorth)))
                  .replace("{netCashflow}", plusSign(delta.netCashflow, formatValue(delta.netCashflow)))}
              </Text>
            ) : null}
          </Stack>
        )}

        <Button variant="light" onClick={onOpenMonthlyDetails} disabled={!selectedMonthKey}>
          {labels.viewMonthlyDetails}
        </Button>
      </Stack>
    </Card>
  );
}
