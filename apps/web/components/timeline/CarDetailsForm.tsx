// Shape note: Car positions include purchase details, holding costs, and optional loan info.
"use client";

import {
  Button,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import { normalizeMonthStrict } from "../../src/utils/month";
import type {
  AssetOngoingCost,
  AssetPurchaseFee,
  CarPositionDraft,
} from "../../src/store/scenarioStore";
import {
  CarPositionSchema,
  getCarPositionErrors,
} from "../../src/store/scenarioValidation";

type CarDetailsFormProps = {
  car: CarPositionDraft;
  isSold?: boolean;
  onCancel: () => void;
  onSave: (car: CarPositionDraft) => void;
};

export default function CarDetailsForm({
  car,
  isSold = false,
  onCancel,
  onSave,
}: CarDetailsFormProps) {
  const t = useTranslations("cars");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const [formValues, setFormValues] = useState<CarPositionDraft>(car);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const disableHolding = isSold;
  const defaultStartMonth = formValues.purchaseMonth ?? "";
  const carOngoingCostKeys = ["insurance", "inspection", "maintenance"] as const;

  const resolveOngoingCosts = (existing?: AssetOngoingCost[]) => {
    const lookup = new Map(existing?.map((cost) => [cost.key, cost]));
    return carOngoingCostKeys.map((key) => ({
      key,
      enabled: lookup.get(key)?.enabled ?? false,
      amount: lookup.get(key)?.amount ?? 0,
      startMonth: lookup.get(key)?.startMonth ?? defaultStartMonth,
    }));
  };

  const purchaseFees = formValues.purchaseFees ?? [];
  const ongoingCosts = resolveOngoingCosts(formValues.ongoingCosts);

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

  const addPurchaseFee = () => {
    const nextFee: AssetPurchaseFee = {
      id: `fee_${nanoid(6)}`,
      label: "",
      amount: 0,
      month: defaultStartMonth,
    };
    updateField("purchaseFees", [...purchaseFees, nextFee]);
  };

  const updatePurchaseFee = (id: string, patch: Partial<AssetPurchaseFee>) => {
    updateField(
      "purchaseFees",
      purchaseFees.map((fee) => (fee.id === id ? { ...fee, ...patch } : fee))
    );
  };

  const removePurchaseFee = (id: string) => {
    updateField(
      "purchaseFees",
      purchaseFees.filter((fee) => fee.id !== id)
    );
  };

  const updateOngoingCost = (
    key: AssetOngoingCost["key"],
    patch: Partial<AssetOngoingCost>
  ) => {
    updateField(
      "ongoingCosts",
      resolveOngoingCosts(formValues.ongoingCosts).map((cost) =>
        cost.key === key ? { ...cost, ...patch } : cost
      )
    );
  };

  const handleSave = () => {
    const normalizedMonth = normalizeMonthStrict(formValues.purchaseMonth);
    const sellMonthInput = formValues.sellMonth?.trim() ?? "";
    const normalizedSellMonth = sellMonthInput
      ? normalizeMonthStrict(sellMonthInput)
      : null;

    const nextValues = {
      ...formValues,
      purchaseMonth: normalizedMonth.ok ? normalizedMonth.month : formValues.purchaseMonth,
      sellMonth:
        sellMonthInput === ""
          ? undefined
          : normalizedSellMonth?.ok
            ? normalizedSellMonth.month
            : formValues.sellMonth,
      purchaseFees: purchaseFees.map((fee) => {
        const normalized = normalizeMonthStrict(fee.month);
        return {
          ...fee,
          month: normalized.ok ? normalized.month : fee.month,
        };
      }),
      ongoingCosts: ongoingCosts.map((cost) => {
        const normalized = normalizeMonthStrict(cost.startMonth);
        return {
          ...cost,
          startMonth: normalized.ok ? normalized.month : cost.startMonth,
        };
      }),
    };
    const hasOngoingCosts = nextValues.ongoingCosts.some(
      (cost) => cost.enabled && cost.amount > 0
    );
    if (hasOngoingCosts) {
      nextValues.holdingCostMonthly = 0;
      nextValues.holdingCostAnnualGrowthPct = 0;
    }

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
        disabled={disableHolding}
        onChange={(event) => updateField("purchaseMonth", event.target.value)}
      />
      <NumberInput
        label={t("purchasePrice")}
        value={formValues.purchasePrice ?? 0}
        error={errors.purchasePrice}
        disabled={disableHolding}
        onChange={(value) => updateField("purchasePrice", toPositiveNumber(value))}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("downPayment")}
        value={formValues.downPayment ?? 0}
        error={errors.downPayment}
        disabled={disableHolding}
        onChange={(value) => updateField("downPayment", toPositiveNumber(value))}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("annualDepreciationRate")}
        value={formValues.annualDepreciationRatePct ?? 0}
        error={errors.annualDepreciationRatePct}
        disabled={disableHolding}
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
        disabled={disableHolding}
        onChange={(value) => updateField("holdingCostMonthly", toPositiveNumber(value))}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("holdingCostGrowth")}
        value={formValues.holdingCostAnnualGrowthPct ?? 0}
        error={errors.holdingCostAnnualGrowthPct}
        disabled={disableHolding}
        onChange={(value) =>
          updateField("holdingCostAnnualGrowthPct", toPositiveNumber(value))
        }
        min={0}
        max={100}
        decimalScale={2}
        suffix="%"
      />
      <Stack gap="xs">
        <Title order={6}>{t("purchaseFeesTitle")}</Title>
        {purchaseFees.length === 0 ? (
          <Text size="xs" c="dimmed">
            {t("purchaseFeesEmpty")}
          </Text>
        ) : (
          <Stack gap="xs">
            {purchaseFees.map((fee) => (
              <Stack key={fee.id} gap="xs">
                <Group align="flex-start" grow>
                  <TextInput
                    label={t("purchaseFeeLabel")}
                    value={fee.label}
                    disabled={disableHolding}
                    onChange={(event) =>
                      updatePurchaseFee(fee.id, { label: event.target.value })
                    }
                  />
                  <NumberInput
                    label={t("purchaseFeeAmount")}
                    value={fee.amount}
                    disabled={disableHolding}
                    onChange={(value) =>
                      updatePurchaseFee(fee.id, {
                        amount: toPositiveNumber(value),
                      })
                    }
                    thousandSeparator=","
                    min={0}
                  />
                  <TextInput
                    label={t("purchaseFeeMonth")}
                    placeholder={common("yearMonthPlaceholder")}
                    value={fee.month}
                    disabled={disableHolding}
                    onChange={(event) =>
                      updatePurchaseFee(fee.id, { month: event.target.value })
                    }
                  />
                </Group>
                <Group justify="flex-end">
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    disabled={disableHolding}
                    onClick={() => removePurchaseFee(fee.id)}
                  >
                    {common("actionRemove")}
                  </Button>
                </Group>
              </Stack>
            ))}
          </Stack>
        )}
        <Button size="xs" variant="light" onClick={addPurchaseFee} disabled={disableHolding}>
          {t("purchaseFeeAdd")}
        </Button>
      </Stack>
      <Stack gap="xs">
        <Title order={6}>{t("ongoingCostsTitle")}</Title>
        <Stack gap="sm">
          {ongoingCosts.map((cost) => (
            <Stack key={cost.key} gap="xs">
              <Switch
                label={t(`ongoingCosts.${cost.key}`)}
                checked={cost.enabled}
                disabled={disableHolding}
                onChange={(event) =>
                  updateOngoingCost(cost.key, {
                    enabled: event.currentTarget.checked,
                  })
                }
              />
              {cost.enabled && (
                <Group grow>
                  <NumberInput
                    label={t("ongoingCostAmount")}
                    value={cost.amount}
                    disabled={disableHolding}
                    onChange={(value) =>
                      updateOngoingCost(cost.key, {
                        amount: toPositiveNumber(value),
                      })
                    }
                    thousandSeparator=","
                    min={0}
                  />
                  <TextInput
                    label={t("ongoingCostStartMonth")}
                    placeholder={common("yearMonthPlaceholder")}
                    value={cost.startMonth}
                    disabled={disableHolding}
                    onChange={(event) =>
                      updateOngoingCost(cost.key, {
                        startMonth: event.target.value,
                      })
                    }
                  />
                </Group>
              )}
            </Stack>
          ))}
        </Stack>
      </Stack>
      <Switch
        label={t("loanEnabled")}
        checked={Boolean(formValues.loan)}
        disabled={disableHolding}
        onChange={(event) => handleLoanToggle(event.currentTarget.checked)}
      />
      {formValues.loan && (
        <>
          <NumberInput
            label={t("loanPrincipal")}
            value={formValues.loan.principal ?? 0}
            error={errors["loan.principal"] ?? errors.loan}
            disabled={disableHolding}
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
            disabled={disableHolding}
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
            disabled={disableHolding}
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
            disabled={disableHolding}
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
      <Title order={6}>{t("sellSectionTitle")}</Title>
      <TextInput
        label={t("sellMonth")}
        placeholder={common("yearMonthOptionalPlaceholder")}
        value={formValues.sellMonth ?? ""}
        error={errors.sellMonth}
        onChange={(event) => updateField("sellMonth", event.target.value || undefined)}
      />
      <NumberInput
        label={t("sellPriceOverride")}
        value={formValues.sellPriceOverride ?? ""}
        error={errors.sellPriceOverride}
        onChange={(value) => {
          if (value === "" || value === null || Number.isNaN(Number(value))) {
            updateField("sellPriceOverride", undefined);
          } else {
            updateField("sellPriceOverride", toPositiveNumber(value));
          }
        }}
        thousandSeparator=","
        min={0}
      />
      <NumberInput
        label={t("sellFeesOneTime")}
        value={formValues.sellFeesOneTime ?? ""}
        error={errors.sellFeesOneTime}
        onChange={(value) => {
          if (value === "" || value === null || Number.isNaN(Number(value))) {
            updateField("sellFeesOneTime", undefined);
          } else {
            updateField("sellFeesOneTime", toPositiveNumber(value));
          }
        }}
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
