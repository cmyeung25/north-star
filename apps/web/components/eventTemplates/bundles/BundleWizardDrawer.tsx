"use client";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Divider,
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Stepper,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../../../lib/i18n";
import { normalizeMonthStrict } from "../../../src/utils/month";
import { isValidMonthKey } from "../../../src/utils/monthKey";
import type { ScenarioEventDraft } from "../../../src/domain/scenarioV2/events";
import type { TemplateDef } from "../../../src/domain/eventTemplates/types";
import MonthField from "../../MonthField";
import {
  buildHomePurchaseBundleEvent,
  buildNewBabyBundleEvents,
  type HomePurchaseBundleInput,
  type NewBabyPlanInput,
} from "../../../src/domain/eventTemplates/bundles";
import { useScenarioStore } from "../../../src/store/scenarioStore";

type BundleWizardDrawerProps = {
  opened: boolean;
  template: TemplateDef | null;
  scenarioId?: string | null;
  baseMonth?: string | null;
  baseCurrency: string;
  scenarioEvents: ScenarioEventDraft[];
  onClose: () => void;
  onOpenEventDrawer?: (type: ScenarioEventDraft["type"], eventId: string) => void;
  onApplyEvents?: (
    events: ScenarioEventDraft[],
    options?: { packAsExperiment?: boolean; experimentTitle?: string }
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  allowInlineEdit?: boolean;
};

type FeeDraft = {
  id: string;
  label: string;
  amount: number;
  month: string;
};

type OngoingCostDraft = {
  id: string;
  label: string;
  amount: number;
  startMonth: string;
  endMonth: string;
};

type NewBabyDraft = {
  birthMonth: string;
  deliveryCost: number;
  childcareMonthly: number;
  helperEnabled: boolean;
  helperMonthly: number;
  agencyFee: number;
  schoolingEnabled: boolean;
  schoolingAmount: number;
  schoolingCadence: "monthly" | "yearly";
  schoolingStartMonth: string;
};

type HomePurchaseDraft = {
  startMonth: string;
  purchasePrice: number;
  downPaymentMode: "percent" | "amount";
  downPaymentPercent: number;
  downPaymentAmount: number;
  mortgageRatePct: number;
  termMode: "years" | "months";
  mortgageTermYears: number;
  mortgageTermMonths: number;
  mortgagePayment: number;
  mortgagePaymentIsEstimated: boolean;
  feesOneOff: FeeDraft[];
  ongoingCosts: OngoingCostDraft[];
  rentalEnabled: boolean;
  rentalMonthly: number;
  rentalDiscountMonthly: number;
  rentalStartMonth: string;
  rentalEndMonth: string;
  propertyAssetId: string;
  mortgageLiabilityId: string;
  eventId: string;
};

const createFeeDraft = (): FeeDraft => ({
  id: `fee_${nanoid(6)}`,
  label: "",
  amount: 0,
  month: "",
});

const createOngoingCostDraft = (): OngoingCostDraft => ({
  id: `cost_${nanoid(6)}`,
  label: "",
  amount: 0,
  startMonth: "",
  endMonth: "",
});

const estimateMonthlyPayment = ({
  principal,
  annualRatePct,
  termMonths,
}: {
  principal: number;
  annualRatePct: number;
  termMonths: number;
}) => {
  if (!Number.isFinite(principal) || principal <= 0) {
    return null;
  }
  if (!Number.isFinite(termMonths) || termMonths <= 0) {
    return null;
  }
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0) {
    return null;
  }
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) {
    return principal / termMonths;
  }
  const denominator = 1 - Math.pow(1 + monthlyRate, -termMonths);
  if (!Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return (principal * monthlyRate) / denominator;
};

const normalizeMonthValue = (value: string) => {
  const normalized = normalizeMonthStrict(value);
  if (normalized.ok) {
    return { value: normalized.month, error: undefined };
  }
  if (value.trim() === "") {
    return { value, error: "empty" };
  }
  return { value, error: "invalid" };
};

