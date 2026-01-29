// Shape note: Home details originally captured price/downPayment/mortgage/appreciation (+feesOneTime).
// Added fields: holdingCostMonthly and holdingCostAnnualGrowthPct (percent in UI).
// Back-compat: missing fields default to 0 and do not break saved scenarios.
"use client";

import {
  Button,
  Group,
  NumberInput,
  Select,
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
  HomePositionDraft,
  RentalDetails,
} from "../../src/store/scenarioStore";
import {
  HomePositionSchema,
  getHomePositionErrors,
} from "../../src/store/scenarioValidation";
import HomePositionForm from "../homes/HomePositionForm";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../../src/domain/constants";

type HomeDetailsFormProps = {
  home: HomePositionDraft;
  isSold?: boolean;
  onCancel: () => void;
  onSave: (home: HomePositionDraft) => void;
};

export default function HomeDetailsForm({
  home,
  isSold = false,
  onCancel,
  onSave,
}: HomeDetailsFormProps) {
  const t = useTranslations("homes");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const [formValues, setFormValues] = useState<HomePositionDraft>(home);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

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

  const toPositiveNumber = (value: number | string | null | undefined) =>
    Math.max(0, Number(value ?? 0));

  const usageValue = formValues.usage ?? "primary";
  const modeValue = formValues.mode ?? "new_purchase";
  const disableHolding = isSold;
  const defaultStartMonth =
    formValues.purchaseMonth ?? formValues.existing?.asOfMonth ?? "";
  const homeOngoingCostKeys = [
    "managementFee",
    "groundRent",
    "insurance",
    "maintenance",
  ] as const;

  const resolveOngoingCosts = (existing?: AssetOngoingCost[]) => {
    const lookup = new Map(existing?.map((cost) => [cost.key, cost]));
    return homeOngoingCostKeys.map((key) => ({
      key,
      enabled: lookup.get(key)?.enabled ?? false,
      amount: lookup.get(key)?.amount ?? 0,
      startMonth: lookup.get(key)?.startMonth ?? defaultStartMonth,
    }));
  };

  const purchaseFees = formValues.purchaseFees ?? [];
  const ongoingCosts = resolveOngoingCosts(formValues.ongoingCosts);

  const handleModeChange = (value: string | null) => {
    if (!value) {
      return;
    }

    const nextMode = value as HomePositionDraft["mode"];
    setFormValues((current) => ({
      ...current,
      mode: nextMode,
      existing:
        nextMode === "existing"
          ? current.existing ?? {
              asOfMonth: current.purchaseMonth ?? "",
              marketValue: current.purchasePrice ?? 0,
              mortgageBalance: 0,
              remainingTermMonths: Math.max(
                1,
                Math.round((current.mortgageTermYears ?? 30) * 12)
              ),
              annualRatePct: current.mortgageRatePct ?? 0,
            }
          : current.existing,
    }));
  };

  const handleRentalToggle = (checked: boolean) => {
    setFormValues((current) => ({
      ...current,
      rental: checked
        ? current.rental ?? {
            rentMonthly: 0,
            rentStartMonth:
              current.purchaseMonth ?? current.existing?.asOfMonth ?? "",
            rentEndMonth: null,
            rentAnnualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
            vacancyRatePct: 0,
          }
        : undefined,
    }));
  };

  const updateRental = (patch: Partial<RentalDetails>) => {
    const current = formValues.rental ?? {
      rentMonthly: 0,
      rentStartMonth: "",
      rentEndMonth: null,
      rentAnnualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
      vacancyRatePct: 0,
    };

    updateField("rental", {
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
    const normalizedMonth = formValues.purchaseMonth
      ? normalizeMonthStrict(formValues.purchaseMonth)
      : null;
    const sellMonthInput = formValues.sellMonth?.trim() ?? "";
    const normalizedSellMonth = sellMonthInput
      ? normalizeMonthStrict(sellMonthInput)
      : null;
    const normalizedExistingMonth = formValues.existing?.asOfMonth
      ? normalizeMonthStrict(formValues.existing.asOfMonth)
      : null;
    const normalizedRentStart = formValues.rental?.rentStartMonth
      ? normalizeMonthStrict(formValues.rental.rentStartMonth)
      : null;
    const normalizedRentEnd = formValues.rental?.rentEndMonth
      ? normalizeMonthStrict(formValues.rental.rentEndMonth)
      : null;
    const normalizedFees = purchaseFees.map((fee) => {
      const normalizedMonth = normalizeMonthStrict(fee.month);
      return {
        ...fee,
        month: normalizedMonth.ok ? normalizedMonth.month : fee.month,
      };
    });
    const normalizedOngoingCosts = ongoingCosts.map((cost) => {
      const normalizedMonth = normalizeMonthStrict(cost.startMonth);
      return {
        ...cost,
        startMonth: normalizedMonth.ok ? normalizedMonth.month : cost.startMonth,
      };
    });
    const hasPurchaseFees = normalizedFees.some((fee) => fee.amount > 0);
    const hasOngoingCosts = normalizedOngoingCosts.some(
      (cost) => cost.enabled && cost.amount > 0
    );

    const nextValues = {
      ...formValues,
      purchaseMonth: normalizedMonth?.ok
        ? normalizedMonth.month
        : formValues.purchaseMonth,
      sellMonth:
        sellMonthInput === ""
          ? undefined
          : normalizedSellMonth?.ok
            ? normalizedSellMonth.month
            : formValues.sellMonth,
      existing: formValues.existing
        ? {
            ...formValues.existing,
            asOfMonth: normalizedExistingMonth?.ok
              ? normalizedExistingMonth.month
              : formValues.existing.asOfMonth,
          }
        : undefined,
      rental: formValues.rental
        ? {
            ...formValues.rental,
            rentStartMonth: normalizedRentStart?.ok
              ? normalizedRentStart.month
              : formValues.rental.rentStartMonth,
            rentEndMonth: normalizedRentEnd?.ok
              ? normalizedRentEnd.month
              : formValues.rental.rentEndMonth ?? null,
          }
        : undefined,
      purchaseFees: normalizedFees,
      ongoingCosts: normalizedOngoingCosts,
      feesOneTime: hasPurchaseFees ? 0 : formValues.feesOneTime,
      holdingCostMonthly: hasOngoingCosts ? 0 : formValues.holdingCostMonthly,
      holdingCostAnnualGrowthPct: hasOngoingCosts
        ? 0
        : formValues.holdingCostAnnualGrowthPct,
    };

    const parsed = HomePositionSchema.safeParse(nextValues);
    if (!parsed.success) {
      setErrors(getHomePositionErrors(parsed.error, (key) => validation(key)));
      return;
    }

    onSave({ ...parsed.data, id: formValues.id });
  };

  return (
    <Stack gap="md">
      <Title order={5}>{t("title")}</Title>
      <TextInput
        label={t("name")}
        placeholder={t("namePlaceholder")}
        value={formValues.name ?? ""}
        onChange={(event) => updateField("name", event.currentTarget.value)}
      />
      <Select
        label={t("usageLabel")}
        value={usageValue}
        disabled={disableHolding}
        onChange={(value) =>
          updateField("usage", (value ?? "primary") as HomePositionDraft["usage"])
        }
        data={[
          { value: "primary", label: t("usagePrimary") },
          { value: "investment", label: t("usageInvestment") },
        ]}
      />
      <Select
        label={t("modeLabel")}
        value={modeValue}
        disabled={disableHolding}
        onChange={handleModeChange}
        data={[
          { value: "new_purchase", label: t("modeNewPurchase") },
          { value: "existing", label: t("modeExisting") },
        ]}
      />
      {modeValue === "existing" ? (
        <>
          <TextInput
            label={t("existingAsOfMonth")}
            placeholder={common("yearMonthPlaceholder")}
            value={formValues.existing?.asOfMonth ?? ""}
            error={errors["existing.asOfMonth"] ?? errors.existing}
            disabled={disableHolding}
            onChange={(event) =>
              updateField("existing", {
                ...(formValues.existing ?? {
                  asOfMonth: "",
                  marketValue: 0,
                  mortgageBalance: 0,
                  remainingTermMonths: 0,
                  annualRatePct: 0,
                }),
                asOfMonth: event.target.value,
              })
            }
          />
          <NumberInput
            label={t("existingMarketValue")}
            value={formValues.existing?.marketValue ?? 0}
            error={errors["existing.marketValue"] ?? errors.existing}
            disabled={disableHolding}
            onChange={(value) =>
              updateField("existing", {
                ...(formValues.existing ?? {
                  asOfMonth: "",
                  marketValue: 0,
                  mortgageBalance: 0,
                  remainingTermMonths: 0,
                  annualRatePct: 0,
                }),
                marketValue: toPositiveNumber(value),
              })
            }
            thousandSeparator=","
            min={0}
          />
          <NumberInput
            label={t("existingMortgageBalance")}
            value={formValues.existing?.mortgageBalance ?? 0}
            error={errors["existing.mortgageBalance"] ?? errors.existing}
            disabled={disableHolding}
            onChange={(value) =>
              updateField("existing", {
                ...(formValues.existing ?? {
                  asOfMonth: "",
                  marketValue: 0,
                  mortgageBalance: 0,
                  remainingTermMonths: 0,
                  annualRatePct: 0,
                }),
                mortgageBalance: toPositiveNumber(value),
              })
            }
            thousandSeparator=","
            min={0}
          />
          <NumberInput
            label={t("existingRemainingTerm")}
            value={formValues.existing?.remainingTermMonths ?? 0}
            error={errors["existing.remainingTermMonths"] ?? errors.existing}
            disabled={disableHolding}
            onChange={(value) =>
              updateField("existing", {
                ...(formValues.existing ?? {
                  asOfMonth: "",
                  marketValue: 0,
                  mortgageBalance: 0,
                  remainingTermMonths: 0,
                  annualRatePct: 0,
                }),
                remainingTermMonths: Math.max(1, Math.round(Number(value ?? 0))),
              })
            }
            min={1}
            max={600}
          />
          <NumberInput
            label={t("existingMortgageRate")}
            value={formValues.existing?.annualRatePct ?? 0}
            error={errors["existing.annualRatePct"] ?? errors.existing}
            disabled={disableHolding}
            onChange={(value) =>
              updateField("existing", {
                ...(formValues.existing ?? {
                  asOfMonth: "",
                  marketValue: 0,
                  mortgageBalance: 0,
                  remainingTermMonths: 0,
                  annualRatePct: 0,
                }),
                annualRatePct: toPositiveNumber(value),
              })
            }
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
          />
        </>
      ) : (
        <HomePositionForm
          value={formValues}
          onChange={(patch) =>
            setFormValues((current) => ({ ...current, ...patch }))
          }
          errors={errors}
          disabled={disableHolding}
          showFeesOneTime={false}
          monthPlaceholder={common("yearMonthPlaceholder")}
          t={t}
        />
      )}
      <HomePositionForm
        value={formValues}
        onChange={(patch) =>
          setFormValues((current) => ({ ...current, ...patch }))
        }
        errors={errors}
        disabled={disableHolding}
        showPurchaseFields={false}
        showMortgageFields={false}
        showAnnualAppreciation
        showHoldingCostFields={false}
        showHoldingCostGrowth={false}
        t={t}
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
        label={t("rentalEnabled")}
        checked={Boolean(formValues.rental)}
        disabled={disableHolding}
        onChange={(event) => handleRentalToggle(event.currentTarget.checked)}
      />
      {formValues.rental && (
        <>
          <NumberInput
            label={t("rentalMonthly")}
            value={formValues.rental.rentMonthly ?? 0}
            error={errors["rental.rentMonthly"] ?? errors.rental}
            disabled={disableHolding}
            onChange={(value) =>
              updateRental({
                rentMonthly: toPositiveNumber(value),
              })
            }
            thousandSeparator=","
            min={0}
          />
          <TextInput
            label={t("rentalStart")}
            placeholder={common("yearMonthPlaceholder")}
            value={formValues.rental.rentStartMonth ?? ""}
            error={errors["rental.rentStartMonth"] ?? errors.rental}
            disabled={disableHolding}
            onChange={(event) =>
              updateRental({
                rentStartMonth: event.target.value,
              })
            }
          />
          <TextInput
            label={t("rentalEnd")}
            placeholder={common("yearMonthOptionalPlaceholder")}
            value={formValues.rental.rentEndMonth ?? ""}
            error={errors["rental.rentEndMonth"] ?? errors.rental}
            disabled={disableHolding}
            onChange={(event) =>
              updateRental({
                rentEndMonth: event.target.value || null,
              })
            }
          />
          <NumberInput
            label={t("rentalGrowth")}
            value={formValues.rental.rentAnnualGrowthPct ?? 0}
            error={errors["rental.rentAnnualGrowthPct"] ?? errors.rental}
            disabled={disableHolding}
            onChange={(value) =>
              updateRental({
                rentAnnualGrowthPct: toPositiveNumber(value),
              })
            }
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
          />
          <NumberInput
            label={t("rentalVacancy")}
            value={formValues.rental.vacancyRatePct ?? 0}
            error={errors["rental.vacancyRatePct"] ?? errors.rental}
            disabled={disableHolding}
            onChange={(value) =>
              updateRental({
                vacancyRatePct: toPositiveNumber(value),
              })
            }
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
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
