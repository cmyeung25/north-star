// Shape note: Insurance positions support protection vs savings cash value tracking.
"use client";

import {
  Button,
  Card,
  Group,
  NumberInput,
  Radio,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { normalizeMonth } from "../../src/features/timeline/schema";
import type { InsurancePositionDraft } from "../../src/store/scenarioStore";
import {
  InsurancePositionSchema,
  getInsurancePositionErrors,
} from "../../src/store/scenarioValidation";

type InsuranceDetailsFormProps = {
  insurance: InsurancePositionDraft;
  onCancel: () => void;
  onSave: (insurance: InsurancePositionDraft) => void;
};

export default function InsuranceDetailsForm({
  insurance,
  onCancel,
  onSave,
}: InsuranceDetailsFormProps) {
  const t = useTranslations("insurances");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const [formValues, setFormValues] = useState<InsurancePositionDraft>(insurance);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    setFormValues(insurance);
    setErrors({});
  }, [insurance]);

  const updateField = <K extends keyof InsurancePositionDraft>(
    key: K,
    value: InsurancePositionDraft[K]
  ) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const toPositiveNumber = (value: number | string | null | undefined) =>
    Math.max(0, Number(value ?? 0));

  const handleSave = () => {
    const normalizedStartMonth = normalizeMonth(formValues.startMonth);
    const normalizedEndMonth = normalizeMonth(formValues.endMonth ?? "") ??
      formValues.endMonth ??
      undefined;

    const nextValues = {
      ...formValues,
      startMonth: normalizedStartMonth ?? formValues.startMonth,
      endMonth: normalizedEndMonth || undefined,
    };

    const parsed = InsurancePositionSchema.safeParse(nextValues);
    if (!parsed.success) {
      setErrors(getInsurancePositionErrors(parsed.error, (key) => validation(key)));
      return;
    }

    onSave({ ...parsed.data, id: formValues.id });
  };

  const showSavingsFields = (formValues.kind ?? "protection") === "savings";

  return (
    <Stack gap="md">
      <Title order={5}>{t("title")}</Title>
      <Card withBorder padding="md" radius="md">
        <Stack gap={6}>
          <Text size="sm" fw={600}>
            {t("infoTitle")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("infoProtectionLine1")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("infoProtectionLine2")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("infoProtectionLine3")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("infoSavingsLine1")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("infoSavingsLine2")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("infoSavingsLine3")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("infoWarning")}
          </Text>
        </Stack>
      </Card>
      <TextInput
        label={t("name")}
        value={formValues.name ?? ""}
        error={errors.name}
        onChange={(event) => updateField("name", event.target.value)}
      />
      <Switch
        label={t("enabled")}
        checked={formValues.enabled ?? true}
        onChange={(event) => updateField("enabled", event.currentTarget.checked)}
      />
      <Radio.Group
        label={t("kind")}
        value={formValues.kind ?? "protection"}
        onChange={(value) =>
          updateField("kind", value as InsurancePositionDraft["kind"])
        }
      >
        <Group mt="xs">
          <Radio value="protection" label={t("kindProtection")} />
          <Radio value="savings" label={t("kindSavings")} />
        </Group>
      </Radio.Group>
      <Group grow>
        <TextInput
          label={t("startMonth")}
          placeholder={common("yearMonthPlaceholder")}
          value={formValues.startMonth ?? ""}
          error={errors.startMonth}
          onChange={(event) => updateField("startMonth", event.target.value)}
        />
        <TextInput
          label={t("endMonth")}
          placeholder={common("yearMonthPlaceholder")}
          value={formValues.endMonth ?? ""}
          error={errors.endMonth}
          onChange={(event) => updateField("endMonth", event.target.value)}
        />
      </Group>
      <NumberInput
        label={t("premiumMonthly")}
        value={formValues.premiumMonthly ?? 0}
        error={errors.premiumMonthly}
        onChange={(value) => updateField("premiumMonthly", toPositiveNumber(value))}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("premiumAnnualGrowth")}
        value={formValues.premiumAnnualGrowthPct ?? 0}
        error={errors.premiumAnnualGrowthPct}
        onChange={(value) => updateField("premiumAnnualGrowthPct", Number(value ?? 0))}
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
      />
      {showSavingsFields && (
        <Stack gap="md">
          <NumberInput
            label={t("initialCashValue")}
            value={formValues.initialCashValue ?? 0}
            error={errors.initialCashValue}
            onChange={(value) =>
              updateField("initialCashValue", toPositiveNumber(value))
            }
            thousandSeparator=","
            min={0}
          />
          <NumberInput
            label={t("expectedReturn")}
            value={formValues.expectedAnnualReturnPct ?? 0}
            error={errors.expectedAnnualReturnPct}
            onChange={(value) =>
              updateField("expectedAnnualReturnPct", Number(value ?? 0))
            }
            min={-100}
            max={100}
            decimalScale={2}
            suffix="%"
          />
        </Stack>
      )}
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          {common("actionCancel")}
        </Button>
        <Button onClick={handleSave}>{common("actionSave")}</Button>
      </Group>
    </Stack>
  );
}
