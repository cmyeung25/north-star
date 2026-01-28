// Shape note: Investment positions include start month, balance, returns, contributions, and fees.
"use client";

import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Title,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import MonthField from "../MonthField";
import { useEntityDraft } from "../../src/hooks/useEntityDraft";
import { normalizeMonthInput } from "../../src/utils/monthKey";
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
  const { draft: formValues, setDraft, errors, validate } = useEntityDraft(
    investment,
    (draft) => {
      const nextErrors: Partial<Record<string, string>> = {};
      const normalizedStart = normalizeMonthInput(draft.startMonth ?? "");
      if (normalizedStart.status !== "valid") {
        nextErrors.startMonth = validation("useYearMonth");
      }

      const parsed = InvestmentPositionSchema.safeParse({
        ...draft,
        startMonth: normalizedStart.month ?? draft.startMonth,
      });
      if (!parsed.success) {
        return {
          isValid: false,
          errors: { ...nextErrors, ...getInvestmentPositionErrors(parsed.error, validation) },
        };
      }

      if (Object.keys(nextErrors).length > 0) {
        return { isValid: false, errors: nextErrors };
      }

      return {
        isValid: true,
        errors: {},
        value: { ...parsed.data, id: draft.id },
      };
    }
  );

  const updateField = <K extends keyof InvestmentPositionDraft>(
    key: K,
    value: InvestmentPositionDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const toPositiveNumber = (value: number | string | null | undefined) =>
    Math.max(0, Number(value ?? 0));

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
