// Shape note: Home details originally captured price/downPayment/mortgage/appreciation (+feesOneTime).
// Added fields: holdingCostMonthly and holdingCostAnnualGrowthPct (percent in UI).
// Back-compat: missing fields default to 0 and do not break saved scenarios.
"use client";

import { Button, Group, NumberInput, Stack, TextInput, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import { t } from "../../lib/i18n";
import { normalizeMonth } from "../../src/features/timeline/schema";
import type { HomePosition, HomePositionDraft } from "../../src/store/scenarioStore";
import {
  HomePositionSchema,
  getHomePositionErrors,
} from "../../src/store/scenarioValidation";

type HomeDetailsFormProps = {
  home: HomePositionDraft;
  onCancel: () => void;
  onSave: (home: HomePositionDraft) => void;
};

export default function HomeDetailsForm({
  home,
  onCancel,
  onSave,
}: HomeDetailsFormProps) {
  const [formValues, setFormValues] = useState<HomePositionDraft>(home);
  const [errors, setErrors] = useState<
    Partial<Record<keyof HomePosition, string>>
  >({});

  useEffect(() => {
    setFormValues(home);
    setErrors({});
  }, [home]);

  const updateField = <K extends keyof HomePositionDraft>(
    key: K,
    value: HomePositionDraft[K]
  ) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const handleNormalizeMonth = (value: string) => {
    const normalized = normalizeMonth(value);
    if (normalized) {
      updateField(
        "purchaseMonth",
        normalized as HomePositionDraft["purchaseMonth"]
      );
    }
  };

  const handleSave = () => {
    const normalizedMonth = normalizeMonth(formValues.purchaseMonth);
    const nextValues = {
      ...formValues,
      purchaseMonth: normalizedMonth ?? formValues.purchaseMonth,
    };

    const parsed = HomePositionSchema.safeParse(nextValues);
    if (!parsed.success) {
      setErrors(getHomePositionErrors(parsed.error));
      return;
    }

    onSave({ ...parsed.data, id: formValues.id });
  };

  return (
    <Stack gap="md">
      <Title order={5}>{t("homeDetailsTitle")}</Title>
      <TextInput
        label={t("homeDetailsPurchaseMonth")}
        placeholder="YYYY-MM"
        value={formValues.purchaseMonth}
        error={errors.purchaseMonth}
        onChange={(event) => updateField("purchaseMonth", event.target.value)}
        onBlur={(event) => handleNormalizeMonth(event.target.value)}
      />
      <NumberInput
        label={t("homeDetailsPurchasePrice")}
        value={formValues.purchasePrice}
        error={errors.purchasePrice}
        onChange={(value) => updateField("purchasePrice", Number(value ?? 0))}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("homeDetailsDownPayment")}
        value={formValues.downPayment}
        error={errors.downPayment}
        onChange={(value) => updateField("downPayment", Number(value ?? 0))}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("homeDetailsMortgageRate")}
        value={formValues.mortgageRatePct}
        error={errors.mortgageRatePct}
        onChange={(value) => updateField("mortgageRatePct", Number(value ?? 0))}
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
      />
      <NumberInput
        label={t("homeDetailsMortgageTerm")}
        value={formValues.mortgageTermYears}
        error={errors.mortgageTermYears}
        onChange={(value) => updateField("mortgageTermYears", Number(value ?? 0))}
        min={1}
        max={50}
      />
      <NumberInput
        label={t("homeDetailsAnnualAppreciation")}
        value={formValues.annualAppreciationPct}
        error={errors.annualAppreciationPct}
        onChange={(value) =>
          updateField("annualAppreciationPct", Number(value ?? 0))
        }
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
      />
      <NumberInput
        label={t("homeDetailsFeesOneTime")}
        value={formValues.feesOneTime ?? 0}
        error={errors.feesOneTime}
        onChange={(value) =>
          updateField("feesOneTime", Number(value ?? 0))
        }
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("homeDetailsHoldingCostMonthly")}
        value={formValues.holdingCostMonthly ?? 0}
        error={errors.holdingCostMonthly}
        onChange={(value) =>
          updateField("holdingCostMonthly", Number(value ?? 0))
        }
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("homeDetailsHoldingCostGrowth")}
        value={formValues.holdingCostAnnualGrowthPct ?? 0}
        error={errors.holdingCostAnnualGrowthPct}
        onChange={(value) =>
          updateField("holdingCostAnnualGrowthPct", Number(value ?? 0))
        }
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
      />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          {t("eventFormCancel")}
        </Button>
        <Button onClick={handleSave}>{t("eventFormSave")}</Button>
      </Group>
    </Stack>
  );
}
