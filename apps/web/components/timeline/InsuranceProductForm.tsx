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
import { useTranslations } from "next-intl";
import { normalizeEvent, normalizeMonth } from "../../src/features/timeline/schema";
import {
  buildTemplateParams,
  getInsuranceTemplate,
  insuranceTemplates,
} from "../../src/insurance/templates";
import type { TimelineEvent } from "./types";

type InsuranceProductFormProps = {
  event: TimelineEvent;
  baseCurrency: string;
  onCancel: () => void;
  onSave: (event: TimelineEvent) => void;
  submitLabel?: string;
};

export default function InsuranceProductForm({
  event,
  baseCurrency,
  onCancel,
  onSave,
  submitLabel,
}: InsuranceProductFormProps) {
  const t = useTranslations("timeline");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const [formValues, setFormValues] = useState<TimelineEvent>(event);
  const [errors, setErrors] = useState<{ startMonth?: string }>({});

  useEffect(() => {
    setFormValues(event);
    setErrors({});
  }, [event]);

  const template = useMemo(
    () => getInsuranceTemplate(formValues.templateId),
    [formValues.templateId]
  );
  const templateParams = buildTemplateParams(template, formValues.templateParams);

  const handleTemplateChange = (value: string | null) => {
    const nextTemplate = getInsuranceTemplate(value);
    setFormValues((current) => ({
      ...current,
      templateId: nextTemplate.id,
      templateParams: buildTemplateParams(nextTemplate),
    }));
  };

  const updateField = <K extends keyof TimelineEvent>(
    key: K,
    value: TimelineEvent[K]
  ) => {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateTemplateParam = (key: string, value: number) => {
    setFormValues((current) => ({
      ...current,
      templateParams: {
        ...templateParams,
        [key]: value,
      },
    }));
  };

  const handleNormalizeMonth = (value: string) => {
    const normalized = normalizeMonth(value);
    if (!normalized && value) {
      return;
    }
    updateField("startMonth", (normalized ?? value ?? "") as TimelineEvent["startMonth"]);
  };

  const handleSave = () => {
    const normalizedStartMonth = normalizeMonth(formValues.startMonth);
    if (!normalizedStartMonth) {
      setErrors({ startMonth: validation("useYearMonth") });
      return;
    }

    const normalizedEvent = normalizeEvent(
      {
        ...formValues,
        startMonth: normalizedStartMonth,
        endMonth: null,
        templateId: template.id,
        templateParams,
      },
      { baseCurrency }
    );

    onSave(normalizedEvent);
  };

  const currencyOptions = [{ value: baseCurrency, label: baseCurrency }];
  const templateOptions = insuranceTemplates.map((templateOption) => ({
    value: templateOption.id,
    label: t(`insuranceTemplates.${templateOption.id}`),
  }));

  return (
    <Stack gap="md">
      <TextInput
        label={t("eventFormName")}
        value={formValues.name}
        onChange={(eventChange) => updateField("name", eventChange.target.value)}
      />
      <TextInput
        label={t("eventFormStartMonth")}
        placeholder={common("yearMonthPlaceholder")}
        value={formValues.startMonth}
        error={errors.startMonth}
        onChange={(eventChange) => updateField("startMonth", eventChange.target.value)}
        onBlur={(eventChange) => handleNormalizeMonth(eventChange.target.value)}
      />
      <NumberInput
        label={t("eventFormMonthlyAmount")}
        value={formValues.monthlyAmount}
        onChange={(value) => updateField("monthlyAmount", Number(value ?? 0))}
        thousandSeparator=","
        min={0}
      />
      <Select
        label={t("eventFormCurrency")}
        data={currencyOptions}
        value={formValues.currency}
        onChange={(value) => updateField("currency", value ?? baseCurrency)}
      />
      <Select
        label={t("insuranceTemplateLabel")}
        data={templateOptions}
        value={template.id}
        onChange={handleTemplateChange}
      />
      {template.params.map((param) => (
        <NumberInput
          key={param.key}
          label={t(`insuranceParams.${param.key}`)}
          value={templateParams[param.key]}
          onChange={(value) => updateTemplateParam(param.key, Number(value ?? 0))}
          min={param.min ?? 0}
          thousandSeparator=","
        />
      ))}
      <Switch
        label={t("eventFormEnabled")}
        checked={formValues.enabled}
        onChange={(eventChange) =>
          updateField("enabled", eventChange.currentTarget.checked)
        }
      />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          {common("actionCancel")}
        </Button>
        <Button onClick={handleSave}>{submitLabel ?? common("actionSave")}</Button>
      </Group>
    </Stack>
  );
}
