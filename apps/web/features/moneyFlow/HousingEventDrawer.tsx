"use client";

import {
  Button,
  Divider,
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import MonthField from "../../components/MonthField";
import type { HousingEvent } from "../../src/domain/scenarioV2/events";
import { isValidMonthKey } from "../../src/utils/monthKey";
import { computeMonthlyPayment } from "../../src/domain/positions/calculations";

type HousingFeeDraft = {
  id: string;
  label: string;
  amount: string;
  month: string;
};

type HousingOngoingCostDraft = {
  id: string;
  label: string;
  amount: string;
  startMonth: string;
  endMonth: string;
};

type HousingRentalDraft = {
  enabled: boolean;
  rentMonthly: string;
  startMonth: string;
  endMonth: string;
  vacancyRatePct: string;
};

export type HousingEventDraft = {
  id?: string;
  label: string;
  kind: HousingEvent["kind"];
  startMonth: string;
  endMonth: string;
  rentMonthly: string;
  rentAnnualGrowthPct: string;
  purchasePrice: string;
  downPaymentMode: "percent" | "amount";
  downPaymentPercent: string;
  downPaymentAmount: string;
  mortgageRatePct: string;
  mortgageTermYears: string;
  mortgagePayment: string;
  mortgagePaymentSource: "estimated" | "manual";
  feesOneOff: HousingFeeDraft[];
  ongoingCosts: HousingOngoingCostDraft[];
  rental: HousingRentalDraft;
  propertyAssetId: string;
  mortgageLiabilityId: string;
  memberId: string;
};

type HousingEventDrawerProps = {
  opened: boolean;
  mode: "create" | "edit";
  baseCurrency: string;
  event: HousingEvent | null;
  initialDraft?: Partial<HousingEventDraft>;
  onClose: () => void;
  onSave: (draft: HousingEventDraft) => void;
};

const applyDraftOverrides = <T,>(draft: T, overrides?: Partial<T>): T => {
  if (!overrides) {
    return draft;
  }
  const definedEntries = Object.entries(overrides).filter(([, value]) => value !== undefined);
  return {
    ...draft,
    ...Object.fromEntries(definedEntries),
  };
};

const buildFeesDraft = (fees?: HousingEvent["feesOneOff"]): HousingFeeDraft[] =>
  (fees ?? []).map((fee) => ({
    id: fee.id,
    label: fee.label ?? "",
    amount: Number.isFinite(fee.amount) ? String(fee.amount) : "",
    month: fee.month ?? "",
  }));

const buildOngoingDraft = (
  costs?: HousingEvent["ongoingCosts"]
): HousingOngoingCostDraft[] =>
  (costs ?? []).map((cost) => ({
    id: cost.id,
    label: cost.label ?? "",
    amount: Number.isFinite(cost.amount) ? String(cost.amount) : "",
    startMonth: cost.startMonth ?? "",
    endMonth: cost.endMonth ?? "",
  }));

const buildRentalDraft = (rental?: HousingEvent["rental"]): HousingRentalDraft => ({
  enabled: rental?.enabled ?? false,
  rentMonthly: Number.isFinite(rental?.rentMonthly)
    ? String(rental?.rentMonthly)
    : "",
  startMonth: rental?.startMonth ?? "",
  endMonth: rental?.endMonth ?? "",
  vacancyRatePct: Number.isFinite(rental?.vacancyRatePct)
    ? String(rental?.vacancyRatePct)
    : "",
});

const buildDraft = (event: HousingEvent | null): HousingEventDraft => {
  if (!event) {
    return {
      id: undefined,
      label: "",
      kind: "rent",
      startMonth: "",
      endMonth: "",
      rentMonthly: "",
      rentAnnualGrowthPct: "",
      purchasePrice: "",
      downPaymentMode: "percent",
      downPaymentPercent: "",
      downPaymentAmount: "",
      mortgageRatePct: "",
      mortgageTermYears: "",
      mortgagePayment: "",
      mortgagePaymentSource: "estimated",
      feesOneOff: [],
      ongoingCosts: [],
      rental: {
        enabled: false,
        rentMonthly: "",
        startMonth: "",
        endMonth: "",
        vacancyRatePct: "",
      },
      propertyAssetId: `asset_housing_${nanoid(8)}`,
      mortgageLiabilityId: `liability_mortgage_${nanoid(8)}`,
      memberId: "",
    };
  }

  return {
    id: event.id,
    label: event.label ?? "",
    kind: event.kind,
    startMonth: event.startMonth ?? "",
    endMonth: event.endMonth ?? "",
    rentMonthly: Number.isFinite(event.rentMonthly) ? String(event.rentMonthly) : "",
    rentAnnualGrowthPct: Number.isFinite(event.rentAnnualGrowthPct)
      ? String(event.rentAnnualGrowthPct)
      : "",
    purchasePrice: Number.isFinite(event.purchasePrice)
      ? String(event.purchasePrice)
      : "",
    downPaymentMode: event.downPaymentMode ?? "percent",
    downPaymentPercent: Number.isFinite(event.downPaymentPercent)
      ? String(event.downPaymentPercent)
      : "",
    downPaymentAmount: Number.isFinite(event.downPaymentAmount)
      ? String(event.downPaymentAmount)
      : "",
    mortgageRatePct: Number.isFinite(event.mortgageRatePct)
      ? String(event.mortgageRatePct)
      : "",
    mortgageTermYears: Number.isFinite(event.mortgageTermYears)
      ? String(event.mortgageTermYears)
      : "",
    mortgagePayment: Number.isFinite(event.mortgagePayment)
      ? String(event.mortgagePayment)
      : "",
    mortgagePaymentSource:
      event.mortgagePaymentIsEstimated === false && Number.isFinite(event.mortgagePayment)
        ? "manual"
        : "estimated",
    feesOneOff: buildFeesDraft(event.feesOneOff),
    ongoingCosts: buildOngoingDraft(event.ongoingCosts),
    rental: buildRentalDraft(event.rental),
    propertyAssetId: event.propertyAssetId ?? `asset_housing_${nanoid(8)}`,
    mortgageLiabilityId: event.mortgageLiabilityId ?? `liability_mortgage_${nanoid(8)}`,
    memberId: event.memberId ?? "",
  };
};

export default function HousingEventDrawer({
  opened,
  mode,
  baseCurrency,
  event,
  initialDraft,
  onClose,
  onSave,
}: HousingEventDrawerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [draft, setDraft] = useState<HousingEventDraft>(() =>
    applyDraftOverrides(buildDraft(event), initialDraft)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!opened) {
      return;
    }
    setDraft(applyDraftOverrides(buildDraft(event), event ? undefined : initialDraft));
    setErrors({});
  }, [event, initialDraft, opened]);

  const purchasePrice = Number(draft.purchasePrice) || 0;
  const downPaymentPercent = Number(draft.downPaymentPercent) || 0;
  const downPaymentAmount = Number(draft.downPaymentAmount) || 0;
  const resolvedDownPayment =
    draft.downPaymentMode === "percent"
      ? (purchasePrice * downPaymentPercent) / 100
      : downPaymentAmount;
  const resolvedDownPaymentPercent =
    purchasePrice > 0 ? (resolvedDownPayment / purchasePrice) * 100 : 0;
  const principal = Math.max(0, purchasePrice - resolvedDownPayment);
  const termMonths = Math.max(0, Math.round(Number(draft.mortgageTermYears) * 12));
  const annualRateDecimal = Number(draft.mortgageRatePct) / 100 || 0;
  const estimatedPayment = computeMonthlyPayment(
    principal,
    annualRateDecimal,
    termMonths
  );
  const roundedEstimatedPayment = Number.isFinite(estimatedPayment)
    ? Math.round(estimatedPayment * 100) / 100
    : 0;
  const isManualPayment = draft.mortgagePaymentSource === "manual";
  const isEditingExistingKind = mode === "edit" && Boolean(event?.id);

  useEffect(() => {
    if (draft.kind !== "mortgage" || draft.mortgagePaymentSource !== "estimated") {
      return;
    }
    if (!Number.isFinite(estimatedPayment) || estimatedPayment <= 0) {
      if (draft.mortgagePayment === "") {
        return;
      }
      setDraft((current) =>
        current.mortgagePaymentSource === "estimated"
          ? { ...current, mortgagePayment: "" }
          : current
      );
      return;
    }
    const nextPayment = String(roundedEstimatedPayment);
    if (draft.mortgagePayment === nextPayment) {
      return;
    }
    setDraft((current) =>
      current.mortgagePaymentSource === "estimated"
        ? { ...current, mortgagePayment: nextPayment }
        : current
    );
  }, [
    draft.kind,
    draft.mortgagePayment,
    draft.mortgagePaymentSource,
    estimatedPayment,
    roundedEstimatedPayment,
  ]);

  const handleFeeChange = (id: string, patch: Partial<HousingFeeDraft>) => {
    setDraft((current) => ({
      ...current,
      feesOneOff: current.feesOneOff.map((fee) =>
        fee.id === id ? { ...fee, ...patch } : fee
      ),
    }));
  };

  const handleCostChange = (
    id: string,
    patch: Partial<HousingOngoingCostDraft>
  ) => {
    setDraft((current) => ({
      ...current,
      ongoingCosts: current.ongoingCosts.map((cost) =>
        cost.id === id ? { ...cost, ...patch } : cost
      ),
    }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!isValidMonthKey(draft.startMonth)) {
      nextErrors.startMonth = t("ledgerEventStartRequired");
    }
    if (draft.endMonth && !isValidMonthKey(draft.endMonth)) {
      nextErrors.endMonth = t("ledgerEventEndInvalid");
    }

    if (draft.kind === "rent") {
      const rentValue = Number(draft.rentMonthly);
      if (!Number.isFinite(rentValue) || rentValue <= 0) {
        nextErrors.rentMonthly = t("ledgerEventAmountRequired");
      }
    } else {
      if (!draft.propertyAssetId) {
        nextErrors.propertyAssetId = t("ledgerEventAmountRequired");
      }
      if (!draft.mortgageLiabilityId) {
        nextErrors.mortgageLiabilityId = t("ledgerEventAmountRequired");
      }
      if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
        nextErrors.purchasePrice = t("ledgerEventAmountRequired");
      }
      if (!Number.isFinite(annualRateDecimal) || annualRateDecimal < 0) {
        nextErrors.mortgageRatePct = t("ledgerEventAmountRequired");
      }
      if (!Number.isFinite(termMonths) || termMonths <= 0) {
        nextErrors.mortgageTermYears = t("ledgerEventAmountRequired");
      }
      if (draft.rental.enabled) {
        const rentValue = Number(draft.rental.rentMonthly);
        if (!Number.isFinite(rentValue) || rentValue <= 0) {
          nextErrors.rentalRent = t("assetRentalAmountRequired");
        }
        if (!isValidMonthKey(draft.rental.startMonth)) {
          nextErrors.rentalStartMonth = t("assetRentalStartMonthRequired");
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }
    const normalizedDraft: HousingEventDraft = {
      ...draft,
      label: draft.label.trim(),
      endMonth: draft.endMonth || "",
      rentAnnualGrowthPct: draft.rentAnnualGrowthPct || "",
      downPaymentPercent:
        draft.downPaymentMode === "percent"
          ? draft.downPaymentPercent
          : String(resolvedDownPaymentPercent),
      downPaymentAmount:
        draft.downPaymentMode === "amount"
          ? draft.downPaymentAmount
          : String(resolvedDownPayment),
      mortgagePayment: draft.mortgagePayment || "",
      feesOneOff: draft.feesOneOff.filter(
        (fee) => fee.label || fee.amount || fee.month
      ),
      ongoingCosts: draft.ongoingCosts.filter(
        (cost) => cost.label || cost.amount || cost.startMonth || cost.endMonth
      ),
      rental: draft.rental.enabled
        ? draft.rental
        : {
            enabled: false,
            rentMonthly: "",
            startMonth: "",
            endMonth: "",
            vacancyRatePct: "",
          },
    };
    onSave(normalizedDraft);
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        mode === "edit"
          ? t("ledgerEventEditTitle")
          : t("ledgerEventCreateTitle")
      }
    >
      <Stack gap="md">
        <TextInput
          label={t("ledgerEventLabel")}
          value={draft.label}
          onChange={(eventValue) =>
            setDraft((current) => ({ ...current, label: eventValue.currentTarget.value }))
          }
        />
        <SegmentedControl
          data={[
            { value: "rent", label: t("housingKindRent") },
            { value: "mortgage", label: t("housingKindMortgage") },
          ]}
          value={draft.kind}
          disabled={isEditingExistingKind}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              kind: value as HousingEvent["kind"],
            }))
          }
        />
        {isEditingExistingKind && (
          <Text size="xs" c="dimmed">
            {t("housingKindLockedHint")}
          </Text>
        )}
        <MonthField
          label={t("ledgerEventStartMonth")}
          value={draft.startMonth}
          error={errors.startMonth}
          onChange={(value) => setDraft((current) => ({ ...current, startMonth: value }))}
        />
        <MonthField
          label={t("ledgerEventEndMonth")}
          value={draft.endMonth}
          error={errors.endMonth}
          onChange={(value) => setDraft((current) => ({ ...current, endMonth: value }))}
        />

        {draft.kind === "rent" ? (
          <>
            <NumberInput
              label={t("ledgerEventAmount", { currency: baseCurrency })}
              value={draft.rentMonthly ? Number(draft.rentMonthly) : ""}
              error={errors.rentMonthly}
              min={0}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  rentMonthly: value === "" ? "" : String(value),
                }))
              }
            />
            <NumberInput
              label={t("housingRentAnnualGrowthLabel")}
              value={draft.rentAnnualGrowthPct ? Number(draft.rentAnnualGrowthPct) : ""}
              min={0}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  rentAnnualGrowthPct: value === "" ? "" : String(value),
                }))
              }
            />
          </>
        ) : (
          <>
            <NumberInput
              label={t("housingPurchasePriceLabel")}
              value={draft.purchasePrice ? Number(draft.purchasePrice) : ""}
              error={errors.purchasePrice}
              min={0}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  purchasePrice: value === "" ? "" : String(value),
                }))
              }
            />
            <SegmentedControl
              data={[
                { value: "percent", label: "%" },
                { value: "amount", label: baseCurrency },
              ]}
              value={draft.downPaymentMode}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  downPaymentMode: value as "percent" | "amount",
                }))
              }
            />
            <Group grow>
              <NumberInput
                label={t("housingDownPaymentLabel")}
                value={
                  draft.downPaymentMode === "percent"
                    ? draft.downPaymentPercent
                      ? Number(draft.downPaymentPercent)
                      : ""
                    : draft.downPaymentAmount
                    ? Number(draft.downPaymentAmount)
                    : ""
                }
                min={0}
                onChange={(value) =>
                  setDraft((current) =>
                    current.downPaymentMode === "percent"
                      ? {
                          ...current,
                          downPaymentPercent: value === "" ? "" : String(value),
                        }
                      : {
                          ...current,
                          downPaymentAmount: value === "" ? "" : String(value),
                        }
                  )
                }
              />
              <NumberInput
                label={t("housingLoanAmountLabel")}
                value={Number.isFinite(principal) ? principal : 0}
                disabled
              />
            </Group>
            <Text size="sm" c="dimmed">
              {t("ledgerEventAmount", { currency: baseCurrency })}:{" "}
              {principal.toFixed(0)}
            </Text>
            <Group grow>
              <NumberInput
                label={t("housingMortgageRateLabel")}
                value={draft.mortgageRatePct ? Number(draft.mortgageRatePct) : ""}
                error={errors.mortgageRatePct}
                min={0}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    mortgageRatePct: value === "" ? "" : String(value),
                  }))
                }
              />
              <NumberInput
                label={t("housingMortgageTermLabel")}
                value={draft.mortgageTermYears ? Number(draft.mortgageTermYears) : ""}
                error={errors.mortgageTermYears}
                min={0}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    mortgageTermYears: value === "" ? "" : String(value),
                  }))
                }
              />
            </Group>
            <NumberInput
              label={t("housingMonthlyPaymentLabel")}
              value={draft.mortgagePayment ? Number(draft.mortgagePayment) : ""}
              min={0}
              disabled={!isManualPayment}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  mortgagePayment: value === "" ? "" : String(value),
                }))
              }
            />
            <Text size="sm" c="dimmed">
              {t("housingEstimatedPaymentLabel", {
                amount: roundedEstimatedPayment.toFixed(2),
              })}
            </Text>
            <Switch
              checked={isManualPayment}
              label={t("housingOverridePaymentToggle")}
              onChange={(eventValue) =>
                setDraft((current) => ({
                  ...current,
                  mortgagePaymentSource: eventValue.currentTarget.checked
                    ? "manual"
                    : "estimated",
                }))
              }
            />

            <Divider label={t("assetPurchaseFeesTitle")} />
            <Stack gap="sm">
              {draft.feesOneOff.map((fee) => (
                <Group key={fee.id} align="flex-end">
                  <TextInput
                    label={t("assetPurchaseFeeLabel")}
                    value={fee.label}
                    onChange={(eventValue) =>
                      handleFeeChange(fee.id, { label: eventValue.currentTarget.value })
                    }
                  />
                  <NumberInput
                    label={t("assetPurchaseFeeAmount")}
                    value={fee.amount ? Number(fee.amount) : ""}
                    min={0}
                    onChange={(value) =>
                      handleFeeChange(fee.id, {
                        amount: value === "" ? "" : String(value),
                      })
                    }
                  />
                  <MonthField
                    label={t("assetPurchaseFeeMonth")}
                    value={fee.month}
                    onChange={(value) => handleFeeChange(fee.id, { month: value })}
                  />
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        feesOneOff: current.feesOneOff.filter((entry) => entry.id !== fee.id),
                      }))
                    }
                  >
                    {common("actionDelete")}
                  </Button>
                </Group>
              ))}
              <Button
                size="xs"
                variant="light"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    feesOneOff: [
                      ...current.feesOneOff,
                      { id: nanoid(), label: "", amount: "", month: draft.startMonth },
                    ],
                  }))
                }
              >
                {t("assetPurchaseFeeAdd")}
              </Button>
            </Stack>

            <Divider label={t("assetOngoingCostsTitle")} />
            <Stack gap="sm">
              {draft.ongoingCosts.map((cost) => (
                <Group key={cost.id} align="flex-end">
                  <TextInput
                    label={t("assetOngoingAmountLabel")}
                    value={cost.label}
                    onChange={(eventValue) =>
                      handleCostChange(cost.id, { label: eventValue.currentTarget.value })
                    }
                  />
                  <NumberInput
                    label={t("assetOngoingAmountLabel")}
                    value={cost.amount ? Number(cost.amount) : ""}
                    min={0}
                    onChange={(value) =>
                      handleCostChange(cost.id, {
                        amount: value === "" ? "" : String(value),
                      })
                    }
                  />
                  <MonthField
                    label={t("assetOngoingStartMonthLabel")}
                    value={cost.startMonth}
                    onChange={(value) => handleCostChange(cost.id, { startMonth: value })}
                  />
                  <MonthField
                    label={t("ledgerEventEndMonth")}
                    value={cost.endMonth}
                    onChange={(value) => handleCostChange(cost.id, { endMonth: value })}
                  />
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        ongoingCosts: current.ongoingCosts.filter((entry) => entry.id !== cost.id),
                      }))
                    }
                  >
                    {common("actionDelete")}
                  </Button>
                </Group>
              ))}
              <Button
                size="xs"
                variant="light"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    ongoingCosts: [
                      ...current.ongoingCosts,
                      {
                        id: nanoid(),
                        label: "",
                        amount: "",
                        startMonth: draft.startMonth,
                        endMonth: "",
                      },
                    ],
                  }))
                }
              >
                {t("housingOngoingCostsAdd")}
              </Button>
            </Stack>

            <Divider label={t("assetRentalTitle")} />
            <Switch
              checked={draft.rental.enabled}
              onChange={(eventValue) =>
                setDraft((current) => ({
                  ...current,
                  rental: {
                    ...current.rental,
                    enabled: eventValue.currentTarget.checked,
                  },
                }))
              }
              label={t("assetRentalToggle")}
            />
            {draft.rental.enabled && (
              <Stack gap="sm">
                <NumberInput
                  label={t("assetRentalAmountLabel")}
                  value={draft.rental.rentMonthly ? Number(draft.rental.rentMonthly) : ""}
                  error={errors.rentalRent}
                  min={0}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      rental: {
                        ...current.rental,
                        rentMonthly: value === "" ? "" : String(value),
                      },
                    }))
                  }
                />
                <MonthField
                  label={t("assetRentalStartMonthLabel")}
                  value={draft.rental.startMonth}
                  error={errors.rentalStartMonth}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      rental: { ...current.rental, startMonth: value },
                    }))
                  }
                />
                <MonthField
                  label={t("assetRentalEndMonthLabel")}
                  value={draft.rental.endMonth}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      rental: { ...current.rental, endMonth: value },
                    }))
                  }
                />
                <NumberInput
                  label={t("housingVacancyRateLabel")}
                  value={
                    draft.rental.vacancyRatePct
                      ? Number(draft.rental.vacancyRatePct)
                      : ""
                  }
                  min={0}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      rental: {
                        ...current.rental,
                        vacancyRatePct: value === "" ? "" : String(value),
                      },
                    }))
                  }
                />
              </Stack>
            )}
          </>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            {common("actionCancel")}
          </Button>
          <Button onClick={handleSave}>
            {common("actionSave")}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
