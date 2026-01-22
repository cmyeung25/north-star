"use client";

import { Group, NumberInput, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";

export type EndConditionMode = "month" | "age";

type EndConditionPickerProps = {
  mode: EndConditionMode;
  onModeChange: (mode: EndConditionMode) => void;
  monthLabel: string;
  monthPlaceholder?: string;
  monthValue: string;
  monthError?: string;
  onMonthChange: (value: string) => void;
  onMonthBlur?: () => void;
  ageLabel: string;
  ageValue: number | "" | null;
  ageError?: string;
  onAgeChange: (value: number | "" | null) => void;
  ageMin?: number;
  ageMax?: number;
  ageStep?: number;
  monthOptionLabel: string;
  ageOptionLabel: string;
  computedMonthLabel?: string;
  computedMonthValue?: string | null;
};

export default function EndConditionPicker({
  mode,
  onModeChange,
  monthLabel,
  monthPlaceholder,
  monthValue,
  monthError,
  onMonthChange,
  onMonthBlur,
  ageLabel,
  ageValue,
  ageError,
  onAgeChange,
  ageMin = 0,
  ageMax,
  ageStep = 0.5,
  monthOptionLabel,
  ageOptionLabel,
  computedMonthLabel,
  computedMonthValue,
}: EndConditionPickerProps) {
  const showComputedMonth = Boolean(computedMonthLabel);

  return (
    <Stack gap="xs">
      <SegmentedControl
        value={mode}
        onChange={(value) => onModeChange(value as EndConditionMode)}
        data={[
          { value: "month", label: monthOptionLabel },
          { value: "age", label: ageOptionLabel },
        ]}
      />
      <Group grow align="flex-start">
        <TextInput
          label={monthLabel}
          placeholder={monthPlaceholder}
          value={mode === "month" ? monthValue : ""}
          error={mode === "month" ? monthError : undefined}
          disabled={mode !== "month"}
          onChange={(event) => onMonthChange(event.currentTarget.value)}
          onBlur={onMonthBlur}
        />
        <NumberInput
          label={ageLabel}
          value={mode === "age" ? ageValue ?? "" : ""}
          error={mode === "age" ? ageError : undefined}
          min={ageMin}
          max={ageMax}
          step={ageStep}
          decimalScale={2}
          disabled={mode !== "age"}
          onChange={(value) => {
            if (typeof value === "number" || value === "") {
              onAgeChange(value);
              return;
            }
            onAgeChange(null);
          }}
        />
      </Group>
      {mode === "age" && showComputedMonth && (
        <Text size="xs" c="dimmed">
          {computedMonthLabel}: {computedMonthValue ?? "--"}
        </Text>
      )}
    </Stack>
  );
}
