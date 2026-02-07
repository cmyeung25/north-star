"use client";

import { Group, NumberInput, SegmentedControl, Stack, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import MonthField from "./MonthField";
import {
  addMonths,
  canRepresentByWholeYears,
  monthToAgeYearsIfAligned,
  resolveDateRef,
  type MemberBirthLookup,
  type DateRef,
  type MonthStr,
} from "../src/domain/dateRef";
import { normalizeMonthInput } from "../src/utils/month";

type DateRefInputProps = {
  label: string;
  value: DateRef | null;
  onChange: (value: DateRef | null) => void;
  member?: { id: string; birthMonth?: MonthStr };
  disabled?: boolean;
  allowAge?: boolean;
  monthInput?: string;
  onMonthInputChange?: (value: string) => void;
  onMonthInputBlur?: () => void;
  monthError?: string;
  allowEmpty?: boolean;
};

export default function DateRefInput({
  label,
  value,
  onChange,
  member,
  disabled = false,
  allowAge,
  monthInput,
  onMonthInputChange,
  onMonthInputBlur,
  monthError,
  allowEmpty = false,
}: DateRefInputProps) {
  const t = useTranslations("timeline");
  const [localMonthInput, setLocalMonthInput] = useState(
    value?.mode === "MONTH" ? value.month : ""
  );
  const [alignmentError, setAlignmentError] = useState<string | null>(null);

  const resolvedAllowAge = allowAge ?? Boolean(member);
  const ageEnabled = resolvedAllowAge && Boolean(member?.birthMonth);
  const currentMode = value?.mode === "AGE" ? "age" : "month";
  const inputValue = monthInput ?? localMonthInput;

  useEffect(() => {
    if (value?.mode === "MONTH") {
      setLocalMonthInput(value.month);
      return;
    }
    if (!value) {
      setLocalMonthInput("");
    }
  }, [value]);

  const memberMap = useMemo<MemberBirthLookup>(
    () => (member ? { [member.id]: { birthMonth: member.birthMonth } } : {}),
    [member]
  );

  const previewMonth =
    value?.mode === "AGE" && member?.birthMonth
      ? resolveDateRef(value, memberMap)
      : null;

  const handleMonthInputChange = (next: string) => {
    setAlignmentError(null);
    if (onMonthInputChange) {
      onMonthInputChange(next);
    } else {
      setLocalMonthInput(next);
    }

    const normalized = normalizeMonthInput(next);
    if (normalized.status === "valid" && normalized.month) {
      onChange({ mode: "MONTH", month: normalized.month as MonthStr });
      return;
    }
    if (normalized.status === "empty" && allowEmpty) {
      onChange(null);
    }
  };

  const handleModeChange = (nextMode: string) => {
    if (nextMode === currentMode) {
      return;
    }
    if (nextMode === "age") {
      if (!resolvedAllowAge) {
        return;
      }
      if (!member?.birthMonth) {
        setAlignmentError(null);
        return;
      }
      const monthValue =
        value?.mode === "MONTH"
          ? value.month
          : (normalizeMonthInput(inputValue).month as MonthStr | undefined);
      if (!monthValue) {
        return;
      }
      if (!canRepresentByWholeYears(monthValue, member.birthMonth)) {
        setAlignmentError(t("dateRefAlignmentError"));
        return;
      }
      const ageYears = monthToAgeYearsIfAligned(monthValue, member.birthMonth);
      if (ageYears === null) {
        setAlignmentError(t("dateRefAlignmentError"));
        return;
      }
      onChange({ mode: "AGE", memberId: member.id, ageYears });
      setAlignmentError(null);
      return;
    }

    if (value?.mode === "AGE") {
      if (!member?.birthMonth) {
        onChange(null);
        return;
      }
      const month = addMonths(member.birthMonth, value.ageYears * 12);
      onChange({ mode: "MONTH", month });
      return;
    }
  };

  const handleAgeChange = (nextValue: string | number) => {
    if (nextValue === "") {
      return;
    }
    if (!member) {
      return;
    }
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const ageYears = Math.max(0, Math.floor(parsed));
    onChange({ mode: "AGE", memberId: member.id, ageYears });
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Text fw={500}>{label}</Text>
        <SegmentedControl
          value={currentMode}
          onChange={handleModeChange}
          data={[
            { value: "month", label: t("dateRefModeMonth") },
            { value: "age", label: t("dateRefModeAge"), disabled: !ageEnabled },
          ]}
          disabled={disabled}
        />
      </Group>
      {!resolvedAllowAge && (
        <Text size="xs" c="dimmed">
          {t("dateRefMemberRequired")}
        </Text>
      )}
      {currentMode === "month" && (
        <MonthField
          placeholder={t("dateRefMonthPlaceholder")}
          value={inputValue}
          error={monthError}
          onChange={handleMonthInputChange}
          onBlur={onMonthInputBlur}
          allowClear={allowEmpty}
          disabled={disabled}
        />
      )}
      {currentMode === "age" && (
        <Stack gap={4}>
          <NumberInput
            value={value?.mode === "AGE" ? value.ageYears : 0}
            onChange={handleAgeChange}
            min={0}
            decimalScale={0}
            disabled={disabled || !member?.birthMonth}
          />
          {!member?.birthMonth && (
            <Text size="xs" c="red">
              {t("dateRefBirthRequired")}
            </Text>
          )}
          {previewMonth && (
            <Text size="xs" c="dimmed">
              {t("dateRefPreview", { month: previewMonth })}
            </Text>
          )}
        </Stack>
      )}
      {alignmentError && (
        <Text size="xs" c="red">
          {alignmentError}
        </Text>
      )}
    </Stack>
  );
}