const normalizeAmount = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export default function BundleWizardDrawer({
  opened,
  template,
  scenarioId,
  baseMonth,
  baseCurrency,
  scenarioEvents,
  onClose,
  onOpenEventDrawer,
  onApplyEvents,
  allowInlineEdit = true,
}: BundleWizardDrawerProps) {
  const t = useTranslations("money");
  const validation = useTranslations("validation");
  const locale = useLocale();
  const addEvent = useScenarioStore((state) => state.addEvent);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [previewEvents, setPreviewEvents] = useState<ScenarioEventDraft[]>([]);
  const [createdEventIds, setCreatedEventIds] = useState<Set<string>>(
    () => new Set()
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [packAsExperiment, setPackAsExperiment] = useState(true);

  const defaultMonth = baseMonth && isValidMonthKey(baseMonth) ? baseMonth : "";

  const [newBabyDraft, setNewBabyDraft] = useState<NewBabyDraft>({
    birthMonth: defaultMonth,
    deliveryCost: 0,
    childcareMonthly: 0,
    helperEnabled: false,
    helperMonthly: 0,
    agencyFee: 0,
    schoolingEnabled: false,
    schoolingAmount: 0,
    schoolingCadence: "monthly",
    schoolingStartMonth: defaultMonth,
  });

  const [homeDraft, setHomeDraft] = useState<HomePurchaseDraft>({
    startMonth: defaultMonth,
    purchasePrice: 0,
    downPaymentMode: "percent",
    downPaymentPercent: 20,
    downPaymentAmount: 0,
    mortgageRatePct: 4,
    termMode: "years",
    mortgageTermYears: 30,
    mortgageTermMonths: 360,
    mortgagePayment: 0,
    mortgagePaymentIsEstimated: true,
    feesOneOff: [],
    ongoingCosts: [],
    rentalEnabled: false,
    rentalMonthly: 0,
    rentalDiscountMonthly: 0,
    rentalStartMonth: defaultMonth,
    rentalEndMonth: "",
    propertyAssetId: `asset_home_${nanoid(6)}`,
    mortgageLiabilityId: `liability_mortgage_${nanoid(6)}`,
    eventId: `evt_v2_bundle_${nanoid(6)}`,
  });

  const isNewBabyBundle = template?.id === "life_new_baby_plan";
  const isHomeBundle = template?.id === "life_home_purchase";

  useEffect(() => {
    if (!opened) {
      return;
    }
    setStep(0);
    setErrors({});
    setActionError(null);
    setPreviewEvents([]);
    setCreatedEventIds(new Set());
    setPackAsExperiment(true);
    setNewBabyDraft((current) => ({
      ...current,
      birthMonth: defaultMonth || current.birthMonth,
      schoolingStartMonth: defaultMonth || current.schoolingStartMonth,
    }));
    setHomeDraft((current) => ({
      ...current,
      startMonth: defaultMonth || current.startMonth,
      rentalStartMonth: defaultMonth || current.rentalStartMonth,
      propertyAssetId: `asset_home_${nanoid(6)}`,
      mortgageLiabilityId: `liability_mortgage_${nanoid(6)}`,
      eventId: `evt_v2_bundle_${nanoid(6)}`,
      feesOneOff: [],
      ongoingCosts: [],
      rentalEnabled: false,
      rentalMonthly: 0,
      rentalDiscountMonthly: 0,
      rentalEndMonth: "",
    }));
  }, [defaultMonth, opened, template?.id]);

  const hasLivingTotal = useMemo(() => {
    const livingLabel = t("templates.living_total.name");
    return scenarioEvents.some(
      (event) =>
        event.type === "cashflow" &&
        event.kind === "expense" &&
        (event.tags?.includes("living_total") || event.label === livingLabel)
    );
  }, [scenarioEvents, t]);

  const hasBabyTag = useMemo(
    () =>
      scenarioEvents.some(
        (event) => event.type === "cashflow" && event.tags?.includes("baby")
      ),
    [scenarioEvents]
  );

  const hasHelperTag = useMemo(
    () =>
      scenarioEvents.some(
        (event) => event.type === "cashflow" && event.tags?.includes("helper")
      ),
    [scenarioEvents]
  );

  const hasMortgageEvent = useMemo(
    () =>
      scenarioEvents.some(
        (event) => event.type === "housing" && event.kind === "mortgage"
      ),
    [scenarioEvents]
  );

  const hasRentEvent = useMemo(() => {
    const rentLabel = t("templates.rent_housing.name");
    return scenarioEvents.some(
      (event) =>
        (event.type === "housing" && event.kind === "rent") ||
        (event.type === "cashflow" &&
          event.kind === "expense" &&
          (event.tags?.includes("rent") || event.label === rentLabel))
    );
  }, [scenarioEvents, t]);

  const warnings = useMemo(() => {
    if (isNewBabyBundle) {
      const items: string[] = [];
      if (hasLivingTotal) {
        items.push(t("bundleNewBabyWarningLiving"));
      }
      if (hasBabyTag) {
        items.push(t("bundleNewBabyWarningBaby"));
      }
      if (hasHelperTag) {
        items.push(t("bundleNewBabyWarningHelper"));
      }
      return items;
    }
    if (isHomeBundle) {
      const items: string[] = [];
      if (hasMortgageEvent) {
        items.push(t("bundleHomeWarningMortgage"));
      }
      if (hasRentEvent) {
        items.push(t("bundleHomeWarningRent"));
      }
      return items;
    }
    return [];
  }, [
    hasBabyTag,
    hasHelperTag,
    hasLivingTotal,
    hasMortgageEvent,
    hasRentEvent,
    isHomeBundle,
    isNewBabyBundle,
    t,
  ]);

  const getEventTypeLabel = (event: ScenarioEventDraft) => {
    if (event.type === "cashflow") {
      return event.kind === "income" ? t("incomeTitle") : t("expensesTitle");
    }
    if (event.type === "housing") {
      return t("housingTitle");
    }
    if (event.type === "loan") {
      return t("liabilitiesTitle");
    }
    if (event.type === "insurance") {
      return t("assetsTitle");
    }
    return t("bundleEventFallback");
  };

  const getEventMonthLabel = (event: ScenarioEventDraft) => {
    if ("occurrenceMonth" in event && event.occurrenceMonth) {
      return event.occurrenceMonth;
    }
    if ("startMonth" in event && event.startMonth) {
      return event.startMonth;
    }
    return "-";
  };

  const handleApply = async () => {
    if (!scenarioId) {
      if (!onApplyEvents) {
        return;
      }
    }
    setActionError(null);
    const drafts = previewEvents.filter(
      (event) => event.id && !createdEventIds.has(event.id)
    );
    if (onApplyEvents) {
      const experimentTitle = template ? t(`templates.${template.id}.name`) : undefined;
      const result = await onApplyEvents(drafts, {
        packAsExperiment,
        experimentTitle,
      });
      if (!result.ok) {
        setActionError(result.error ?? t("bundleApplyFailed"));
        return;
      }
      onClose();
      return;
    }
    for (const event of drafts) {
      const result = addEvent(event, scenarioId ?? undefined);
      if (!result.ok) {
        setActionError(t("bundleApplyFailed"));
        return;
      }
    }
    onClose();
  };

  const handleEdit = (event: ScenarioEventDraft) => {
    if (!allowInlineEdit || !onOpenEventDrawer) {
      return;
    }
    if (!scenarioId || !event.id) {
      return;
    }
    const eventId = event.id;
    if (!createdEventIds.has(eventId)) {
      const result = addEvent(event, scenarioId ?? undefined);
      if (!result.ok) {
        setActionError(t("bundleApplyFailed"));
        return;
      }
      setCreatedEventIds((current) => new Set([...current, eventId]));
    }
    onOpenEventDrawer(event.type, eventId);
  };

  const handleNext = () => {
    setActionError(null);
    if (step === 1) {
      setCreatedEventIds(new Set());
      if (isNewBabyBundle) {
        const input: NewBabyPlanInput = {
          birthMonth: newBabyDraft.birthMonth,
          deliveryCost: newBabyDraft.deliveryCost,
          childcareMonthly: normalizeAmount(newBabyDraft.childcareMonthly),
          helperEnabled: newBabyDraft.helperEnabled,
          helperMonthly: normalizeAmount(newBabyDraft.helperMonthly),
          agencyFee: normalizeAmount(newBabyDraft.agencyFee),
          schoolingEnabled: newBabyDraft.schoolingEnabled,
          schoolingAmount: normalizeAmount(newBabyDraft.schoolingAmount),
          schoolingCadence: newBabyDraft.schoolingCadence,
          schoolingStartMonth: newBabyDraft.schoolingStartMonth,
        };
        const events = buildNewBabyBundleEvents(input, {
          deliveryCost: t("bundleNewBabyDelivery"),
          childcare: t("bundleNewBabyChildcare"),
          helperMonthly: t("bundleNewBabyHelperMonthly"),
          agencyFee: t("bundleNewBabyAgencyFee"),
          schooling: t("bundleNewBabySchooling"),
        });
        setPreviewEvents(events);
      }
      if (isHomeBundle) {
        const termMonths =
          homeDraft.termMode === "years"
            ? homeDraft.mortgageTermYears * 12
            : homeDraft.mortgageTermMonths;
        const input: HomePurchaseBundleInput = {
          id: homeDraft.eventId,
          label: t("bundleHomeMortgageLabel"),
          startMonth: homeDraft.startMonth,
          purchasePrice: homeDraft.purchasePrice,
          downPaymentMode: homeDraft.downPaymentMode,
          downPaymentPercent: homeDraft.downPaymentPercent,
          downPaymentAmount: homeDraft.downPaymentAmount,
          mortgageRatePct: homeDraft.mortgageRatePct,
          mortgageTermYears:
            homeDraft.termMode === "years"
              ? homeDraft.mortgageTermYears
              : termMonths / 12,
          mortgagePayment: homeDraft.mortgagePayment,
          mortgagePaymentIsEstimated: homeDraft.mortgagePaymentIsEstimated,
          feesOneOff: homeDraft.feesOneOff
            .filter((fee) => fee.amount > 0)
            .map((fee) => ({
              id: fee.id,
              label: fee.label || undefined,
              amount: fee.amount,
              month: fee.month,
            })),
          ongoingCosts: homeDraft.ongoingCosts
            .filter((cost) => cost.amount > 0)
            .map((cost) => ({
              id: cost.id,
              label: cost.label || undefined,
              amount: cost.amount,
              startMonth: cost.startMonth,
              endMonth: cost.endMonth || undefined,
            })),
          rental: homeDraft.rentalEnabled
            ? {
                enabled: true,
                rentMonthly: homeDraft.rentalMonthly,
                discountMonthly: homeDraft.rentalDiscountMonthly,
                startMonth: homeDraft.rentalStartMonth,
                endMonth: homeDraft.rentalEndMonth || undefined,
              }
            : undefined,
          propertyAssetId: homeDraft.propertyAssetId,
          mortgageLiabilityId: homeDraft.mortgageLiabilityId,
        };
        setPreviewEvents([buildHomePurchaseBundleEvent(input)]);
      }
    }
    setStep((current) => Math.min(current + 1, 2));
  };

  const handleBack = () => setStep((current) => Math.max(0, current - 1));

  const canAdvanceNewBaby = () => {
    const errors: Record<string, string> = {};
    const monthResult = normalizeMonthValue(newBabyDraft.birthMonth);
    if (monthResult.error) {
      errors.birthMonth =
        monthResult.error === "empty"
          ? t("bundleMonthRequired")
          : validation("useYearMonth");
    }
    if (newBabyDraft.helperEnabled && newBabyDraft.helperMonthly <= 0) {
      errors.helperMonthly = t("bundleAmountRequired");
    }
    if (newBabyDraft.schoolingEnabled) {
      if (newBabyDraft.schoolingAmount <= 0) {
        errors.schoolingAmount = t("bundleAmountRequired");
      }
      const schoolingMonthResult = normalizeMonthValue(
        newBabyDraft.schoolingStartMonth
      );
      if (schoolingMonthResult.error) {
        errors.schoolingStartMonth =
          schoolingMonthResult.error === "empty"
            ? t("bundleMonthRequired")
            : validation("useYearMonth");
      }
    }
    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const canAdvanceHome = () => {
    const errors: Record<string, string> = {};
    const monthResult = normalizeMonthValue(homeDraft.startMonth);
    if (monthResult.error) {
      errors.startMonth =
        monthResult.error === "empty"
          ? t("bundleMonthRequired")
          : validation("useYearMonth");
    }
    if (homeDraft.purchasePrice <= 0) {
      errors.purchasePrice = t("bundleAmountRequired");
    }
    if (homeDraft.downPaymentMode === "percent" && homeDraft.downPaymentPercent <= 0) {
      errors.downPaymentPercent = t("bundleAmountRequired");
    }
    if (homeDraft.downPaymentMode === "amount" && homeDraft.downPaymentAmount <= 0) {
      errors.downPaymentAmount = t("bundleAmountRequired");
    }
    if (homeDraft.mortgageRatePct <= 0) {
      errors.mortgageRatePct = t("bundleAmountRequired");
    }
    if (
      homeDraft.termMode === "years" &&
      (!homeDraft.mortgageTermYears || homeDraft.mortgageTermYears <= 0)
    ) {
      errors.mortgageTermYears = t("bundleAmountRequired");
    }
    if (
      homeDraft.termMode === "months" &&
      (!homeDraft.mortgageTermMonths || homeDraft.mortgageTermMonths <= 0)
    ) {
      errors.mortgageTermMonths = t("bundleAmountRequired");
    }
    if (homeDraft.mortgagePayment <= 0) {
      errors.mortgagePayment = t("bundleAmountRequired");
    }
    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextValidated = () => {
    if (isNewBabyBundle && !canAdvanceNewBaby()) {
      return;
    }
    if (isHomeBundle && !canAdvanceHome()) {
      return;
    }
    handleNext();
  };

  const helperCostMonthNormalize = (value: string) => {
    const normalized = normalizeMonthValue(value);
    return normalized.value;
  };

  const updateFees = (id: string, patch: Partial<FeeDraft>) => {
    setHomeDraft((current) => ({
      ...current,
      feesOneOff: current.feesOneOff.map((fee) =>
        fee.id === id ? { ...fee, ...patch } : fee
      ),
    }));
  };

  const updateOngoingCosts = (id: string, patch: Partial<OngoingCostDraft>) => {
    setHomeDraft((current) => ({
      ...current,
      ongoingCosts: current.ongoingCosts.map((cost) =>
        cost.id === id ? { ...cost, ...patch } : cost
      ),
    }));
  };

  const termMonths = homeDraft.termMode === "years"
    ? homeDraft.mortgageTermYears * 12
    : homeDraft.mortgageTermMonths;
  const downPaymentPercent =
    homeDraft.downPaymentMode === "percent"
      ? homeDraft.downPaymentPercent
      : homeDraft.purchasePrice > 0
        ? (homeDraft.downPaymentAmount / homeDraft.purchasePrice) * 100
        : 0;
  const downPaymentAmount =
    homeDraft.downPaymentMode === "percent"
      ? (homeDraft.purchasePrice * downPaymentPercent) / 100
      : homeDraft.downPaymentAmount;
  const loanAmount = Math.max(0, homeDraft.purchasePrice - downPaymentAmount);
  const estimatedPayment = estimateMonthlyPayment({
    principal: loanAmount,
    annualRatePct: homeDraft.mortgageRatePct,
    termMonths,
  });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={t("bundleWizardTitle")}
    >
      <Stack gap="md">
        <Stepper active={step} size="sm">
          <Stepper.Step label={t("bundleStepBasics")} />
          <Stepper.Step label={t("bundleStepOptions")} />
          <Stepper.Step label={t("bundleStepReview")} />
        </Stepper>

        {isNewBabyBundle && step === 0 && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("bundleNewBabyIntro")}
            </Text>
            <MonthField
              label={t("bundleNewBabyBirthMonth")}
              value={newBabyDraft.birthMonth}
              error={errors.birthMonth}
              onChange={(value) =>
                setNewBabyDraft((current) => ({
                  ...current,
                  birthMonth: value,
                }))
              }
              onBlur={(event) => {
                const result = normalizeMonthValue(event.currentTarget.value);
                setNewBabyDraft((current) => ({
                  ...current,
                  birthMonth: result.value,
                }));
              }}
            />
            <NumberInput
              label={t("bundleNewBabyDeliveryCost")}
              min={0}
              value={newBabyDraft.deliveryCost}
              onChange={(value) =>
                setNewBabyDraft((current) => ({
                  ...current,
                  deliveryCost: Number(value) || 0,
                }))
              }
            />
            <NumberInput
              label={t("bundleNewBabyChildcareMonthly")}
              min={0}
              value={newBabyDraft.childcareMonthly}
              onChange={(value) =>
                setNewBabyDraft((current) => ({
                  ...current,
                  childcareMonthly: Number(value) || 0,
                }))
              }
            />
          </Stack>
        )}

        {isNewBabyBundle && step === 1 && (
          <Stack gap="md">
            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Switch
                  checked={newBabyDraft.helperEnabled}
                  label={t("bundleNewBabyHelperToggle")}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setNewBabyDraft((current) =>
                      checked
                        ? { ...current, helperEnabled: true }
                        : {
                            ...current,
                            helperEnabled: false,
                            helperMonthly: 0,
                            agencyFee: 0,
                          }
                    );
                    if (!checked) {
                      setErrors((current) => {
                        if (!current.helperMonthly) {
                          return current;
                        }
                        return { ...current, helperMonthly: undefined };
                      });
                    }
                  }}
                />
                {newBabyDraft.helperEnabled && (
                  <>
                    <NumberInput
                      label={t("bundleNewBabyHelperMonthly")}
                      min={0}
                      value={newBabyDraft.helperMonthly}
                      error={errors.helperMonthly}
                      onChange={(value) =>
                        setNewBabyDraft((current) => ({
                          ...current,
                          helperMonthly: Number(value) || 0,
                        }))
                      }
                    />
                    <NumberInput
                      label={t("bundleNewBabyAgencyFee")}
                      min={0}
                      value={newBabyDraft.agencyFee}
                      onChange={(value) =>
                        setNewBabyDraft((current) => ({
                          ...current,
                          agencyFee: Number(value) || 0,
                        }))
                      }
                    />
                  </>
                )}
              </Stack>
            </Card>
            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Switch
                  checked={newBabyDraft.schoolingEnabled}
                  label={t("bundleNewBabySchoolingToggle")}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setNewBabyDraft((current) =>
                      checked
                        ? { ...current, schoolingEnabled: true }
                        : {
                            ...current,
                            schoolingEnabled: false,
                            schoolingAmount: 0,
                          }
                    );
                    if (!checked) {
                      setErrors((current) => {
                        if (!current.schoolingAmount && !current.schoolingStartMonth) {
                          return current;
                        }
                        return {
                          ...current,
                          schoolingAmount: undefined,
                          schoolingStartMonth: undefined,
                        };
                      });
                    }
                  }}
                />
                {newBabyDraft.schoolingEnabled && (
                  <>
                    <SegmentedControl
                      value={newBabyDraft.schoolingCadence}
                      onChange={(value) =>
                        setNewBabyDraft((current) => ({
                          ...current,
                          schoolingCadence: value === "yearly" ? "yearly" : "monthly",
                        }))
                      }
                      data={[
                        { label: t("bundleCadenceMonthly"), value: "monthly" },
                        { label: t("bundleCadenceYearly"), value: "yearly" },
                      ]}
                    />
                    <NumberInput
                      label={t("bundleNewBabySchoolingAmount")}
                      min={0}
                      value={newBabyDraft.schoolingAmount}
                      error={errors.schoolingAmount}
                      onChange={(value) =>
                        setNewBabyDraft((current) => ({
                          ...current,
                          schoolingAmount: Number(value) || 0,
                        }))
                      }
                    />
                    <MonthField
                      label={t("bundleNewBabySchoolingStartMonth")}
                      value={newBabyDraft.schoolingStartMonth}
                      error={errors.schoolingStartMonth}
                      onChange={(value) =>
                        setNewBabyDraft((current) => ({
                          ...current,
                          schoolingStartMonth: value,
                        }))
                      }
                      onBlur={(event) => {
                        const value = helperCostMonthNormalize(event.currentTarget.value);
                        setNewBabyDraft((current) => ({
                          ...current,
                          schoolingStartMonth: value,
                        }));
                      }}
                    />
                  </>
                )}
              </Stack>
            </Card>
          </Stack>
        )}

        {isHomeBundle && step === 0 && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("bundleHomeIntro")}
            </Text>
            <MonthField
              label={t("bundleHomeStartMonth")}
              value={homeDraft.startMonth}
              error={errors.startMonth}
              onChange={(value) =>
                setHomeDraft((current) => ({
                  ...current,
                  startMonth: value,
                }))
              }
              onBlur={(event) => {
                const normalized = normalizeMonthValue(event.currentTarget.value);
                setHomeDraft((current) => ({
                  ...current,
                  startMonth: normalized.value,
                }));
              }}
            />
            <NumberInput
              label={t("bundleHomePurchasePrice")}
              min={0}
              value={homeDraft.purchasePrice}
              error={errors.purchasePrice}
              onChange={(value) =>
                setHomeDraft((current) => ({
                  ...current,
                  purchasePrice: Number(value) || 0,
                }))
              }
            />
            <SegmentedControl
              value={homeDraft.downPaymentMode}
              onChange={(value) =>
                setHomeDraft((current) => ({
                  ...current,
                  downPaymentMode: value === "amount" ? "amount" : "percent",
                }))
              }
              data={[
                { label: t("bundleHomeDownPaymentPercent"), value: "percent" },
                { label: t("bundleHomeDownPaymentAmount"), value: "amount" },
              ]}
            />
            {homeDraft.downPaymentMode === "percent" ? (
              <NumberInput
                label={t("bundleHomeDownPaymentPercent")}
                min={0}
                max={100}
                value={homeDraft.downPaymentPercent}
                error={errors.downPaymentPercent}
                onChange={(value) =>
                  setHomeDraft((current) => ({
                    ...current,
                    downPaymentPercent: Number(value) || 0,
                  }))
                }
              />
            ) : (
              <NumberInput
                label={t("bundleHomeDownPaymentAmount")}
                min={0}
                value={homeDraft.downPaymentAmount}
                error={errors.downPaymentAmount}
                onChange={(value) =>
                  setHomeDraft((current) => ({
                    ...current,
                    downPaymentAmount: Number(value) || 0,
                  }))
                }
              />
            )}
            <NumberInput
              label={t("bundleHomeMortgageRate")}
              min={0}
              value={homeDraft.mortgageRatePct}
              error={errors.mortgageRatePct}
              onChange={(value) =>
                setHomeDraft((current) => ({
                  ...current,
                  mortgageRatePct: Number(value) || 0,
                }))
              }
            />
            <SegmentedControl
              value={homeDraft.termMode}
              onChange={(value) =>
                setHomeDraft((current) => ({
                  ...current,
                  termMode: value === "months" ? "months" : "years",
                }))
              }
              data={[
                { label: t("bundleHomeTermYears"), value: "years" },
                { label: t("bundleHomeTermMonths"), value: "months" },
              ]}
            />
            {homeDraft.termMode === "years" ? (
              <NumberInput
                label={t("bundleHomeTermYears")}
                min={1}
                value={homeDraft.mortgageTermYears}
                error={errors.mortgageTermYears}
                onChange={(value) =>
                  setHomeDraft((current) => ({
                    ...current,
                    mortgageTermYears: Number(value) || 0,
                  }))
                }
              />
            ) : (
              <NumberInput
                label={t("bundleHomeTermMonths")}
                min={1}
                value={homeDraft.mortgageTermMonths}
                error={errors.mortgageTermMonths}
                onChange={(value) =>
                  setHomeDraft((current) => ({
                    ...current,
                    mortgageTermMonths: Number(value) || 0,
                  }))
                }
              />
            )}
            <Stack gap={4}>
              <NumberInput
                label={t("bundleHomeMortgagePayment")}
                min={0}
                value={homeDraft.mortgagePayment}
                error={errors.mortgagePayment}
                onChange={(value) =>
                  setHomeDraft((current) => ({
                    ...current,
                    mortgagePayment: Number(value) || 0,
                    mortgagePaymentIsEstimated: false,
                  }))
                }
              />
              {estimatedPayment && (
                <Text size="xs" c="dimmed">
                  {t("bundleHomeMortgageEstimate", {
                    amount: formatCurrency(estimatedPayment, baseCurrency, locale),
                  })}
                </Text>
              )}
              {estimatedPayment && (
                <Button
                  variant="light"
                  size="xs"
                  onClick={() =>
                    setHomeDraft((current) => ({
                      ...current,
                      mortgagePayment: Math.round(estimatedPayment),
                      mortgagePaymentIsEstimated: true,
                    }))
                  }
                >
                  {t("bundleHomeUseEstimate")}
                </Button>
              )}
            </Stack>
          </Stack>
        )}

        {isHomeBundle && step === 1 && (
          <Stack gap="md">
            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={600}>{t("bundleHomeFeesTitle")}</Text>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={() =>
                      setHomeDraft((current) => ({
                        ...current,
                        feesOneOff: [...current.feesOneOff, createFeeDraft()],
                      }))
                    }
                  >
                    {t("bundleAddFee")}
                  </Button>
                </Group>
                {homeDraft.feesOneOff.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("bundleFeesEmpty")}
                  </Text>
                ) : (
                  homeDraft.feesOneOff.map((fee) => (
                    <Card key={fee.id} withBorder radius="sm" padding="sm">
                      <Stack gap="xs">
                        <TextInput
                          label={t("bundleFeeLabel")}
                          value={fee.label}
                          onChange={(event) =>
                            updateFees(fee.id, { label: event.currentTarget.value })
                          }
                        />
                        <NumberInput
                          label={t("bundleFeeAmount")}
                          min={0}
                          value={fee.amount}
                          onChange={(value) =>
                            updateFees(fee.id, { amount: Number(value) || 0 })
                          }
                        />
                        <MonthField
                          label={t("bundleFeeMonth")}
                          value={fee.month}
                          onChange={(value) => updateFees(fee.id, { month: value })}
                          onBlur={(event) =>
                            updateFees(fee.id, {
                              month: helperCostMonthNormalize(event.currentTarget.value),
                            })
                          }
                        />
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() =>
                            setHomeDraft((current) => ({
                              ...current,
                              feesOneOff: current.feesOneOff.filter(
                                (item) => item.id !== fee.id
                              ),
                            }))
                          }
                        >
                          {t("bundleRemove")}
                        </Button>
                      </Stack>
                    </Card>
                  ))
                )}
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={600}>{t("bundleHomeOngoingTitle")}</Text>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={() =>
                      setHomeDraft((current) => ({
                        ...current,
                        ongoingCosts: [...current.ongoingCosts, createOngoingCostDraft()],
                      }))
                    }
                  >
                    {t("bundleAddOngoing")}
                  </Button>
                </Group>
                {homeDraft.ongoingCosts.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("bundleOngoingEmpty")}
                  </Text>
                ) : (
                  homeDraft.ongoingCosts.map((cost) => (
                    <Card key={cost.id} withBorder radius="sm" padding="sm">
                      <Stack gap="xs">
                        <TextInput
                          label={t("bundleOngoingLabel")}
                          value={cost.label}
                          onChange={(event) =>
                            updateOngoingCosts(cost.id, {
                              label: event.currentTarget.value,
                            })
                          }
                        />
                        <NumberInput
                          label={t("bundleOngoingAmount")}
                          min={0}
                          value={cost.amount}
                          onChange={(value) =>
                            updateOngoingCosts(cost.id, {
                              amount: Number(value) || 0,
                            })
                          }
                        />
                        <MonthField
                          label={t("bundleOngoingStartMonth")}
                          value={cost.startMonth}
                          onChange={(value) =>
                            updateOngoingCosts(cost.id, {
                              startMonth: value,
                            })
                          }
                          onBlur={(event) =>
                            updateOngoingCosts(cost.id, {
                              startMonth: helperCostMonthNormalize(
                                event.currentTarget.value
                              ),
                            })
                          }
                        />
                        <MonthField
                          label={t("bundleOngoingEndMonth")}
                          value={cost.endMonth}
                          onChange={(value) =>
                            updateOngoingCosts(cost.id, {
                              endMonth: value,
                            })
                          }
                          onBlur={(event) =>
                            updateOngoingCosts(cost.id, {
                              endMonth: helperCostMonthNormalize(
                                event.currentTarget.value
                              ),
                            })
                          }
                        />
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() =>
                            setHomeDraft((current) => ({
                              ...current,
                              ongoingCosts: current.ongoingCosts.filter(
                                (item) => item.id !== cost.id
                              ),
                            }))
                          }
                        >
                          {t("bundleRemove")}
                        </Button>
                      </Stack>
                    </Card>
                  ))
                )}
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Switch
                  checked={homeDraft.rentalEnabled}
                  label={t("bundleHomeRentalToggle")}
                  onChange={(event) =>
                    setHomeDraft((current) => ({
                      ...current,
                      rentalEnabled: event?.currentTarget?.checked ?? false,
                    }))
                  }
                />
                {homeDraft.rentalEnabled && (
                  <>
                    <NumberInput
                      label={t("bundleHomeRentalMonthly")}
                      min={0}
                      value={homeDraft.rentalMonthly}
                      onChange={(value) =>
                        setHomeDraft((current) => ({
                          ...current,
                          rentalMonthly: Number(value) || 0,
                        }))
                      }
                    />
                    <NumberInput
                      label={t("bundleHomeRentalDiscount")}
                      min={0}
                      value={homeDraft.rentalDiscountMonthly}
                      onChange={(value) =>
                        setHomeDraft((current) => ({
                          ...current,
                          rentalDiscountMonthly: Number(value) || 0,
                        }))
                      }
                    />
                    <MonthField
                      label={t("bundleHomeRentalStartMonth")}
                      value={homeDraft.rentalStartMonth}
                      onChange={(value) =>
                        setHomeDraft((current) => ({
                          ...current,
                          rentalStartMonth: value,
                        }))
                      }
                    />
                    <MonthField
                      label={t("bundleHomeRentalEndMonth")}
                      value={homeDraft.rentalEndMonth}
                      onChange={(value) =>
                        setHomeDraft((current) => ({
                          ...current,
                          rentalEndMonth: value,
                        }))
                      }
                    />
                  </>
                )}
              </Stack>
            </Card>
          </Stack>
        )}

        {step === 2 && (
          <Stack gap="md">
            {warnings.length > 0 && (
              <Alert color="yellow" title={t("bundleWarningsTitle")}>
                <Stack gap={4}>
                  {warnings.map((warning) => (
                    <Text size="sm" key={warning}>
                      {warning}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            )}
            {previewEvents.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t("bundleReviewEmpty")}
              </Text>
            ) : (
              <Stack gap="sm">
                {previewEvents.map((event, index) => (
                  <Card key={event.id ?? index} withBorder radius="md" padding="sm">
                    <Stack gap={6}>
                      <Text fw={600}>{event.label ?? t("bundleEventFallback")}</Text>
                      <Text size="sm" c="dimmed">
                        {getEventTypeLabel(event)} · {getEventMonthLabel(event)}
                      </Text>
                      {"amount" in event && (
                        <Text size="sm" c="dimmed">
                          {formatCurrency(event.amount, baseCurrency, locale)}
                        </Text>
                      )}
                      {allowInlineEdit && (
                        <Button
                          variant="light"
                          size="xs"
                          onClick={() => handleEdit(event)}
                        >
                          {t("bundleEdit")}
                        </Button>
                      )}
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}
            {actionError && (
              <Alert color="red" title={t("bundleApplyFailed")}>
                {actionError}
              </Alert>
            )}
            <Checkbox
              checked={packAsExperiment}
              onChange={(event) => setPackAsExperiment(event.currentTarget.checked)}
              label={t("bundlePackAsExperiment")}
            />
          </Stack>
        )}

        <Divider />

        <Group justify="space-between">
          <Button variant="default" onClick={step === 0 ? onClose : handleBack}>
            {step === 0 ? t("bundleCancel") : t("bundleBack")}
          </Button>
          {step < 2 ? (
            <Button onClick={handleNextValidated}>{t("bundleNext")}</Button>
          ) : (
            <Button onClick={handleApply}>{t("bundleFinish")}</Button>
          )}
        </Group>
      </Stack>
    </Drawer>
  );
}
