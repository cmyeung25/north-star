// Shape note: Loan positions include principal, rate, term, and optional fees/payments.
"use client";

import {
  Button,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import MonthField from "../MonthField";
import { useEntityDraft } from "../../src/hooks/useEntityDraft";
import { normalizeMonthInput } from "../../src/utils/monthKey";
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
  const { draft: formValues, setDraft, errors, validate } = useEntityDraft(loan, (draft) => {
    const nextErrors: Partial<Record<string, string>> = {};
    const normalizedStart = normalizeMonthInput(draft.startMonth ?? "");
    if (normalizedStart.status !== "valid") {
      nextErrors.startMonth = validation("useYearMonth");
    }

    const parsed = LoanPositionSchema.safeParse({
      ...draft,
      startMonth: normalizedStart.month ?? draft.startMonth,
    });
    if (!parsed.success) {
      return {
        isValid: false,
        errors: { ...nextErrors, ...getLoanPositionErrors(parsed.error, validation) },
      };
    }

    if (Object.keys(nextErrors).length > 0) {
      return { isValid: false, errors: nextErrors };
    }

    return {
      isValid: true,
      errors: {},
      value: {
        ...parsed.data,
        id: draft.id,
        monthlyPayment:
          (draft.paymentMethod ?? "amortization") === "manual"
            ? draft.monthlyPayment
            : undefined,
        paymentMethod: draft.paymentMethod ?? "amortization",
      },
    };
  });

  const updateField = <K extends keyof LoanPositionDraft>(
    key: K,
    value: LoanPositionDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const toPositiveNumber = (value: number | string | null | undefined) =>
    Math.max(0, Number(value ?? 0));
  const paymentMethod = formValues.paymentMethod ?? "amortization";
  const computedPayment = computeMonthlyPayment(
    toPositiveNumber(formValues.principal),
    toPositiveNumber(formValues.annualInterestRatePct) / 100,
    Math.round(toPositiveNumber(formValues.termYears) * 12)
  );

  const handleSave = () => {
    const result = validate();
    if (!result.isValid || !result.value) {
      return;
    }
    onSave(result.value);
  };

  return (
    <Stack gap="md">
      <Title order={5}>{t("title")}</Title>
      <MonthField
        label={t("startMonth")}
        placeholder={common("yearMonthPlaceholder")}
        value={formValues.startMonth ?? ""}
        error={errors.startMonth}
        onChange={(value) => updateField("startMonth", value)}
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
          label={t("monthlyPaymentAuto")}
          value={computedPayment}
          thousandSeparator=","
          min={0}
          disabled
        />
      )}
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
