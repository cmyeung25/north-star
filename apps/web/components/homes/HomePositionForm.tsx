"use client";

import { Group, NumberInput, Text, TextInput, Tooltip } from "@mantine/core";
import { useDownPaymentSync } from "./useDownPaymentSync";
import type { HomePositionDraft } from "../../src/store/scenarioStore";

type HomePositionFormVariant = "onboarding" | "detailed";

type HomePositionFormProps = {
  value: HomePositionDraft;
  onChange: (patch: Partial<HomePositionDraft>) => void;
  errors?: Partial<Record<string, string>>;
  disabled?: boolean;
  variant?: HomePositionFormVariant;
  showPurchaseFields?: boolean;
  showMortgageFields?: boolean;
  showFeesOneTime?: boolean;
  showAnnualAppreciation?: boolean;
  showHoldingCostFields?: boolean;
  showHoldingCostGrowth?: boolean;
  showPurchaseHint?: boolean;
  monthPlaceholder?: string;
  t: (key: string) => string;
};

const toPositiveNumber = (value: number | string | null | undefined) =>
  Math.max(0, Number(value ?? 0));

export default function HomePositionForm({
  value,
  onChange,
  errors = {},
  disabled = false,
  variant = "detailed",
  showPurchaseFields = true,
  showMortgageFields = true,
  showFeesOneTime,
  showAnnualAppreciation,
  showHoldingCostFields = false,
  showHoldingCostGrowth,
  showPurchaseHint = true,
  monthPlaceholder = "YYYY-MM",
  t,
}: HomePositionFormProps) {
  const resolvedShowFeesOneTime = showFeesOneTime ?? variant === "detailed";
  const resolvedShowAnnualAppreciation = showAnnualAppreciation ?? false;
  const resolvedShowHoldingCostGrowth =
    showHoldingCostGrowth ?? (showHoldingCostFields && variant === "detailed");
  const {
    downPaymentPct,
    handlePurchasePriceChange,
    handleDownPaymentAmountChange,
    handleDownPaymentPctChange,
  } = useDownPaymentSync({
    purchasePrice: value.purchasePrice,
    downPayment: value.downPayment,
    onChange: (patch) => onChange(patch),
  });

  return (
    <>
      {showPurchaseFields && showPurchaseHint && (
        <Text size="xs" c="dimmed">
          {t("purchaseHint")}
        </Text>
      )}
      {showPurchaseFields && (
        <>
          <TextInput
            label={t("purchaseMonth")}
            placeholder={monthPlaceholder}
            value={value.purchaseMonth ?? ""}
            error={errors.purchaseMonth}
            disabled={disabled}
            onChange={(event) => onChange({ purchaseMonth: event.target.value })}
          />
          <NumberInput
            label={t("purchasePrice")}
            value={value.purchasePrice ?? 0}
            error={errors.purchasePrice}
            disabled={disabled}
            onChange={handlePurchasePriceChange}
            thousandSeparator=","
            min={0}
          />
          <Group grow>
            <NumberInput
              label={t("downPayment")}
              value={value.downPayment ?? 0}
              error={errors.downPayment}
              disabled={disabled}
              onChange={handleDownPaymentAmountChange}
              thousandSeparator=","
              min={0}
            />
            <NumberInput
              label={t("downPaymentPct")}
              value={downPaymentPct}
              disabled={disabled}
              onChange={handleDownPaymentPctChange}
              min={0}
              max={100}
              decimalScale={2}
              suffix="%"
            />
          </Group>
        </>
      )}
      {showMortgageFields && (
        <>
          <NumberInput
            label={t("mortgageRate")}
            value={value.mortgageRatePct ?? 0}
            error={errors.mortgageRatePct}
            disabled={disabled}
            onChange={(nextValue) =>
              onChange({ mortgageRatePct: toPositiveNumber(nextValue) })
            }
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
          />
          <NumberInput
            label={t("mortgageTerm")}
            value={value.mortgageTermYears ?? 0}
            error={errors.mortgageTermYears}
            disabled={disabled}
            onChange={(nextValue) =>
              onChange({ mortgageTermYears: Math.max(0, Number(nextValue ?? 0)) })
            }
            min={1}
            max={50}
          />
        </>
      )}
      {resolvedShowFeesOneTime && (
        <NumberInput
          label={t("feesOneTime")}
          value={value.feesOneTime ?? 0}
          error={errors.feesOneTime}
          disabled={disabled}
          onChange={(nextValue) =>
            onChange({ feesOneTime: toPositiveNumber(nextValue) })
          }
          thousandSeparator=","
          min={0}
        />
      )}
      {resolvedShowAnnualAppreciation && (
        <NumberInput
          label={t("annualAppreciation")}
          value={value.annualAppreciationPct}
          error={errors.annualAppreciationPct}
          disabled={disabled}
          onChange={(nextValue) =>
            onChange({
              annualAppreciationPct: Math.min(
                Math.max(Number(nextValue ?? 0), -100),
                100
              ),
            })
          }
          min={-100}
          max={100}
          decimalScale={2}
          suffix="%"
        />
      )}
      {showHoldingCostFields && (
        <NumberInput
          label={
            <Group gap={4}>
              <Text size="sm">{t("holdingCostMonthly")}</Text>
              <Tooltip label={t("holdingCostTooltip")} withArrow>
                <Text size="sm" c="dimmed" span>
                  ⓘ
                </Text>
              </Tooltip>
            </Group>
          }
          value={value.holdingCostMonthly ?? 0}
          error={errors.holdingCostMonthly}
          disabled={disabled}
          onChange={(nextValue) =>
            onChange({ holdingCostMonthly: toPositiveNumber(nextValue) })
          }
          thousandSeparator=","
          min={0}
        />
      )}
      {resolvedShowHoldingCostGrowth && (
        <NumberInput
          label={t("holdingCostGrowth")}
          value={value.holdingCostAnnualGrowthPct ?? 0}
          error={errors.holdingCostAnnualGrowthPct}
          disabled={disabled}
          onChange={(nextValue) =>
            onChange({ holdingCostAnnualGrowthPct: toPositiveNumber(nextValue) })
          }
          min={0}
          max={100}
          decimalScale={2}
          suffix="%"
        />
      )}
    </>
  );
}
