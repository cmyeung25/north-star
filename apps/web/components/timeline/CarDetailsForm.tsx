// Shape note: Car positions include purchase details, holding costs, and optional loan info.
"use client";

import {
  Button,
  Group,
  NumberInput,
  Stack,
  Switch,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { normalizeMonth } from "../../src/features/timeline/schema";
import type { CarPositionDraft } from "../../src/store/scenarioStore";
import {
  CarPositionSchema,
  getCarPositionErrors,
} from "../../src/store/scenarioValidation";

type CarDetailsFormProps = {
  car: CarPositionDraft;
  onCancel: () => void;
  onSave: (car: CarPositionDraft) => void;
};

export default function CarDetailsForm({ car, onCancel, onSave }: CarDetailsFormProps) {
  const t = useTranslations("cars");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const [formValues, setFormValues] = useState<CarPositionDraft>(car);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    setFormValues(car);
    setErrors({});
  }, [car]);

  const updateField = <K extends keyof CarPositionDraft>(
    key: K,
    value: CarPositionDraft[K]
  ) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const toPositiveNumber = (value: number | string | null | undefined) =>
    Math.max(0, Number(value ?? 0));

  const handleLoanToggle = (checked: boolean) => {
    setFormValues((current) => ({
      ...current,
      loan: checked
        ? current.loan ?? {
            principal: Math.max(0, current.purchasePrice - current.downPayment),
            annualInterestRatePct: 3,
            termYears: 5,
            monthlyPayment: 0,
          }
        : undefined,
    }));
  };

  const updateLoan = (patch: Partial<NonNullable<CarPositionDraft["loan"]>>) => {
    const current = formValues.loan ?? {
      principal: 0,
      annualInterestRatePct: 0,
      termYears: 1,
      monthlyPayment: 0,
    };

    updateField("loan", {
      ...current,
      ...patch,
    });
  };

  const handleSave = () => {
    const normalizedMonth = normalizeMonth(formValues.purchaseMonth);

    const nextValues = {
      ...formValues,
      purchaseMonth: normalizedMonth ?? formValues.purchaseMonth,
    };

    const parsed = CarPositionSchema.safeParse(nextValues);
    if (!parsed.success) {
      setErrors(getCarPositionErrors(parsed.error, (key) => validation(key)));
      return;
    }

    onSave({ ...parsed.data, id: formValues.id });
  };

  return (
    <Stack gap="md">
      <Title order={5}>{t("title")}</Title>
      <TextInput
        label={t("purchaseMonth")}
        placeholder={common("yearMonthPlaceholder")}
        value={formValues.purchaseMonth ?? ""}
        error={errors.purchaseMonth}
        onChange={(event) => updateField("purchaseMonth", event.target.value)}
      />
      <NumberInput
        label={t("purchasePrice")}
        value={formValues.purchasePrice ?? 0}
        error={errors.purchasePrice}
        onChange={(value) => updateField("purchasePrice", toPositiveNumber(value))}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("downPayment")}
        value={formValues.downPayment ?? 0}
        error={errors.downPayment}
        onChange={(value) => updateField("downPayment", toPositiveNumber(value))}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("annualDepreciationRate")}
        value={formValues.annualDepreciationRatePct ?? 0}
        error={errors.annualDepreciationRatePct}
        onChange={(value) =>
          updateField("annualDepreciationRatePct", toPositiveNumber(value))
        }
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
      />
      <NumberInput
        label={t("holdingCostMonthly")}
        value={formValues.holdingCostMonthly ?? 0}
        error={errors.holdingCostMonthly}
        onChange={(value) => updateField("holdingCostMonthly", toPositiveNumber(value))}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("holdingCostGrowth")}
        value={formValues.holdingCostAnnualGrowthPct ?? 0}
        error={errors.holdingCostAnnualGrowthPct}
        onChange={(value) =>
          updateField("holdingCostAnnualGrowthPct", toPositiveNumber(value))
        }
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
      />
      <Switch
        label={t("loanEnabled")}
        checked={Boolean(formValues.loan)}
        onChange={(event) => handleLoanToggle(event.currentTarget.checked)}
      />
      {formValues.loan && (
        <>
          <NumberInput
            label={t("loanPrincipal")}
            value={formValues.loan.principal ?? 0}
            error={errors["loan.principal"] ?? errors.loan}
            onChange={(value) =>
              updateLoan({
                principal: toPositiveNumber(value),
              })
            }
            thousandSeparator=","
            min={0}
          />
          <NumberInput
            label={t("loanRate")}
            value={formValues.loan.annualInterestRatePct ?? 0}
            error={errors["loan.annualInterestRatePct"] ?? errors.loan}
            onChange={(value) =>
              updateLoan({
                annualInterestRatePct: toPositiveNumber(value),
              })
            }
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
          />
          <NumberInput
            label={t("loanTerm")}
            value={formValues.loan.termYears ?? 0}
            error={errors["loan.termYears"] ?? errors.loan}
            onChange={(value) =>
              updateLoan({
                termYears: Math.max(1, Math.round(Number(value ?? 0))),
              })
            }
            min={1}
            max={50}
          />
          <NumberInput
            label={t("loanMonthlyPayment")}
            value={formValues.loan.monthlyPayment ?? 0}
            error={errors["loan.monthlyPayment"] ?? errors.loan}
            onChange={(value) =>
              updateLoan({
                monthlyPayment: toPositiveNumber(value),
              })
            }
            thousandSeparator=","
            min={0}
          />
        </>
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
