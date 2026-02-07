"use client";

import { Group, NumberInput, SegmentedControl, Stack, Text } from "@mantine/core";
import React, { useMemo, useState, type ReactNode } from "react";
import MonthField from "./MonthField";
import {
  addMonths,
  isMonthStr,
  monthToAgeYearsIfAligned,
  type DateRefDraft,
} from "../src/domain/dateRef";

export type DateRefInputValue = DateRefDraft;

type DateRefInputMonthInputProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
};

type DateRefInputProps = {
  label: string;
  value: DateRefInputValue;
  onChange: (value: DateRefInputValue) => void;
  member?: { id: string; birthMonth?: string };
  disabled?: boolean;
  allowAge?: boolean;
  error?: string;
  monthLabel: string;
  ageLabel: string;
  previewLabel: (month: string) => string;
  missingMemberText: string;
  missingBirthMonthText: string;
  invalidMonthSwitchText: string;
  misalignedMonthText: string;
  renderMonthInput?: (props: DateRefInputMonthInputProps) => ReactNode;
};

export default function DateRefInput({
  label,
  value,
  onChange,
  member,
  disabled = false,
  allowAge = true,
  error,
  monthLabel,
  ageLabel,
  previewLabel,
  missingMemberText,
  missingBirthMonthText,
  invalidMonthSwitchText,
  misalignedMonthText,
  renderMonthInput,
}: DateRefInputProps) {
  const [switchError, setSwitchError] = useState<string | null>(null);
  const canUseAge = allowAge && Boolean(member?.id);
  const hasBirthMonth = Boolean(member?.birthMonth && isMonthStr(member.birthMonth));
  const ageDisabled = disabled || !canUseAge || !hasBirthMonth;

  const resolvedAgeMonth = useMemo(() => {
    if (value.mode !== "AGE" || !member?.birthMonth || !isMonthStr(member.birthMonth)) {
      return null;
    }
    return addMonths(member.birthMonth, value.ageYears * 12);
  }, [member?.birthMonth, value]);

  const handleModeChange = (nextMode: string) => {
    setSwitchError(null);
    if (nextMode === value.mode) {
      return;
    }

    if (nextMode === "AGE") {
      if (!canUseAge) {
        setSwitchError(missingMemberText);
        return;
      }
      const birthMonth = member?.birthMonth;
      if (!birthMonth || !isMonthStr(birthMonth)) {
        setSwitchError(missingBirthMonthText);
        return;
      }
      if (value.mode === "MONTH") {
        if (!isMonthStr(value.month)) {
          setSwitchError(invalidMonthSwitchText);
          return;
        }
        const ageYears = monthToAgeYearsIfAligned(value.month, birthMonth);
        if (ageYears === null) {
          setSwitchError(misalignedMonthText);
          return;
        }
        onChange({ mode: "AGE", memberId: member.id, ageYears });
        return;
      }
    }

    if (nextMode === "MONTH" && value.mode === "AGE") {
      if (!member?.birthMonth || !isMonthStr(member.birthMonth)) {
        setSwitchError(missingBirthMonthText);
        return;
      }
      const month = addMonths(member.birthMonth, value.ageYears * 12);
      onChange({ mode: "MONTH", month });
    }
  };

  const ageHelperText = useMemo(() => {
    if (!canUseAge) {
      return missingMemberText;
    }
    if (!hasBirthMonth) {
      return missingBirthMonthText;
    }
    return null;
  }, [canUseAge, hasBirthMonth, missingMemberText, missingBirthMonthText]);

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text fw={500}>{label}</Text>
        <SegmentedControl
          value={value.mode}
          onChange={handleModeChange}
          data={[
            { value: "MONTH", label: monthLabel },
            { value: "AGE", label: ageLabel, disabled: !canUseAge },
          ]}
          disabled={disabled}
        />
      </Group>
      {value.mode === "MONTH" ? (
        renderMonthInput ? (
          renderMonthInput({
            value: value.month,
            onChange: (month) => onChange({ mode: "MONTH", month }),
            error,
            disabled,
          })
        ) : (
          <MonthField
            value={value.month}
            onChange={(month) => onChange({ mode: "MONTH", month })}
            error={error}
            disabled={disabled}
          />
        )
      ) : (
        <NumberInput
          value={value.ageYears}
          min={0}
          step={1}
          allowDecimal={false}
          onChange={(nextValue) =>
            onChange({
              mode: "AGE",
              memberId: value.memberId,
              ageYears: typeof nextValue === "number" ? nextValue : 0,
            })
          }
          error={error}
          disabled={ageDisabled}
        />
      )}
      {value.mode === "AGE" && resolvedAgeMonth && (
        <Text size="xs" c="dimmed">
          {previewLabel(resolvedAgeMonth)}
        </Text>
      )}
      {value.mode === "AGE" && ageHelperText && (
        <Text size="xs" c="red">
          {ageHelperText}
        </Text>
      )}
      {switchError && (
        <Text size="xs" c="red">
          {switchError}
        </Text>
      )}
    </Stack>
  );
}
