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
import type { TimelineEvent } from "./types";

const currencyOptions = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
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
  submitLabel = "Save",
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
        label="Name"
        value={formValues.name}
        onChange={(eventChange) => updateField("name", eventChange.target.value)}
      />
      <TextInput
        label="Start month"
        placeholder="YYYY-MM"
        value={formValues.startMonth}
        onChange={(eventChange) =>
          updateField("startMonth", eventChange.target.value)
        }
      />
      <TextInput
        label="End month"
        placeholder="YYYY-MM (optional)"
        value={formValues.endMonth ?? ""}
        onChange={(eventChange) =>
          updateField("endMonth", eventChange.target.value || null)
        }
      />
      <NumberInput
        label="Monthly amount"
        value={formValues.monthlyAmount}
        onChange={(value) => updateField("monthlyAmount", Number(value ?? 0))}
        min={0}
        thousandSeparator=","
      />
      <NumberInput
        label="One-time amount"
        value={formValues.oneTimeAmount}
        onChange={(value) => updateField("oneTimeAmount", Number(value ?? 0))}
        min={0}
        thousandSeparator=","
      />
      <NumberInput
        label="Annual growth %"
        value={formValues.annualGrowthPct}
        onChange={(value) => updateField("annualGrowthPct", Number(value ?? 0))}
        min={0}
        max={100}
        decimalScale={2}
      />
      <Select
        label="Currency"
        data={currencyOptions}
        value={formValues.currency}
        onChange={(value) => updateField("currency", value ?? "USD")}
      />
      <Switch
        label="Enabled"
        checked={formValues.enabled}
        onChange={(eventChange) =>
          updateField("enabled", eventChange.currentTarget.checked)
        }
      />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(formValues)}>{submitLabel}</Button>
      </Group>
    </Stack>
  );
}
