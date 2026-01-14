"use client";

import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { t } from "../../lib/i18n";
import { normalizeEvent, normalizeMonth } from "../../src/features/timeline/schema";
import type { TimelineEvent } from "./types";

interface TimelineEventFormProps {
  event: TimelineEvent | null;
  baseCurrency: string;
  onCancel: () => void;
  onSave: (event: TimelineEvent) => void;
  submitLabel?: string;
}

export default function TimelineEventForm({
  event,
  baseCurrency,
  onCancel,
  onSave,
  submitLabel = t("eventFormSave"),
}: TimelineEventFormProps) {
  const [formValues, setFormValues] = useState<TimelineEvent | null>(event);
  const [errors, setErrors] = useState<{ startMonth?: string; endMonth?: string }>(
    {}
  );

  useEffect(() => {
    setFormValues(event);
    setErrors({});
  }, [event]);

  if (!formValues) {
    return null;
  }

  const updateField = <K extends keyof TimelineEvent>(
    key: K,
    value: TimelineEvent[K]
  ) => {
    setFormValues((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current
    );
  };

  const handleNormalizeMonth = (
    key: "startMonth" | "endMonth",
    value: string | null
  ) => {
    if (!formValues) {
      return;
    }
    const normalized = value ? normalizeMonth(value) : null;
    if (!normalized && value) {
      return;
    }
    if (key === "startMonth") {
      updateField("startMonth", (normalized ?? value ?? "") as TimelineEvent["startMonth"]);
      return;
    }
    updateField("endMonth", (normalized ?? null) as TimelineEvent["endMonth"]);
  };

  const handleSave = () => {
    if (!formValues) {
      return;
    }

    const normalizedStartMonth = normalizeMonth(formValues.startMonth);
    const normalizedEndMonth = formValues.endMonth
      ? normalizeMonth(formValues.endMonth)
      : null;
    const nextErrors: { startMonth?: string; endMonth?: string } = {};

    if (!normalizedStartMonth) {
      nextErrors.startMonth = "Use YYYY-MM (e.g. 2025-01).";
    }

    if (formValues.endMonth) {
      if (!normalizedEndMonth) {
        nextErrors.endMonth = "Use YYYY-MM (e.g. 2025-12).";
      } else if (
        normalizedStartMonth &&
        normalizedEndMonth < normalizedStartMonth
      ) {
        nextErrors.endMonth = "End month must be after the start month.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const normalizedEvent = normalizeEvent(
      {
        ...formValues,
        startMonth: normalizedStartMonth ?? formValues.startMonth,
        endMonth: normalizedEndMonth,
      },
      { baseCurrency }
    );

    onSave(normalizedEvent);
  };

  const currencyOptions = [
    { value: baseCurrency, label: baseCurrency },
  ];

  return (
    <Stack gap="md">
      <TextInput
        label={t("eventFormName")}
        value={formValues.name}
        onChange={(eventChange) => updateField("name", eventChange.target.value)}
      />
      <TextInput
        label={t("eventFormStartMonth")}
        placeholder={t("eventFormStartMonthPlaceholder")}
        value={formValues.startMonth}
        error={errors.startMonth}
        onChange={(eventChange) =>
          updateField("startMonth", eventChange.target.value)
        }
        onBlur={(eventChange) =>
          handleNormalizeMonth("startMonth", eventChange.target.value)
        }
      />
      <TextInput
        label={t("eventFormEndMonth")}
        placeholder={t("eventFormEndMonthPlaceholder")}
        value={formValues.endMonth ?? ""}
        error={errors.endMonth}
        onChange={(eventChange) =>
          updateField("endMonth", eventChange.target.value || null)
        }
        onBlur={(eventChange) =>
          handleNormalizeMonth("endMonth", eventChange.target.value)
        }
      />
      <NumberInput
        label={t("eventFormMonthlyAmount")}
        value={formValues.monthlyAmount}
        onChange={(value) => updateField("monthlyAmount", Number(value ?? 0))}
        thousandSeparator=","
      />
      <NumberInput
        label={t("eventFormOneTimeAmount")}
        value={formValues.oneTimeAmount}
        onChange={(value) => updateField("oneTimeAmount", Number(value ?? 0))}
        thousandSeparator=","
      />
      <NumberInput
        label={t("eventFormAnnualGrowth")}
        value={formValues.annualGrowthPct}
        onChange={(value) => {
          const nextValue = Math.min(Math.max(Number(value ?? 0), 0), 100);
          updateField("annualGrowthPct", nextValue);
        }}
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
      />
      <Select
        label={t("eventFormCurrency")}
        data={currencyOptions}
        value={formValues.currency}
        onChange={(value) => updateField("currency", value ?? baseCurrency)}
      />
      <Switch
        label={t("eventFormEnabled")}
        checked={formValues.enabled}
        onChange={(eventChange) =>
          updateField("enabled", eventChange.currentTarget.checked)
        }
      />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          {t("eventFormCancel")}
        </Button>
        <Button onClick={handleSave}>{submitLabel}</Button>
      </Group>
    </Stack>
  );
}
