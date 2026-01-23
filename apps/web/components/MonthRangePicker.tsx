"use client";

import { Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { useEffect } from "react";
import { monthsBetween } from "../src/domain/members/age";

export type MonthRangeValue = {
  fromMonth: string | null;
  toMonth: string | null;
};

type MonthRangePickerProps = {
  months: string[];
  value: MonthRangeValue;
  label?: string;
  fromLabel: string;
  toLabel: string;
  size?: "xs" | "sm" | "md" | "lg";
  onChange: (value: MonthRangeValue) => void;
};

export default function MonthRangePicker({
  months,
  value,
  label,
  fromLabel,
  toLabel,
  size = "xs",
  onChange,
}: MonthRangePickerProps) {
  const resolveMonth = (month: string | null, fallback: string) => {
    if (months.length === 0) {
      return null;
    }
    const baseMonth = months[0];
    const index = monthsBetween(baseMonth, month ?? fallback);
    const clampedIndex = Math.min(Math.max(index, 0), months.length - 1);
    return months[clampedIndex] ?? null;
  };
  const fallbackMonth = months[0] ?? null;
  const fromMonth = fallbackMonth
    ? resolveMonth(value.fromMonth ?? fallbackMonth, fallbackMonth)
    : null;
  const toMonth =
    fromMonth && fallbackMonth
      ? resolveMonth(value.toMonth ?? fromMonth, fromMonth)
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
    if (value.fromMonth !== nextFrom || value.toMonth !== nextTo) {
      onChange({ fromMonth: nextFrom, toMonth: nextTo });
    }
  }, [fallbackMonth, fromMonth, onChange, toMonth, value.fromMonth, value.toMonth]);

  return (
    <Stack gap="xs">
      {label && <Text fw={600}>{label}</Text>}
      <SimpleGrid cols={2} spacing="xs">
        <Select
          size={size}
          label={fromLabel}
          data={months.map((month) => ({ value: month, label: month }))}
          value={fromMonth ?? null}
          disabled={months.length === 0}
          onChange={(next) => {
            if (!next || !fallbackMonth) {
              return;
            }
            const nextFrom = resolveMonth(next, fallbackMonth);
            const nextTo = resolveMonth(toMonth ?? next, nextFrom ?? next);
            if (!nextFrom || !nextTo) {
              return;
            }
            onChange({
              fromMonth: nextFrom,
              toMonth: monthsBetween(nextFrom, nextTo) < 0 ? nextFrom : nextTo,
            });
          }}
        />
        <Select
          size={size}
          label={toLabel}
          data={months.map((month) => ({ value: month, label: month }))}
          value={toMonth ?? null}
          disabled={months.length === 0}
          onChange={(next) => {
            if (!next || !fallbackMonth) {
              return;
            }
            const nextTo = resolveMonth(next, fallbackMonth);
            const nextFrom = resolveMonth(fromMonth ?? next, nextTo ?? next);
            if (!nextFrom || !nextTo) {
              return;
            }
            onChange({
              fromMonth: monthsBetween(nextFrom, nextTo) < 0 ? nextTo : nextFrom,
              toMonth: nextTo,
            });
          }}
        />
      </SimpleGrid>
    </Stack>
  );
}
