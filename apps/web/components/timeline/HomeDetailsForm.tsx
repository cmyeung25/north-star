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
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { normalizeMonth } from "../../src/features/timeline/schema";
import type { HomePositionDraft, RentalDetails } from "../../src/store/scenarioStore";
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
            rentAnnualGrowthPct: 0,
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
      rentAnnualGrowthPct: 0,
      vacancyRatePct: 0,
    };

    updateField("rental", {
      ...current,
      ...patch,
    });
  };

  const handleSave = () => {
    const normalizedMonth = formValues.purchaseMonth
      ? normalizeMonth(formValues.purchaseMonth)
      : null;
    const normalizedExistingMonth = formValues.existing?.asOfMonth
      ? normalizeMonth(formValues.existing.asOfMonth)
      : null;
    const normalizedRentStart = formValues.rental?.rentStartMonth
      ? normalizeMonth(formValues.rental.rentStartMonth)
      : null;
    const normalizedRentEnd = formValues.rental?.rentEndMonth
      ? normalizeMonth(formValues.rental.rentEndMonth)
      : null;

    const nextValues = {
      ...formValues,
      purchaseMonth: normalizedMonth ?? formValues.purchaseMonth,
      existing: formValues.existing
        ? {
            ...formValues.existing,
            asOfMonth: normalizedExistingMonth ?? formValues.existing.asOfMonth,
          }
        : undefined,
      rental: formValues.rental
        ? {
            ...formValues.rental,
            rentStartMonth: normalizedRentStart ?? formValues.rental.rentStartMonth,
            rentEndMonth: normalizedRentEnd ?? formValues.rental.rentEndMonth ?? null,
          }
        : undefined,
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
      <Select
        label={t("usageLabel")}
        value={usageValue}
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
        <>
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
            onChange={(value) =>
              updateField("purchasePrice", toPositiveNumber(value))
            }
            thousandSeparator=","
            min={0}
          />
          <NumberInput
            label={t("downPayment")}
            value={formValues.downPayment ?? 0}
            error={errors.downPayment}
            onChange={(value) =>
              updateField("downPayment", toPositiveNumber(value))
            }
            thousandSeparator=","
            min={0}
          />
          <NumberInput
            label={t("mortgageRate")}
            value={formValues.mortgageRatePct ?? 0}
            error={errors.mortgageRatePct}
            onChange={(value) =>
              updateField("mortgageRatePct", toPositiveNumber(value))
            }
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
          />
          <NumberInput
            label={t("mortgageTerm")}
            value={formValues.mortgageTermYears ?? 0}
            error={errors.mortgageTermYears}
            onChange={(value) =>
              updateField("mortgageTermYears", Math.max(0, Number(value ?? 0)))
            }
            min={1}
            max={50}
          />
          <NumberInput
            label={t("feesOneTime")}
            value={formValues.feesOneTime ?? 0}
            error={errors.feesOneTime}
            onChange={(value) => updateField("feesOneTime", toPositiveNumber(value))}
            thousandSeparator=","
            min={0}
          />
        </>
      )}
      <NumberInput
        label={t("annualAppreciation")}
        value={formValues.annualAppreciationPct}
        error={errors.annualAppreciationPct}
        onChange={(value) =>
          updateField(
            "annualAppreciationPct",
            Math.min(Math.max(Number(value ?? 0), -100), 100)
          )
        }
        min={-100}
        max={100}
        decimalScale={2}
        suffix="%"
      />
      <NumberInput
        label={t("holdingCostMonthly")}
        value={formValues.holdingCostMonthly ?? 0}
        error={errors.holdingCostMonthly}
        onChange={(value) =>
          updateField("holdingCostMonthly", toPositiveNumber(value))
        }
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
        label={t("rentalEnabled")}
        checked={Boolean(formValues.rental)}
        onChange={(event) => handleRentalToggle(event.currentTarget.checked)}
      />
      {formValues.rental && (
        <>
          <NumberInput
            label={t("rentalMonthly")}
            value={formValues.rental.rentMonthly ?? 0}
            error={errors["rental.rentMonthly"] ?? errors.rental}
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
            onChange={(event) =>
              updateRental({
                rentStartMonth: event.target.value,
              })
            }
          />
          <TextInput
            label={t("rentalEnd")}
            placeholder={common("yearMonthPlaceholder")}
            value={formValues.rental.rentEndMonth ?? ""}
            error={errors["rental.rentEndMonth"] ?? errors.rental}
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
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          {common("actionCancel")}
        </Button>
        <Button onClick={handleSave}>{common("actionSave")}</Button>
      </Group>
    </Stack>
  );
}
