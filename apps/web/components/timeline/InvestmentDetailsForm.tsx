// Shape note: Investment positions include start month, balance, returns, contributions, and fees.
"use client";

import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { normalizeMonth } from "../../src/features/timeline/schema";
import type { InvestmentPositionDraft } from "../../src/store/scenarioStore";
import {
  InvestmentPositionSchema,
  getInvestmentPositionErrors,
} from "../../src/store/scenarioValidation";

type InvestmentDetailsFormProps = {
  investment: InvestmentPositionDraft;
  onCancel: () => void;
  onSave: (investment: InvestmentPositionDraft) => void;
};

export default function InvestmentDetailsForm({
  investment,
  onCancel,
  onSave,
}: InvestmentDetailsFormProps) {
  const t = useTranslations("investments");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const [formValues, setFormValues] = useState<InvestmentPositionDraft>(investment);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  useEffect(() => {
    setFormValues(investment);
    setErrors({});
  }, [investment]);

  const updateField = <K extends keyof InvestmentPositionDraft>(
    key: K,
    value: InvestmentPositionDraft[K]
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

    const parsed = InvestmentPositionSchema.safeParse(nextValues);
    if (!parsed.success) {
      setErrors(getInvestmentPositionErrors(parsed.error, (key) => validation(key)));
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
        label={t("initialValue")}
        value={formValues.initialValue ?? 0}
        error={errors.initialValue}
        onChange={(value) => updateField("initialValue", toPositiveNumber(value))}
        thousandSeparator=","
        min={0}
      />
      <Select
        label={t("assetClass")}
        value={formValues.assetClass ?? ""}
        onChange={(value) =>
          updateField(
            "assetClass",
            (value || undefined) as InvestmentPositionDraft["assetClass"]
          )
        }
        data={[
          { value: "", label: t("assetClassNone") },
          { value: "equity", label: t("assetClassEquity") },
          { value: "bond", label: t("assetClassBond") },
          { value: "fund", label: t("assetClassFund") },
          { value: "crypto", label: t("assetClassCrypto") },
        ]}
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
      <NumberInput
        label={t("monthlyContribution")}
        value={formValues.monthlyContribution ?? 0}
        error={errors.monthlyContribution}
        onChange={(value) =>
          updateField("monthlyContribution", toPositiveNumber(value))
        }
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("monthlyWithdrawal")}
        value={formValues.monthlyWithdrawal ?? 0}
        error={errors.monthlyWithdrawal}
        onChange={(value) =>
          updateField("monthlyWithdrawal", toPositiveNumber(value))
        }
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("feeAnnualRate")}
        value={formValues.feeAnnualRatePct ?? 0}
        error={errors.feeAnnualRatePct}
        onChange={(value) =>
          updateField("feeAnnualRatePct", toPositiveNumber(value))
        }
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
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
