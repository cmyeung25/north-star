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
import { defaultCurrency, t } from "../../lib/i18n";
import type { TimelineEvent } from "./types";

const currencyOptions = [
  { value: defaultCurrency, label: t("currencyHkdLabel") },
];

interface TimelineEventFormProps {
  event: TimelineEvent | null;
  onCancel: () => void;
  onSave: (event: TimelineEvent) => void;
  submitLabel?: string;
}

export default function TimelineEventForm({
  event,
  onCancel,
  onSave,
  submitLabel = t("eventFormSave"),
}: TimelineEventFormProps) {
  const [formValues, setFormValues] = useState<TimelineEvent | null>(event);

  useEffect(() => {
    setFormValues(event);
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
        onChange={(eventChange) =>
          updateField("startMonth", eventChange.target.value)
        }
      />
      <TextInput
        label={t("eventFormEndMonth")}
        placeholder={t("eventFormEndMonthPlaceholder")}
        value={formValues.endMonth ?? ""}
        onChange={(eventChange) =>
          updateField("endMonth", eventChange.target.value || null)
        }
      />
      <NumberInput
        label={t("eventFormMonthlyAmount")}
        value={formValues.monthlyAmount}
        onChange={(value) => updateField("monthlyAmount", Number(value ?? 0))}
        min={0}
        thousandSeparator=","
      />
      <NumberInput
        label={t("eventFormOneTimeAmount")}
        value={formValues.oneTimeAmount}
        onChange={(value) => updateField("oneTimeAmount", Number(value ?? 0))}
        min={0}
        thousandSeparator=","
      />
      <NumberInput
        label={t("eventFormAnnualGrowth")}
        value={formValues.annualGrowthPct}
        onChange={(value) => updateField("annualGrowthPct", Number(value ?? 0))}
        min={0}
        max={100}
        decimalScale={2}
      />
      <Select
        label={t("eventFormCurrency")}
        data={currencyOptions}
        value={formValues.currency}
        onChange={(value) =>
          updateField("currency", value ?? defaultCurrency)
        }
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
        <Button onClick={() => onSave(formValues)}>{submitLabel}</Button>
      </Group>
    </Stack>
  );
}
