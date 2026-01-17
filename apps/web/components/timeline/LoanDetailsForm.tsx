// Shape note: Loan positions include principal, rate, term, and optional fees/payments.
"use client";

import {
  Button,
  Group,
  NumberInput,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { normalizeMonth } from "../../src/features/timeline/schema";
import type { LoanPositionDraft } from "../../src/store/scenarioStore";
import { LoanPositionSchema, getLoanPositionErrors } from "../../src/store/scenarioValidation";

type LoanDetailsFormProps = {
  loan: LoanPositionDraft;
  onCancel: () => void;
  onSave: (loan: LoanPositionDraft) => void;
};

export default function LoanDetailsForm({ loan, onCancel, onSave }: LoanDetailsFormProps) {
  const t = useTranslations("loans");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const [formValues, setFormValues] = useState<LoanPositionDraft>(loan);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    setFormValues(loan);
    setErrors({});
  }, [loan]);

  const updateField = <K extends keyof LoanPositionDraft>(
    key: K,
    value: LoanPositionDraft[K]
  ) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const toPositiveNumber = (value: number | string | null | undefined) =>
    Math.max(0, Number(value ?? 0));

  const handleSave = () => {
    const normalizedMonth = normalizeMonth(formValues.startMonth);

    const nextValues = {
      ...formValues,
      startMonth: normalizedMonth ?? formValues.startMonth,
    };

    const parsed = LoanPositionSchema.safeParse(nextValues);
    if (!parsed.success) {
      setErrors(getLoanPositionErrors(parsed.error, (key) => validation(key)));
      return;
    }

    onSave({ ...parsed.data, id: formValues.id });
  };

  return (
    <Stack gap="md">
      <Title order={5}>{t("title")}</Title>
      <TextInput
        label={t("startMonth")}
        placeholder={common("yearMonthPlaceholder")}
        value={formValues.startMonth ?? ""}
        error={errors.startMonth}
        onChange={(event) => updateField("startMonth", event.target.value)}
      />
      <NumberInput
        label={t("principal")}
        value={formValues.principal ?? 0}
        error={errors.principal}
        onChange={(value) => updateField("principal", toPositiveNumber(value))}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("annualRate")}
        value={formValues.annualInterestRatePct ?? 0}
        error={errors.annualInterestRatePct}
        onChange={(value) =>
          updateField("annualInterestRatePct", toPositiveNumber(value))
        }
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
      />
      <NumberInput
        label={t("termYears")}
        value={formValues.termYears ?? 0}
        error={errors.termYears}
        onChange={(value) =>
          updateField("termYears", Math.max(1, Math.round(Number(value ?? 0))))
        }
        min={1}
        max={50}
      />
      <NumberInput
        label={t("monthlyPayment")}
        value={formValues.monthlyPayment ?? 0}
        error={errors.monthlyPayment}
        onChange={(value) => updateField("monthlyPayment", toPositiveNumber(value))}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("feesOneTime")}
        value={formValues.feesOneTime ?? 0}
        error={errors.feesOneTime}
        onChange={(value) => updateField("feesOneTime", toPositiveNumber(value))}
        thousandSeparator=","
        min={0}
      />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          {common("actionCancel")}
        </Button>
        <Button onClick={handleSave}>{common("actionSave")}</Button>
      </Group>
    </Stack>
  );
}
