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
import { useEffect, useMemo, useState } from "react";
import type { EventField, EventFieldKey } from "@north-star/engine";
import { useTranslations } from "next-intl";
import { normalizeEvent, normalizeMonth } from "../../src/features/timeline/schema";
import type { TimelineEvent } from "./types";
import type { ScenarioAssumptions, ScenarioMember } from "../../src/store/scenarioStore";
import { buildDefinitionFromTimelineEvent } from "../../src/domain/events/utils";
import { compileEventToMonthlyCashflowSeries } from "../../src/domain/events/compiler";
import { getEventSign } from "../../src/events/eventCatalog";
import CashflowPreviewChart from "./CashflowPreviewChart";

interface TimelineEventFormProps {
  event: TimelineEvent | null;
  baseCurrency: string;
  members: ScenarioMember[];
  assumptions: Pick<ScenarioAssumptions, "baseMonth" | "horizonMonths">;
  fields?: readonly EventField[];
  showMember?: boolean;
  onCancel: () => void;
  onSave: (event: TimelineEvent) => void;
  submitLabel?: string;
}

export default function TimelineEventForm({
  event,
  baseCurrency,
  members,
  assumptions,
  fields,
  showMember = true,
  onCancel,
  onSave,
  submitLabel,
}: TimelineEventFormProps) {
  const t = useTranslations("timeline");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const [formValues, setFormValues] = useState<TimelineEvent | null>(event);
  const [errors, setErrors] = useState<{ startMonth?: string; endMonth?: string }>(
    {}
  );

  useEffect(() => {
    setFormValues(event);
    setErrors({});
  }, [event]);

  const fieldKeys = fields?.map((field) => field.key) ?? [];
  const shouldShowField = (key: EventFieldKey) =>
    fieldKeys.length === 0 || fieldKeys.includes(key);

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

    if (shouldShowField("startMonth") && !normalizedStartMonth) {
      nextErrors.startMonth = validation("useYearMonth");
    }

    if (shouldShowField("endMonth") && formValues.endMonth) {
      if (!normalizedEndMonth) {
        nextErrors.endMonth = validation("useYearMonth");
      } else if (
        normalizedStartMonth &&
        normalizedEndMonth < normalizedStartMonth
      ) {
        nextErrors.endMonth = validation("endMonthAfterStart");
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

  const previewSeries = useMemo(() => {
    if (!formValues || !assumptions.baseMonth) {
      return [];
    }

    const definition = buildDefinitionFromTimelineEvent(formValues);
    return compileEventToMonthlyCashflowSeries({
      definition,
      ref: { refId: definition.id, enabled: formValues.enabled },
      assumptions,
      signByType: getEventSign,
    });
  }, [assumptions, formValues]);

  if (!formValues) {
    return null;
  }

  const currencyOptions = [
    { value: baseCurrency, label: baseCurrency },
  ];
  const memberOptions = [
    { value: "household", label: t("memberHousehold") },
    ...members.map((member) => ({
      value: member.id,
      label: member.name,
    })),
  ];
  const memberValue = formValues.memberId ?? "household";

  return (
    <Stack gap="md">
      {shouldShowField("name") && (
        <TextInput
          label={t("eventFormName")}
          value={formValues.name}
          onChange={(eventChange) => updateField("name", eventChange.target.value)}
        />
      )}
      {showMember && (
        <Select
          label={t("memberLabel")}
          data={memberOptions}
          value={memberValue}
          onChange={(value) =>
            updateField(
              "memberId",
              value === "household" ? undefined : value ?? undefined
            )
          }
        />
      )}
      {shouldShowField("startMonth") && (
        <TextInput
          label={t("eventFormStartMonth")}
          placeholder={common("yearMonthPlaceholder")}
          value={formValues.startMonth}
          error={errors.startMonth}
          onChange={(eventChange) =>
            updateField("startMonth", eventChange.target.value)
          }
          onBlur={(eventChange) =>
            handleNormalizeMonth("startMonth", eventChange.target.value)
          }
        />
      )}
      {shouldShowField("endMonth") && (
        <TextInput
          label={t("eventFormEndMonth")}
          placeholder={common("yearMonthOptionalPlaceholder")}
          value={formValues.endMonth ?? ""}
          error={errors.endMonth}
          onChange={(eventChange) =>
            updateField("endMonth", eventChange.target.value || null)
          }
          onBlur={(eventChange) =>
            handleNormalizeMonth("endMonth", eventChange.target.value)
          }
        />
      )}
      {shouldShowField("monthlyAmount") && (
        <NumberInput
          label={t("eventFormMonthlyAmount")}
          value={formValues.monthlyAmount}
          onChange={(value) => updateField("monthlyAmount", Number(value ?? 0))}
          thousandSeparator=","
          min={0}
        />
      )}
      {shouldShowField("oneTimeAmount") && (
        <NumberInput
          label={t("eventFormOneTimeAmount")}
          value={formValues.oneTimeAmount}
          onChange={(value) => updateField("oneTimeAmount", Number(value ?? 0))}
          thousandSeparator=","
          min={0}
        />
      )}
      {shouldShowField("annualGrowthPct") && (
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
      )}
      {(shouldShowField("monthlyAmount") || shouldShowField("oneTimeAmount")) && (
        <CashflowPreviewChart
          series={previewSeries}
          currency={formValues.currency ?? baseCurrency}
          disabled={!formValues.enabled}
        />
      )}
      {shouldShowField("currency") && (
        <Select
          label={t("eventFormCurrency")}
          data={currencyOptions}
          value={formValues.currency}
          onChange={(value) => updateField("currency", value ?? baseCurrency)}
        />
      )}
      {shouldShowField("enabled") && (
        <Switch
          label={t("eventFormEnabled")}
          checked={formValues.enabled}
          onChange={(eventChange) =>
            updateField("enabled", eventChange.currentTarget.checked)
          }
        />
      )}
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          {common("actionCancel")}
        </Button>
        <Button onClick={handleSave}>{submitLabel ?? common("actionSave")}</Button>
      </Group>
    </Stack>
  );
}
