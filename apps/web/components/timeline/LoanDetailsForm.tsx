// Shape note: Loan positions include principal, rate, term, and optional fees/payments.
"use client";

import {
  Badge,
  Button,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  Switch,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { normalizeMonthStrict } from "../../src/utils/month";
import type { LoanPositionDraft } from "../../src/store/scenarioStore";
import { LoanPositionSchema, getLoanPositionErrors } from "../../src/store/scenarioValidation";
import { computeMonthlyPayment } from "../../src/domain/positions/calculations";

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
  const paymentMethod = formValues.paymentMethod ?? "amortization";
  const purchasePrice = toPositiveNumber(formValues.purchasePrice);
  const downPaymentPercent = Math.min(100, toPositiveNumber(formValues.downPaymentPercent));
  const downPaymentAmount = purchasePrice * (downPaymentPercent / 100);
  const loanAmount = Math.max(0, purchasePrice - downPaymentAmount);
  const computedPayment = computeMonthlyPayment(
    toPositiveNumber(formValues.principal),
    toPositiveNumber(formValues.annualInterestRatePct) / 100,
    Math.round(toPositiveNumber(formValues.termYears) * 12)
  );

  const handlePurchasePriceChange = (value: number | string | null | undefined) => {
    const nextPurchasePrice = toPositiveNumber(value);
    const nextDownPayment = (nextPurchasePrice * downPaymentPercent) / 100;
    setFormValues((current) => ({
      ...current,
      purchasePrice: nextPurchasePrice,
      principal: Math.max(0, nextPurchasePrice - nextDownPayment),
    }));
  };

  const handleDownPaymentPercentChange = (value: number | string | null | undefined) => {
    const nextPercent = Math.min(100, toPositiveNumber(value));
    const nextDownPayment = (purchasePrice * nextPercent) / 100;
    setFormValues((current) => ({
      ...current,
      downPaymentPercent: nextPercent,
      principal: Math.max(0, purchasePrice - nextDownPayment),
    }));
  };

  const handleSave = () => {
    const normalizedMonth = normalizeMonthStrict(formValues.startMonth);

    const nextValues = {
      ...formValues,
      startMonth: normalizedMonth.ok ? normalizedMonth.month : formValues.startMonth,
      monthlyPayment: paymentMethod === "manual" ? formValues.monthlyPayment : undefined,
      paymentMethod,
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
        label={t("purchasePrice")}
        value={formValues.purchasePrice ?? 0}
        error={errors.purchasePrice}
        onChange={handlePurchasePriceChange}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("downPaymentPercent")}
        value={formValues.downPaymentPercent ?? 0}
        error={errors.downPaymentPercent}
        onChange={handleDownPaymentPercentChange}
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
      />
      {purchasePrice > 0 && (
        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            {t("downPaymentAmountLabel", { amount: Math.round(downPaymentAmount) })}
          </Text>
          <Text size="xs" c="dimmed">
            {t("loanAmountLabel", { amount: Math.round(loanAmount) })}
          </Text>
        </Stack>
      )}
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
      <Stack gap="xs">
        <Text fw={500}>{t("paymentMethodLabel")}</Text>
        <SegmentedControl
          data={[
            { value: "amortization", label: t("paymentMethodAmortization") },
            { value: "manual", label: t("paymentMethodManual") },
          ]}
          value={paymentMethod}
          onChange={(value) =>
            updateField("paymentMethod", value as "amortization" | "manual")
          }
        />
      </Stack>
      {paymentMethod === "manual" ? (
        <NumberInput
          label={t("monthlyPayment")}
          value={formValues.monthlyPayment ?? 0}
          error={errors.monthlyPayment}
          onChange={(value) =>
            updateField("monthlyPayment", toPositiveNumber(value))
          }
          thousandSeparator=","
          min={0}
        />
      ) : (
        <NumberInput
          label={
            <Group gap={6}>
              <Text size="sm">{t("monthlyPaymentAuto")}</Text>
              <Badge size="xs" variant="light">
                {t("estimateLabel")}
              </Badge>
            </Group>
          }
          value={computedPayment}
          thousandSeparator=","
          min={0}
          disabled
        />
      )}
      <Switch
        label={t("generatePaymentExpense")}
        checked={Boolean(formValues.generatePaymentExpense)}
        onChange={(event) =>
          updateField("generatePaymentExpense", event.currentTarget.checked)
        }
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
