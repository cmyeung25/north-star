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
import { addMonths } from "../../../src/domain/members/age";
import {
  buildHomePurchaseBundleEvent,
  buildMarriageBundleEvents,
  buildNewBabyBundleEvents,
  computeTravelTotal,
  deriveStartMonth,
  normalizeWeddingBreakdown,
  type StartMonthStrategy,
  type BundleWizardInput,
  type HomePurchaseBundleInput,
  type MarriagePlanInput,
  type NewBabyPlanInput,
  type TravelBudgetMode,
  type TravelMonthMode,
  type WeddingStyle,
} from "../../../src/domain/eventTemplates/bundles";
import {
  DESTINATION_WEDDING_PRESETS,
  HONEYMOON_PRESETS,
} from "../../../src/domain/eventTemplates/marriageBudgetPresets";
import {
  applyHoneymoonPresetToForm,
  applyTravelPresetToForm,
} from "../../../src/domain/eventTemplates/marriagePresetAdapters";
import { useScenarioStore } from "../../../src/store/scenarioStore";

type BundleWizardDrawerProps = {
  opened: boolean;
  template: TemplateDef | null;
  mode?: "create" | "edit";
  bundleInstanceId?: string | null;
  initialWizardInput?: BundleWizardInput | null;
  scenarioId?: string | null;
  baseMonth?: string | null;
  baseCurrency: string;
  scenarioEvents: ScenarioEventDraft[];
  onClose: () => void;
  onOpenEventDrawer?: (type: ScenarioEventDraft["type"], eventId: string) => void;
  onApplyEvents?: (
    events: ScenarioEventDraft[],
    options?: { packAsExperiment?: boolean; experimentTitle?: string },
    context?: {
      bundleInstanceId: string;
      wizardInput: BundleWizardInput;
    }
  ) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
  allowInlineEdit?: boolean;
  editingEventId?: string | null;
};

type FeeDraft = {
  id: string;
  label: string;
  amount: number;
  month: string;
  monthMode: "purchase" | "plus1" | "custom";
};

type OngoingCostDraft = {
  id: string;
  label: string;
  amount: number;
  startMonth: string;
  endMonth: string;
  monthMode: "purchase" | "plus1" | "custom";
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
  propertyName: string;
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
  rentalStartStrategy: StartMonthStrategy;
  rentalStartMonth: string;
  rentalEndMonth: string;
  propertyAssetId: string;
  mortgageLiabilityId: string;
  eventId: string;
};

type MarriageDraft = {
  title: string;
  weddingMonth: string;
  weddingStyle: WeddingStyle;
  totalWeddingBudget: number;
  breakdownEnabled: boolean;
  customBreakdown: boolean;
  breakdownItems: {
    id: string;
    label: string;
    amount: number;
    ratio: number;
  }[];
  includeTravel: boolean;
  travelMonthMode: TravelMonthMode;
  travelCustomMonth: string;
  travelBudgetMode: TravelBudgetMode;
  travelTotal: number;
  travellersCount: number;
  perPersonBudget: number;
  honeymoonExtraEnabled: boolean;
  extraTravelMonthMode: TravelMonthMode;
  extraTravelCustomMonth: string;
  extraTravelBudgetMode: TravelBudgetMode;
  extraTravelTotal: number;
  extraTravellersCount: number;
  extraPerPersonBudget: number;
  isCustomized: boolean;
};

const createDefaultWeddingBreakdown = (t: ReturnType<typeof useTranslations>) => [
  { id: "banquet", label: t("bundleMarriageBreakdownBanquet"), amount: 0, ratio: 45 },
  { id: "photo", label: t("bundleMarriageBreakdownPhoto"), amount: 0, ratio: 10 },
  { id: "dress", label: t("bundleMarriageBreakdownDress"), amount: 0, ratio: 10 },
  { id: "rings", label: t("bundleMarriageBreakdownRings"), amount: 0, ratio: 15 },
  { id: "flowers", label: t("bundleMarriageBreakdownFlowers"), amount: 0, ratio: 10 },
  { id: "misc", label: t("bundleMarriageBreakdownMisc"), amount: 0, ratio: 10 },
];

const createFeeDraft = (overrides?: Partial<FeeDraft>): FeeDraft => ({
  id: `fee_${nanoid(6)}`,
  label: "",
  amount: 0,
  month: "",
  monthMode: "purchase",
  ...overrides,
});

const createOngoingCostDraft = (): OngoingCostDraft => ({
  id: `cost_${nanoid(6)}`,
  label: "",
  amount: 0,
  startMonth: "",
  endMonth: "",
  monthMode: "purchase",
});

const createHomeDraft = (defaultMonth: string): HomePurchaseDraft => ({
  startMonth: defaultMonth,
  propertyName: "",
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
  rentalStartStrategy: "purchase",
  rentalStartMonth: defaultMonth,
  rentalEndMonth: "",
  propertyAssetId: `asset_home_${nanoid(6)}`,
  mortgageLiabilityId: `liability_mortgage_${nanoid(6)}`,
  eventId: `evt_v2_bundle_${nanoid(6)}`,
});

const hydrateNewBabyDraftFromInput = (
  input: NewBabyPlanInput,
  fallbackMonth: string
): NewBabyDraft => {
  const fallback = isValidMonthKey(fallbackMonth) ? fallbackMonth : input.birthMonth;
  return {
    birthMonth: input.birthMonth ?? fallback,
    deliveryCost: input.deliveryCost ?? 0,
    childcareMonthly: input.childcareMonthly ?? 0,
    helperEnabled: input.helperEnabled ?? false,
    helperMonthly: input.helperMonthly ?? 0,
    agencyFee: input.agencyFee ?? 0,
    schoolingEnabled: input.schoolingEnabled ?? false,
    schoolingAmount: input.schoolingAmount ?? 0,
    schoolingCadence: input.schoolingCadence ?? "monthly",
    schoolingStartMonth: input.schoolingStartMonth ?? fallback,
  };
};

const resolveFeeMonthMode = (
  feeMonth: string,
  startMonth: string
): FeeDraft["monthMode"] => {
  if (!isValidMonthKey(startMonth)) {
    return "custom";
  }
  if (feeMonth === startMonth) {
    return "purchase";
  }
  if (feeMonth === addMonths(startMonth, 1)) {
    return "plus1";
  }
  return "custom";
};

const resolveOngoingMonthMode = (
  startMonth: string,
  purchaseMonth: string
): OngoingCostDraft["monthMode"] => {
  if (!isValidMonthKey(purchaseMonth)) {
    return "custom";
  }
  if (startMonth === purchaseMonth) {
    return "purchase";
  }
  if (startMonth === addMonths(purchaseMonth, 1)) {
    return "plus1";
  }
  return "custom";
};


const hydrateHomeDraftFromEvent = (
  event: ScenarioEventDraft,
  fallbackMonth: string
): HomePurchaseDraft => {
  if (event.type !== "housing" || event.kind !== "mortgage") {
    return createHomeDraft(fallbackMonth);
  }
  const startMonth = event.startMonth ?? fallbackMonth;
  const downPaymentMode = event.downPaymentMode ?? "percent";
  const mortgageTermYears = event.mortgageTermYears ?? 0;
  const feesOneOff =
    event.feesOneOff?.map((fee) => ({
      id: fee.id,
      label: fee.label ?? "",
      amount: fee.amount,
      month: fee.month,
      monthMode: resolveFeeMonthMode(fee.month, startMonth),
    })) ?? [];
  const ongoingCosts =
    event.ongoingCosts?.map((cost) => ({
      id: cost.id,
      label: cost.label ?? "",
      amount: cost.amount,
      startMonth: cost.startMonth,
      endMonth: cost.endMonth ?? "",
      monthMode: resolveOngoingMonthMode(cost.startMonth, startMonth),
    })) ?? [];
  const rentalEnabled = Boolean(event.rental?.enabled);
  const rentalStartMonth = event.rental?.startMonth ?? startMonth;

  return {
    startMonth,
    propertyName: event.label ?? "",
    purchasePrice: event.purchasePrice ?? 0,
    downPaymentMode,
    downPaymentPercent:
      downPaymentMode === "percent" ? event.downPaymentPercent ?? 0 : 0,
    downPaymentAmount:
      downPaymentMode === "amount" ? event.downPaymentAmount ?? 0 : 0,
    mortgageRatePct: event.mortgageRatePct ?? 0,
    termMode: "years",
    mortgageTermYears,
    mortgageTermMonths: mortgageTermYears * 12,
    mortgagePayment: event.mortgagePayment ?? 0,
    mortgagePaymentIsEstimated: event.mortgagePaymentIsEstimated ?? true,
    feesOneOff,
    ongoingCosts,
    rentalEnabled,
    rentalMonthly: event.rental?.rentMonthly ?? 0,
    rentalDiscountMonthly: 0,
    rentalStartStrategy: event.rental?.startMonth ? "custom" : "purchase",
    rentalStartMonth,
    rentalEndMonth: event.rental?.endMonth ?? "",
    propertyAssetId: event.propertyAssetId ?? `asset_home_${nanoid(6)}`,
    mortgageLiabilityId: event.mortgageLiabilityId ?? `liability_mortgage_${nanoid(6)}`,
    eventId: event.id ?? `evt_v2_bundle_${nanoid(6)}`,
  };
};

const hydrateHomeDraftFromInput = (
  input: HomePurchaseBundleInput,
  fallbackMonth: string
): HomePurchaseDraft => {
  const startMonth = input.startMonth ?? fallbackMonth;
  const downPaymentMode = input.downPaymentMode ?? "percent";
  const mortgageTermYears = input.mortgageTermYears ?? 0;
  const feesOneOff =
    input.feesOneOff?.map((fee) => ({
      id: fee.id,
      label: fee.label ?? "",
      amount: fee.amount,
      month: fee.month,
      monthMode: resolveFeeMonthMode(fee.month, startMonth),
    })) ?? [];
  const ongoingCosts =
    input.ongoingCosts?.map((cost) => ({
      id: cost.id,
      label: cost.label ?? "",
      amount: cost.amount,
      startMonth: cost.startMonth,
      endMonth: cost.endMonth ?? "",
      monthMode: resolveOngoingMonthMode(cost.startMonth, startMonth),
    })) ?? [];
  const rentalEnabled = Boolean(input.rental?.enabled);
  const rentalStartMonth = input.rental?.startMonth ?? startMonth;
  const rentalStartStrategy =
    input.rental?.startMonthStrategy ??
    (input.rental?.startMonth ? "custom" : "purchase");

  return {
    startMonth,
    propertyName: input.label ?? "",
    purchasePrice: input.purchasePrice ?? 0,
    downPaymentMode,
    downPaymentPercent:
      downPaymentMode === "percent" ? input.downPaymentPercent ?? 0 : 0,
    downPaymentAmount:
      downPaymentMode === "amount" ? input.downPaymentAmount ?? 0 : 0,
    mortgageRatePct: input.mortgageRatePct ?? 0,
    termMode: "years",
    mortgageTermYears,
    mortgageTermMonths: mortgageTermYears * 12,
    mortgagePayment: input.mortgagePayment ?? 0,
    mortgagePaymentIsEstimated: input.mortgagePaymentIsEstimated ?? true,
    feesOneOff,
    ongoingCosts,
    rentalEnabled,
    rentalMonthly: input.rental?.rentMonthly ?? 0,
    rentalDiscountMonthly: input.rental?.discountMonthly ?? 0,
    rentalStartStrategy,
    rentalStartMonth,
    rentalEndMonth: input.rental?.endMonth ?? "",
    propertyAssetId: input.propertyAssetId ?? `asset_home_${nanoid(6)}`,
    mortgageLiabilityId: input.mortgageLiabilityId ?? `liability_mortgage_${nanoid(6)}`,
    eventId: input.eventId ?? `evt_v2_bundle_${nanoid(6)}`,
  };
};

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

const mergeHomePurchaseEvent = (
  base: ScenarioEventDraft,
  override: ScenarioEventDraft
): ScenarioEventDraft => {
  if (base.type !== "housing" || base.kind !== "mortgage") {
    return override;
  }
  if (override.type !== "housing" || override.kind !== "mortgage") {
    return override;
  }
  return {
    ...base,
    ...override,
    feesOneOff: override.feesOneOff ?? base.feesOneOff,
    ongoingCosts: override.ongoingCosts ?? base.ongoingCosts,
    rental: override.rental ?? base.rental,
    source: {
      ...base.source,
      ...override.source,
    },
  };
};

export default function BundleWizardDrawer({
  opened,
  template,
  mode = "create",
  bundleInstanceId: initialBundleInstanceId = null,
  initialWizardInput = null,
  scenarioId,
  baseMonth,
  baseCurrency,
  scenarioEvents,
  onClose,
  onOpenEventDrawer,
  onApplyEvents,
  allowInlineEdit = true,
  editingEventId = null,
}: BundleWizardDrawerProps) {
  const t = useTranslations("money");
  const validation = useTranslations("validation");
  const locale = useLocale();
  const addEvent = useScenarioStore((state) => state.addEvent);
  const updateEvent = useScenarioStore((state) => state.updateEvent);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [previewEvents, setPreviewEvents] = useState<ScenarioEventDraft[]>([]);
  const [createdEventIds, setCreatedEventIds] = useState<Set<string>>(
    () => new Set()
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [packAsExperiment, setPackAsExperiment] = useState(true);
  const [bundleInstanceId, setBundleInstanceId] = useState(
    () => initialBundleInstanceId ?? `bundle_${nanoid(8)}`
  );
  const scenarioEventIds = useMemo(
    () =>
      new Set(
        scenarioEvents.map((event) => event.id).filter((id): id is string => Boolean(id))
      ),
    [scenarioEvents]
  );

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

  const [homeDraft, setHomeDraft] = useState<HomePurchaseDraft>(() =>
    createHomeDraft(defaultMonth)
  );
  const [marriageDraft, setMarriageDraft] = useState<MarriageDraft>(() => ({
    title: t("bundleMarriageDefaultName"),
    weddingMonth: defaultMonth,
    weddingStyle: "simple_register",
    totalWeddingBudget: 30000,
    breakdownEnabled: false,
    customBreakdown: false,
    breakdownItems: normalizeWeddingBreakdown(
      30000,
      createDefaultWeddingBreakdown(t)
    ),
    includeTravel: false,
    travelMonthMode: "same",
    travelCustomMonth: defaultMonth,
    travelBudgetMode: "total",
    travelTotal: 20000,
    travellersCount: 2,
    perPersonBudget: 10000,
    honeymoonExtraEnabled: false,
    extraTravelMonthMode: "plus1",
    extraTravelCustomMonth: defaultMonth,
    extraTravelBudgetMode: "total",
    extraTravelTotal: 20000,
    extraTravellersCount: 2,
    extraPerPersonBudget: 10000,
    isCustomized: false,
  }));

  const resolvedTemplateId = template?.id ?? initialWizardInput?.templateId ?? null;
  const isNewBabyBundle = resolvedTemplateId === "life_new_baby_plan";
  const isHomeBundle = resolvedTemplateId === "life_home_purchase";
  const isMarriageBundle = resolvedTemplateId === "life_marriage_plan";
  const editingHomeEvent = useMemo(() => {
    if (!editingEventId) {
      return null;
    }
    return (
      scenarioEvents.find((event) => event.id === editingEventId) ?? null
    );
  }, [editingEventId, scenarioEvents]);
  const isEditingHomeBundle =
    mode === "edit" &&
    Boolean(editingHomeEvent) &&
    editingHomeEvent?.type === "housing" &&
    editingHomeEvent.kind === "mortgage" &&
    isHomeBundle;

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
    setDismissedMortgageWarning(false);
    setPendingMarriagePreset(null);
    if (mode === "edit") {
      setBundleInstanceId(
        initialBundleInstanceId ??
          editingHomeEvent?.source?.bundleInstanceId ??
          `bundle_${nanoid(8)}`
      );
    } else {
      setBundleInstanceId(`bundle_${nanoid(8)}`);
    }
    if (initialWizardInput?.templateId === "life_new_baby_plan") {
      setNewBabyDraft(
        hydrateNewBabyDraftFromInput(initialWizardInput.input, defaultMonth)
      );
    } else {
      setNewBabyDraft((current) => ({
        ...current,
        birthMonth: defaultMonth || current.birthMonth,
        schoolingStartMonth: defaultMonth || current.schoolingStartMonth,
      }));
    }
    if (initialWizardInput?.templateId === "life_home_purchase") {
      setHomeDraft(
        hydrateHomeDraftFromInput(initialWizardInput.input, defaultMonth)
      );
    } else if (isEditingHomeBundle && editingHomeEvent) {
      setHomeDraft(hydrateHomeDraftFromEvent(editingHomeEvent, defaultMonth));
    } else {
      setHomeDraft((current) => ({
        ...createHomeDraft(defaultMonth || current.startMonth),
        startMonth: defaultMonth || current.startMonth,
      }));
    }
    setMarriageDraft((current) => ({
      ...current,
      title: t("bundleMarriageDefaultName"),
      weddingMonth: defaultMonth || current.weddingMonth,
      travelCustomMonth: defaultMonth || current.travelCustomMonth,
      isCustomized: false,
    }));
  }, [
    defaultMonth,
    editingHomeEvent,
    initialBundleInstanceId,
    initialWizardInput,
    isEditingHomeBundle,
    mode,
    opened,
    resolvedTemplateId,
    t,
  ]);

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
  const mortgageEventId = useMemo(() => {
    const match = scenarioEvents.find(
      (event) => event.type === "housing" && event.kind === "mortgage"
    );
    return match?.id ?? null;
  }, [scenarioEvents]);

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

  const [dismissedMortgageWarning, setDismissedMortgageWarning] = useState(false);
  const [pendingMarriagePreset, setPendingMarriagePreset] = useState<{
    kind: "destination" | "honeymoon";
    id: string;
  } | null>(null);

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
      if (hasMortgageEvent && !dismissedMortgageWarning) {
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
    dismissedMortgageWarning,
    t,
  ]);

  const nextHomeIndex = useMemo(() => {
    const existingHomes = scenarioEvents.filter(
      (event) => event.type === "housing" && event.kind === "mortgage"
    ).length;
    return existingHomes + 1;
  }, [scenarioEvents]);

  const resolvedHomeLabel = useMemo(() => {
    const trimmed = homeDraft.propertyName.trim();
    return trimmed || t("bundleHomeDefaultName", { index: nextHomeIndex });
  }, [homeDraft.propertyName, nextHomeIndex, t]);

  const feeTemplates = useMemo(
    () => [
      { key: "commission", label: t("bundleHomeFeeCommission") },
      { key: "stampDuty", label: t("bundleHomeFeeStampDuty") },
      { key: "legal", label: t("bundleHomeFeeLegal") },
      { key: "renovation", label: t("bundleHomeFeeRenovation") },
      { key: "furniture", label: t("bundleHomeFeeFurniture") },
      { key: "moving", label: t("bundleHomeFeeMoving") },
    ],
    [t]
  );

  const ongoingCostTemplates = useMemo(
    () => [
      { key: "management", label: t("bundleHomeOngoingManagement") },
      { key: "rates", label: t("bundleHomeOngoingRates") },
      { key: "insurance", label: t("bundleHomeOngoingInsurance") },
      { key: "maintenance", label: t("bundleHomeOngoingMaintenance") },
    ],
    [t]
  );

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

  const buildWizardInput = (): BundleWizardInput | null => {
    if (!resolvedTemplateId) {
      return null;
    }
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
      return {
        templateId: resolvedTemplateId,
        input,
      };
    }
    if (isHomeBundle) {
      const termMonths =
        homeDraft.termMode === "years"
          ? homeDraft.mortgageTermYears * 12
          : homeDraft.mortgageTermMonths;
      const input: HomePurchaseBundleInput = {
        eventId: homeDraft.eventId,
        bundleId: bundleInstanceId,
        label: resolvedHomeLabel,
        startMonth: homeDraft.startMonth,
        purchasePrice: homeDraft.purchasePrice,
        downPaymentMode: homeDraft.downPaymentMode,
        downPaymentPercent: homeDraft.downPaymentPercent,
        downPaymentAmount: homeDraft.downPaymentAmount,
        mortgageRatePct: homeDraft.mortgageRatePct,
        mortgageTermYears:
          homeDraft.termMode === "years" ? homeDraft.mortgageTermYears : termMonths / 12,
        mortgagePayment: homeDraft.mortgagePayment,
        mortgagePaymentIsEstimated: homeDraft.mortgagePaymentIsEstimated,
        feesOneOff: homeDraft.feesOneOff.map((fee) => ({
          id: fee.id,
          label: fee.label || undefined,
          amount: fee.amount,
          month: resolveFeeMonth(fee),
        })),
        ongoingCosts: homeDraft.ongoingCosts.map((cost) => ({
          id: cost.id,
          label: cost.label || undefined,
          amount: cost.amount,
          startMonth: resolveOngoingStartMonth(cost),
          endMonth: cost.endMonth || undefined,
        })),
        rental: homeDraft.rentalEnabled
          ? {
              enabled: true,
              rentMonthly: homeDraft.rentalMonthly,
              discountMonthly: homeDraft.rentalDiscountMonthly,
              startMonth: homeDraft.rentalStartMonth,
              startMonthStrategy: homeDraft.rentalStartStrategy,
              endMonth: homeDraft.rentalEndMonth || undefined,
            }
          : undefined,
        propertyAssetId: homeDraft.propertyAssetId,
        mortgageLiabilityId: homeDraft.mortgageLiabilityId,
      };
      return {
        templateId: resolvedTemplateId,
        input,
      };
    }
    if (isMarriageBundle) {
      const input: MarriagePlanInput = {
        title: marriageDraft.title,
        weddingMonth: marriageDraft.weddingMonth,
        weddingStyle: marriageDraft.weddingStyle,
        totalWeddingBudget: marriageDraft.totalWeddingBudget,
        breakdownEnabled: marriageDraft.breakdownEnabled,
        breakdownItems: marriageDraft.breakdownItems,
        includeTravel: marriageDraft.includeTravel,
        travelLabel:
          marriageDraft.weddingStyle === "destination_wedding"
            ? t("bundleMarriageDestinationTravelLabel")
            : t("bundleMarriageTravelLabel"),
        travelMonthMode: marriageDraft.travelMonthMode,
        travelCustomMonth: marriageDraft.travelCustomMonth,
        travelBudgetMode: marriageDraft.travelBudgetMode,
        travelTotal: marriageDraft.travelTotal,
        travellersCount: marriageDraft.travellersCount,
        perPersonBudget: marriageDraft.perPersonBudget,
        extraHoneymoonEnabled:
          marriageDraft.weddingStyle === "destination_wedding" &&
          marriageDraft.honeymoonExtraEnabled,
        extraTravelLabel: t("bundleMarriageTravelLabel"),
        extraTravelMonthMode: marriageDraft.extraTravelMonthMode,
        extraTravelCustomMonth: marriageDraft.extraTravelCustomMonth,
        extraTravelBudgetMode: marriageDraft.extraTravelBudgetMode,
        extraTravelTotal: marriageDraft.extraTravelTotal,
        extraTravellersCount: marriageDraft.extraTravellersCount,
        extraPerPersonBudget: marriageDraft.extraPerPersonBudget,
      };
      return {
        templateId: resolvedTemplateId,
        input,
      };
    }
    return null;
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
      const experimentTitle = resolvedTemplateId
        ? t(`templates.${resolvedTemplateId}.name`)
        : undefined;
      const wizardInput = buildWizardInput();
      const result = await onApplyEvents(drafts, {
        packAsExperiment,
        experimentTitle,
      }, wizardInput ? { bundleInstanceId, wizardInput } : undefined);
      if (!result.ok) {
        setActionError(result.error ?? t("bundleApplyFailed"));
        return;
      }
      onClose();
      return;
    }
    for (const event of drafts) {
      if (event.id && scenarioEventIds.has(event.id)) {
        const result = updateEvent(event.id, event, scenarioId ?? undefined);
        if (!result.ok) {
          setActionError(t("bundleApplyFailed"));
          return;
        }
      } else {
        const result = addEvent(event, scenarioId ?? undefined);
        if (!result.ok) {
          setActionError(t("bundleApplyFailed"));
          return;
        }
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
        const events = buildNewBabyBundleEvents(
          input,
          {
            deliveryCost: t("bundleNewBabyDelivery"),
            childcare: t("bundleNewBabyChildcare"),
            helperMonthly: t("bundleNewBabyHelperMonthly"),
            agencyFee: t("bundleNewBabyAgencyFee"),
            schooling: t("bundleNewBabySchooling"),
          },
          {
            bundleInstanceId,
            templateId: resolvedTemplateId ?? "life_new_baby_plan",
            bundleTitle: t("bundleNewBabyDefaultName"),
          }
        );
        setPreviewEvents(events);
      }
      if (isHomeBundle) {
        const termMonths =
          homeDraft.termMode === "years"
            ? homeDraft.mortgageTermYears * 12
            : homeDraft.mortgageTermMonths;
        const input: HomePurchaseBundleInput = {
          eventId: homeDraft.eventId,
          bundleId: bundleInstanceId,
          label: resolvedHomeLabel,
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
              month: resolveFeeMonth(fee),
            })),
          ongoingCosts: homeDraft.ongoingCosts
            .filter((cost) => cost.amount > 0)
            .map((cost) => ({
              id: cost.id,
              label: cost.label || undefined,
              amount: cost.amount,
              startMonth: resolveOngoingStartMonth(cost),
              endMonth: cost.endMonth || undefined,
            })),
          rental: homeDraft.rentalEnabled
            ? {
                enabled: true,
                rentMonthly: homeDraft.rentalMonthly,
                discountMonthly: homeDraft.rentalDiscountMonthly,
                startMonth: homeDraft.rentalStartMonth,
                startMonthStrategy: homeDraft.rentalStartStrategy,
                endMonth: homeDraft.rentalEndMonth || undefined,
              }
            : undefined,
          propertyAssetId: homeDraft.propertyAssetId,
          mortgageLiabilityId: homeDraft.mortgageLiabilityId,
        };
        const nextEvent = buildHomePurchaseBundleEvent(
          input,
          {
            bundleInstanceId,
            templateId: resolvedTemplateId ?? "life_home_purchase",
            bundleTitle: resolvedHomeLabel,
          }
        );
        setPreviewEvents([
          isEditingHomeBundle && editingHomeEvent && !initialWizardInput
            ? mergeHomePurchaseEvent(editingHomeEvent, nextEvent)
            : nextEvent,
        ]);
      }
      if (isMarriageBundle) {
        const input: MarriagePlanInput = {
          title: marriageDraft.title,
          weddingMonth: marriageDraft.weddingMonth,
          weddingStyle: marriageDraft.weddingStyle,
          totalWeddingBudget: marriageDraft.totalWeddingBudget,
          breakdownEnabled: marriageDraft.breakdownEnabled,
          breakdownItems: marriageDraft.breakdownItems,
          includeTravel: marriageDraft.includeTravel,
          travelLabel:
            marriageDraft.weddingStyle === "destination_wedding"
              ? t("bundleMarriageDestinationTravelLabel")
              : t("bundleMarriageTravelLabel"),
          travelMonthMode: marriageDraft.travelMonthMode,
          travelCustomMonth: marriageDraft.travelCustomMonth,
          travelBudgetMode: marriageDraft.travelBudgetMode,
          travelTotal: marriageDraft.travelTotal,
          travellersCount: marriageDraft.travellersCount,
          perPersonBudget: marriageDraft.perPersonBudget,
          extraHoneymoonEnabled:
            marriageDraft.weddingStyle === "destination_wedding" &&
            marriageDraft.honeymoonExtraEnabled,
          extraTravelLabel: t("bundleMarriageTravelLabel"),
          extraTravelMonthMode: marriageDraft.extraTravelMonthMode,
          extraTravelCustomMonth: marriageDraft.extraTravelCustomMonth,
          extraTravelBudgetMode: marriageDraft.extraTravelBudgetMode,
          extraTravelTotal: marriageDraft.extraTravelTotal,
          extraTravellersCount: marriageDraft.extraTravellersCount,
          extraPerPersonBudget: marriageDraft.extraPerPersonBudget,
        };
        setPreviewEvents(
          buildMarriageBundleEvents(
            input,
            {
              weddingMain: marriageDraft.title || t("bundleMarriageDefaultName"),
              travel: t("bundleMarriageTravelLabel"),
            },
            {
              bundleInstanceId,
              templateId: resolvedTemplateId ?? "life_marriage_plan",
              bundleTitle: marriageDraft.title || t("bundleMarriageDefaultName"),
            }
          )
        );
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
    if (homeDraft.rentalEnabled && homeDraft.rentalStartStrategy === "custom") {
      const rentalMonthResult = normalizeMonthValue(homeDraft.rentalStartMonth);
      if (rentalMonthResult.error) {
        errors.rentalStartMonth =
          rentalMonthResult.error === "empty"
            ? t("bundleMonthRequired")
            : validation("useYearMonth");
      }
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
    if (isMarriageBundle) {
      const nextErrors: Record<string, string> = {};
      const monthResult = normalizeMonthValue(marriageDraft.weddingMonth);
      if (monthResult.error) {
        nextErrors.weddingMonth =
          monthResult.error === "empty"
            ? t("bundleMonthRequired")
            : validation("useYearMonth");
      }
      if (marriageDraft.includeTravel && marriageDraft.travelMonthMode === "custom") {
        const travelMonthResult = normalizeMonthValue(marriageDraft.travelCustomMonth);
        if (travelMonthResult.error) {
          nextErrors.travelCustomMonth =
            travelMonthResult.error === "empty"
              ? t("bundleMonthRequired")
              : validation("useYearMonth");
        }
      }
      if (
        marriageDraft.weddingStyle === "destination_wedding" &&
        marriageDraft.honeymoonExtraEnabled &&
        marriageDraft.extraTravelMonthMode === "custom"
      ) {
        const extraTravelMonthResult = normalizeMonthValue(
          marriageDraft.extraTravelCustomMonth
        );
        if (extraTravelMonthResult.error) {
          nextErrors.extraTravelCustomMonth =
            extraTravelMonthResult.error === "empty"
              ? t("bundleMonthRequired")
              : validation("useYearMonth");
        }
      }
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        return;
      }
    }
    handleNext();
  };

  const helperCostMonthNormalize = (value: string) => {
    const normalized = normalizeMonthValue(value);
    return normalized.value;
  };

  const resolveFeeMonth = (fee: FeeDraft) => {
    if (fee.monthMode === "custom") {
      return fee.month;
    }
    if (!isValidMonthKey(homeDraft.startMonth)) {
      return fee.month;
    }
    if (fee.monthMode === "plus1") {
      return addMonths(homeDraft.startMonth, 1);
    }
    return homeDraft.startMonth;
  };

  const resolveOngoingStartMonth = (cost: OngoingCostDraft) => {
    if (cost.monthMode === "custom") {
      return cost.startMonth;
    }
    if (!isValidMonthKey(homeDraft.startMonth)) {
      return cost.startMonth;
    }
    if (cost.monthMode === "plus1") {
      return addMonths(homeDraft.startMonth, 1);
    }
    return homeDraft.startMonth;
  };

  const resolvedRentalStartMonth = useMemo(() => {
    if (!isValidMonthKey(homeDraft.startMonth)) {
      return homeDraft.rentalStartMonth;
    }
    return deriveStartMonth(
      homeDraft.startMonth,
      homeDraft.rentalStartStrategy,
      homeDraft.rentalStartMonth
    );
  }, [
    homeDraft.rentalStartMonth,
    homeDraft.rentalStartStrategy,
    homeDraft.startMonth,
  ]);

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

  const recomputeMarriageBreakdown = () => {
    setMarriageDraft((current) => ({
      ...current,
      customBreakdown: false,
      breakdownItems: normalizeWeddingBreakdown(
        current.totalWeddingBudget,
        current.breakdownItems
      ),
    }));
  };

  const travelTotalPreview = computeTravelTotal({
    mode: marriageDraft.travelBudgetMode,
    total: marriageDraft.travelTotal,
    count: marriageDraft.travellersCount,
    perPerson: marriageDraft.perPersonBudget,
  });
  const extraTravelTotalPreview = computeTravelTotal({
    mode: marriageDraft.extraTravelBudgetMode,
    total: marriageDraft.extraTravelTotal,
    count: marriageDraft.extraTravellersCount,
    perPerson: marriageDraft.extraPerPersonBudget,
  });

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

  useEffect(() => {
    if (!estimatedPayment || !homeDraft.mortgagePaymentIsEstimated) {
      return;
    }
    const rounded = Math.round(estimatedPayment);
    setHomeDraft((current) => {
      if (!current.mortgagePaymentIsEstimated) {
        return current;
      }
      if (current.mortgagePayment === rounded) {
        return current;
      }
      return {
        ...current,
        mortgagePayment: rounded,
      };
    });
  }, [estimatedPayment, homeDraft.mortgagePaymentIsEstimated]);

  useEffect(() => {
    if (!homeDraft.startMonth) {
      return;
    }
    setHomeDraft((current) => {
      let didUpdate = false;
      const nextFees = current.feesOneOff.map((fee) => {
        if (fee.monthMode !== "custom" || fee.month) {
          return fee;
        }
        didUpdate = true;
        return { ...fee, month: homeDraft.startMonth };
      });
      if (!didUpdate) {
        return current;
      }
      return {
        ...current,
        feesOneOff: nextFees,
      };
    });
  }, [homeDraft.startMonth]);

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
                const raw = event.currentTarget.value;
                const result = normalizeMonthValue(raw);
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
                        const raw = event.currentTarget.value;
                        const value = helperCostMonthNormalize(raw);
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
                const raw = event.currentTarget.value;
                const normalized = normalizeMonthValue(raw);
                setHomeDraft((current) => ({
                  ...current,
                  startMonth: normalized.value,
                }));
              }}
            />
            <TextInput
              label={t("bundleHomeNameLabel")}
              placeholder={t("bundleHomeNamePlaceholder")}
              value={homeDraft.propertyName}
              onChange={(event) => {
                const v = event.currentTarget.value;
                setHomeDraft((current) => ({
                  ...current,
                  propertyName: v,
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
            <Text size="xs" c="dimmed">
              {t("bundleHomeDownPaymentSummary", {
                downPayment: formatCurrency(downPaymentAmount, baseCurrency, locale),
                loanAmount: formatCurrency(loanAmount, baseCurrency, locale),
              })}
            </Text>
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
              <Switch
                checked={homeDraft.mortgagePaymentIsEstimated}
                label={t("bundleHomeMortgageAutoToggle")}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setHomeDraft((current) => ({
                    ...current,
                    mortgagePaymentIsEstimated: checked,
                    mortgagePayment:
                      checked && estimatedPayment
                        ? Math.round(estimatedPayment)
                        : current.mortgagePayment,
                  }));
                }}
              />
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
              {!homeDraft.mortgagePaymentIsEstimated && (
                <Text size="xs" c="dimmed">
                  {t("bundleHomeMortgageManualHint")}
                </Text>
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
                        feesOneOff: [
                          ...current.feesOneOff,
                          createFeeDraft({ month: homeDraft.startMonth }),
                        ],
                      }))
                    }
                  >
                    {t("bundleAddFee")}
                  </Button>
                </Group>
                <Stack gap={6}>
                  <Text size="xs" c="dimmed">
                    {t("bundleHomeFeeQuickAdd")}
                  </Text>
                  <Group gap="xs" wrap="wrap">
                    {feeTemplates.map((template) => (
                      <Button
                        key={template.key}
                        variant="light"
                        size="xs"
                        onClick={() =>
                          setHomeDraft((current) => ({
                            ...current,
                            feesOneOff: [
                              ...current.feesOneOff,
                              createFeeDraft({
                                label: template.label,
                                month: homeDraft.startMonth,
                              }),
                            ],
                          }))
                        }
                      >
                        {template.label}
                      </Button>
                    ))}
                  </Group>
                </Stack>
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
                          onChange={(event) => {
                            const v = event.currentTarget.value;
                            updateFees(fee.id, { label: v });
                          }}
                        />
                        <NumberInput
                          label={t("bundleFeeAmount")}
                          min={0}
                          value={fee.amount}
                          onChange={(value) =>
                            updateFees(fee.id, { amount: Number(value) || 0 })
                          }
                        />
                        <Stack gap={4}>
                          <Text size="xs" c="dimmed">
                            {t("bundleFeeMonthLabel")}
                          </Text>
                          <SegmentedControl
                            size="xs"
                            value={fee.monthMode}
                            onChange={(value) =>
                              updateFees(fee.id, {
                                monthMode:
                                  value === "plus1" || value === "custom"
                                    ? value
                                    : "purchase",
                              })
                            }
                            data={[
                              { value: "purchase", label: t("bundleFeeMonthSame") },
                              { value: "plus1", label: t("bundleFeeMonthPlusOne") },
                              { value: "custom", label: t("bundleFeeMonthCustom") },
                            ]}
                          />
                          {fee.monthMode === "custom" && (
                            <MonthField
                              label={t("bundleFeeMonth")}
                              value={fee.month}
                              onChange={(value) => updateFees(fee.id, { month: value })}
                              onBlur={(event) => {
                                const raw = event.currentTarget.value;
                                updateFees(fee.id, {
                                  month: helperCostMonthNormalize(raw),
                                });
                              }}
                            />
                          )}
                        </Stack>
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
                <Stack gap={6}>
                  <Text size="xs" c="dimmed">
                    {t("bundleHomeOngoingQuickAdd")}
                  </Text>
                  <Group gap="xs" wrap="wrap">
                    {ongoingCostTemplates.map((template) => (
                      <Button
                        key={template.key}
                        variant="light"
                        size="xs"
                        onClick={() =>
                          setHomeDraft((current) => ({
                            ...current,
                            ongoingCosts: [
                              ...current.ongoingCosts,
                              createOngoingCostDraft(),
                            ].map((item, index, array) =>
                              index === array.length - 1
                                ? {
                                    ...item,
                                    label: template.label,
                                    startMonth: current.startMonth,
                                    monthMode: "purchase",
                                  }
                                : item
                            ),
                          }))
                        }
                      >
                        {template.label}
                      </Button>
                    ))}
                  </Group>
                </Stack>
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
                          onChange={(event) => {
                            const v = event.currentTarget.value;
                            updateOngoingCosts(cost.id, {
                              label: v,
                            });
                          }}
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
                        <Stack gap={4}>
                          <Text size="xs" c="dimmed">
                            {t("bundleOngoingMonthLabel")}
                          </Text>
                          <SegmentedControl
                            size="xs"
                            value={cost.monthMode}
                            onChange={(value) =>
                              updateOngoingCosts(cost.id, {
                                monthMode:
                                  value === "plus1" || value === "custom"
                                    ? value
                                    : "purchase",
                              })
                            }
                            data={[
                              { value: "purchase", label: t("bundleOngoingMonthSame") },
                              { value: "plus1", label: t("bundleOngoingMonthPlusOne") },
                              { value: "custom", label: t("bundleOngoingMonthCustom") },
                            ]}
                          />
                          {cost.monthMode === "custom" && (
                            <MonthField
                              label={t("bundleOngoingStartMonth")}
                              value={cost.startMonth}
                              onChange={(value) =>
                                updateOngoingCosts(cost.id, {
                                  startMonth: value,
                                })
                              }
                              onBlur={(event) => {
                                const raw = event.currentTarget.value;
                                updateOngoingCosts(cost.id, {
                                  startMonth: helperCostMonthNormalize(raw),
                                });
                              }}
                            />
                          )}
                        </Stack>
                        <MonthField
                          label={t("bundleOngoingEndMonth")}
                          value={cost.endMonth}
                          onChange={(value) =>
                            updateOngoingCosts(cost.id, {
                              endMonth: value,
                            })
                          }
                          onBlur={(event) => {
                            const raw = event.currentTarget.value;
                            updateOngoingCosts(cost.id, {
                              endMonth: helperCostMonthNormalize(raw),
                            });
                          }}
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
                    setHomeDraft((current) => {
                      return {
                        ...current,
                        rentalEnabled: event?.target?.checked ?? false,
                      }
                    })
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
                    <Stack gap={4}>
                      <Text size="xs" c="dimmed">
                        {t("bundleHomeRentalStartStrategy")}
                      </Text>
                      <SegmentedControl
                        size="xs"
                        value={homeDraft.rentalStartStrategy}
                        onChange={(value) =>
                          setHomeDraft((current) => ({
                            ...current,
                            rentalStartStrategy:
                              value === "plus1" || value === "custom"
                                ? value
                                : "purchase",
                          }))
                        }
                        data={[
                          { value: "purchase", label: t("bundleOngoingMonthSame") },
                          { value: "plus1", label: t("bundleOngoingMonthPlusOne") },
                          { value: "custom", label: t("bundleOngoingMonthCustom") },
                        ]}
                      />
                    </Stack>
                    {homeDraft.rentalStartStrategy === "custom" ? (
                      <MonthField
                        label={t("bundleHomeRentalStartMonth")}
                        value={homeDraft.rentalStartMonth}
                        onChange={(value) =>
                          setHomeDraft((current) => ({
                            ...current,
                            rentalStartMonth: value,
                          }))
                        }
                        onKeyDown={(event) => event.preventDefault()}
                        onPaste={(event) => event.preventDefault()}
                        error={errors.rentalStartMonth}
                      />
                    ) : (
                      <MonthField
                        label={t("bundleHomeRentalStartMonth")}
                        value={resolvedRentalStartMonth}
                        onChange={() => {}}
                        disabled
                      />
                    )}
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

        {isMarriageBundle && step === 0 && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("bundleMarriageIntro")}
            </Text>
            <TextInput
              label={t("bundleMarriageTitle")}
              value={marriageDraft.title}
              onChange={(event) =>
                setMarriageDraft((current) => ({ ...current, title: event.currentTarget.value }))
              }
            />
            <MonthField
              label={t("bundleMarriageMonth")}
              value={marriageDraft.weddingMonth}
              error={errors.weddingMonth}
              onChange={(value) =>
                setMarriageDraft((current) => ({ ...current, weddingMonth: value }))
              }
            />
          </Stack>
        )}

        {isMarriageBundle && step === 1 && (
          <Stack gap="md">
            <SegmentedControl
              value={marriageDraft.weddingStyle}
              onChange={(value) => {
                const style = value as WeddingStyle;
                setMarriageDraft((current) => {
                  const budgetPreset: Partial<Record<WeddingStyle, number>> = {
                    simple_register: 30000,
                    small_banquet: 120000,
                    hotel_banquet: 300000,
                    luxury_wedding: 600000,
                  };
                  const nextBudget = budgetPreset[style] ?? current.totalWeddingBudget;
                  const nextIncludeTravel =
                    style === "destination_wedding" ? true : current.includeTravel;
                  const shouldResetToHoneymoon =
                    current.weddingStyle === "destination_wedding" &&
                    style !== "destination_wedding" &&
                    nextIncludeTravel;
                  return {
                    ...current,
                    weddingStyle: style,
                    includeTravel: nextIncludeTravel,
                    travelBudgetMode: shouldResetToHoneymoon ? "perPerson" : current.travelBudgetMode,
                    travelMonthMode: shouldResetToHoneymoon ? "plus1" : current.travelMonthMode,
                    travellersCount: shouldResetToHoneymoon ? 2 : current.travellersCount,
                    perPersonBudget: shouldResetToHoneymoon
                      ? 12000
                      : current.perPersonBudget,
                    totalWeddingBudget: nextBudget,
                    breakdownItems:
                      current.breakdownEnabled && !current.customBreakdown
                        ? normalizeWeddingBreakdown(nextBudget, current.breakdownItems)
                        : current.breakdownItems,
                    isCustomized: true,
                  };
                });
              }}
              data={[
                { value: "simple_register", label: t("bundleMarriageStyleSimple") },
                { value: "small_banquet", label: t("bundleMarriageStyleSmall") },
                { value: "hotel_banquet", label: t("bundleMarriageStyleHotel") },
                { value: "luxury_wedding", label: t("bundleMarriageStyleLuxury") },
                { value: "destination_wedding", label: t("bundleMarriageStyleDestination") },
              ]}
            />
            <Text size="xs" c="dimmed">
              {t("bundleMarriagePresetQuickHint")}
            </Text>
            <NumberInput
              label={t("bundleMarriageBudget")}
              min={0}
              value={marriageDraft.totalWeddingBudget}
              onChange={(value) =>
                setMarriageDraft((current) => ({
                  ...current,
                  totalWeddingBudget: Number(value) || 0,
                  isCustomized: true,
                  breakdownItems: current.customBreakdown
                    ? current.breakdownItems
                    : normalizeWeddingBreakdown(Number(value) || 0, current.breakdownItems),
                }))
              }
            />
            <Switch
              checked={marriageDraft.breakdownEnabled}
              label={t("bundleMarriageBreakdownToggle")}
              onChange={(event) =>
                setMarriageDraft((current) => ({
                  ...current,
                  breakdownEnabled: event.target.checked,
                  isCustomized: true,
                  breakdownItems: normalizeWeddingBreakdown(
                    current.totalWeddingBudget,
                    current.breakdownItems
                  ),
                }))
              }
            />
            {marriageDraft.breakdownEnabled && (
              <Stack gap="xs">
                {marriageDraft.customBreakdown && (
                  <Button size="xs" variant="light" onClick={recomputeMarriageBreakdown}>
                    {t("bundleMarriageRecompute")}
                  </Button>
                )}
                {marriageDraft.breakdownItems.map((item) => (
                  <Group key={item.id} grow>
                    <TextInput
                      value={item.label}
                      onChange={(event) =>
                        setMarriageDraft((current) => ({
                          ...current,
                          customBreakdown: true,
                          isCustomized: true,
                          breakdownItems: current.breakdownItems.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, label: event.currentTarget.value }
                              : entry
                          ),
                        }))
                      }
                    />
                    <NumberInput
                      min={0}
                      value={item.amount}
                      onChange={(value) =>
                        setMarriageDraft((current) => ({
                          ...current,
                          customBreakdown: true,
                          isCustomized: true,
                          breakdownItems: current.breakdownItems.map((entry) =>
                            entry.id === item.id
                              ? { ...entry, amount: Number(value) || 0 }
                              : entry
                          ),
                        }))
                      }
                    />
                  </Group>
                ))}
              </Stack>
            )}
            <Switch
              checked={marriageDraft.includeTravel}
              label={
                marriageDraft.weddingStyle === "destination_wedding"
                  ? t("bundleMarriageTravelToggleDestination")
                  : t("bundleMarriageTravelToggle")
              }
              onChange={(event) =>
                setMarriageDraft((current) => ({
                  ...current,
                  includeTravel: event.target.checked,
                  isCustomized: true,
                }))
              }
            />
            {marriageDraft.weddingStyle === "destination_wedding" && (
              <Alert color="blue" title={t("bundleMarriageDestinationGuardrailTitle")}>
                <Text size="sm">{t("bundleMarriageDestinationGuardrailBody")}</Text>
              </Alert>
            )}
            {marriageDraft.includeTravel && (
              <Stack gap="xs">
                <Stack gap={6}>
                  <Text size="xs" c="dimmed">
                    {marriageDraft.weddingStyle === "destination_wedding"
                      ? t("bundleMarriagePresetDestination")
                      : t("bundleMarriagePresetHoneymoon")}
                  </Text>
                  <Group gap="xs">
                    {(marriageDraft.weddingStyle === "destination_wedding"
                      ? DESTINATION_WEDDING_PRESETS
                      : HONEYMOON_PRESETS
                    ).map((preset) => (
                      <Button
                        key={preset.id}
                        size="xs"
                        variant={
                          marriageDraft.weddingStyle === "destination_wedding"
                            ? "default"
                            : "light"
                        }
                        onClick={() => {
                          const result =
                            marriageDraft.weddingStyle === "destination_wedding"
                              ? applyTravelPresetToForm(marriageDraft, preset.id)
                              : applyHoneymoonPresetToForm(marriageDraft, preset.id);
                          if (result.needsConfirm) {
                            setPendingMarriagePreset({
                              kind:
                                marriageDraft.weddingStyle === "destination_wedding"
                                  ? "destination"
                                  : "honeymoon",
                              id: preset.id,
                            });
                            return;
                          }
                          setMarriageDraft((current) => ({ ...current, ...result.draft }));
                        }}
                      >
                        {t(preset.labelKey)}
                      </Button>
                    ))}
                  </Group>
                </Stack>
                <SegmentedControl
                  value={marriageDraft.travelBudgetMode}
                  onChange={(value) =>
                    setMarriageDraft((current) => ({
                      ...current,
                      travelBudgetMode: value as TravelBudgetMode,
                      isCustomized: true,
                    }))
                  }
                  data={[
                    { value: "total", label: t("bundleMarriageTravelModeTotal") },
                    { value: "perPerson", label: t("bundleMarriageTravelModePerPerson") },
                  ]}
                />
                {marriageDraft.travelBudgetMode === "total" ? (
                  <NumberInput
                    label={t("bundleMarriageTravelTotal")}
                    min={0}
                    value={marriageDraft.travelTotal}
                    onChange={(value) =>
                      setMarriageDraft((current) => ({
                        ...current,
                        travelTotal: Number(value) || 0,
                        isCustomized: true,
                      }))
                    }
                  />
                ) : (
                  <Group grow>
                    <NumberInput
                      label={t("bundleMarriageTravelCount")}
                      min={1}
                      value={marriageDraft.travellersCount}
                      onChange={(value) =>
                        setMarriageDraft((current) => ({
                          ...current,
                          travellersCount: Number(value) || 1,
                          isCustomized: true,
                        }))
                      }
                    />
                    <NumberInput
                      label={t("bundleMarriageTravelPerPerson")}
                      min={0}
                      value={marriageDraft.perPersonBudget}
                      onChange={(value) =>
                        setMarriageDraft((current) => ({
                          ...current,
                          perPersonBudget: Number(value) || 0,
                          isCustomized: true,
                        }))
                      }
                    />
                  </Group>
                )}
                <Text size="xs" c="dimmed">
                  {t("bundleMarriageTravelComputed", {
                    total: formatCurrency(travelTotalPreview, baseCurrency, locale),
                  })}
                </Text>
                <SegmentedControl
                  value={marriageDraft.travelMonthMode}
                  onChange={(value) =>
                    setMarriageDraft((current) => ({
                      ...current,
                      travelMonthMode: value as TravelMonthMode,
                      isCustomized: true,
                    }))
                  }
                  data={[
                    { value: "same", label: t("bundleMarriageTravelMonthSame") },
                    { value: "plus1", label: t("bundleMarriageTravelMonthPlusOne") },
                    { value: "custom", label: t("bundleMarriageTravelMonthCustom") },
                  ]}
                />
                {marriageDraft.travelMonthMode === "custom" && (
                  <MonthField
                    label={t("bundleMarriageTravelCustomMonth")}
                    value={marriageDraft.travelCustomMonth}
                    error={errors.travelCustomMonth}
                    onChange={(value) =>
                      setMarriageDraft((current) => ({
                        ...current,
                        travelCustomMonth: value,
                        isCustomized: true,
                      }))
                    }
                  />
                )}
                {marriageDraft.weddingStyle === "destination_wedding" && (
                  <>
                    <Switch
                      checked={marriageDraft.honeymoonExtraEnabled}
                      label={t("bundleMarriageExtraHoneymoonToggle")}
                      onChange={(event) =>
                        setMarriageDraft((current) => ({
                          ...current,
                          honeymoonExtraEnabled: event.target.checked,
                          isCustomized: true,
                        }))
                      }
                    />
                    {marriageDraft.honeymoonExtraEnabled && (
                      <Stack gap="xs">
                        <Text size="xs" c="dimmed">
                          {t("bundleMarriagePresetHoneymoon")}
                        </Text>
                        <Group gap="xs">
                          {HONEYMOON_PRESETS.map((preset) => (
                            <Button
                              key={preset.id}
                              size="xs"
                              variant="light"
                              onClick={() => {
                                const result = applyHoneymoonPresetToForm(
                                  marriageDraft,
                                  preset.id,
                                  true
                                );
                                setMarriageDraft((current) => ({
                                  ...current,
                                  extraTravelBudgetMode: result.draft.travelBudgetMode,
                                  extraTravelMonthMode: result.draft.travelMonthMode,
                                  extraTravelTotal: result.draft.travelTotal,
                                  extraTravellersCount: result.draft.travellersCount,
                                  extraPerPersonBudget: result.draft.perPersonBudget,
                                }));
                              }}
                            >
                              {t(preset.labelKey)}
                            </Button>
                          ))}
                        </Group>
                        <SegmentedControl
                          value={marriageDraft.extraTravelBudgetMode}
                          onChange={(value) =>
                            setMarriageDraft((current) => ({
                              ...current,
                              extraTravelBudgetMode: value as TravelBudgetMode,
                              isCustomized: true,
                            }))
                          }
                          data={[
                            { value: "total", label: t("bundleMarriageTravelModeTotal") },
                            { value: "perPerson", label: t("bundleMarriageTravelModePerPerson") },
                          ]}
                        />
                        {marriageDraft.extraTravelBudgetMode === "total" ? (
                          <NumberInput
                            label={t("bundleMarriageTravelTotal")}
                            min={0}
                            value={marriageDraft.extraTravelTotal}
                            onChange={(value) =>
                              setMarriageDraft((current) => ({
                                ...current,
                                extraTravelTotal: Number(value) || 0,
                                isCustomized: true,
                              }))
                            }
                          />
                        ) : (
                          <Group grow>
                            <NumberInput
                              label={t("bundleMarriageTravelCount")}
                              min={1}
                              value={marriageDraft.extraTravellersCount}
                              onChange={(value) =>
                                setMarriageDraft((current) => ({
                                  ...current,
                                  extraTravellersCount: Number(value) || 1,
                                  isCustomized: true,
                                }))
                              }
                            />
                            <NumberInput
                              label={t("bundleMarriageTravelPerPerson")}
                              min={0}
                              value={marriageDraft.extraPerPersonBudget}
                              onChange={(value) =>
                                setMarriageDraft((current) => ({
                                  ...current,
                                  extraPerPersonBudget: Number(value) || 0,
                                  isCustomized: true,
                                }))
                              }
                            />
                          </Group>
                        )}
                        <Text size="xs" c="dimmed">
                          {t("bundleMarriageTravelComputed", {
                            total: formatCurrency(extraTravelTotalPreview, baseCurrency, locale),
                          })}
                        </Text>
                        <SegmentedControl
                          value={marriageDraft.extraTravelMonthMode}
                          onChange={(value) =>
                            setMarriageDraft((current) => ({
                              ...current,
                              extraTravelMonthMode: value as TravelMonthMode,
                              isCustomized: true,
                            }))
                          }
                          data={[
                            { value: "same", label: t("bundleMarriageTravelMonthSame") },
                            { value: "plus1", label: t("bundleMarriageTravelMonthPlusOne") },
                            { value: "custom", label: t("bundleMarriageTravelMonthCustom") },
                          ]}
                        />
                        {marriageDraft.extraTravelMonthMode === "custom" && (
                          <MonthField
                            label={t("bundleMarriageTravelCustomMonth")}
                            value={marriageDraft.extraTravelCustomMonth}
                            error={errors.extraTravelCustomMonth}
                            onChange={(value) =>
                              setMarriageDraft((current) => ({
                                ...current,
                                extraTravelCustomMonth: value,
                                isCustomized: true,
                              }))
                            }
                          />
                        )}
                      </Stack>
                    )}
                  </>
                )}
              </Stack>
            )}
            {marriageDraft.customBreakdown && (
              <Text size="xs" c="dimmed">
                {t("bundleMarriagePresetBreakdownHint")}
              </Text>
            )}
            <Text size="sm" fw={500}>
              {t("bundleMarriageStepSummary", {
                wedding: formatCurrency(marriageDraft.totalWeddingBudget, baseCurrency, locale),
                travel:
                  marriageDraft.includeTravel &&
                  (travelTotalPreview > 0 || extraTravelTotalPreview > 0)
                    ? formatCurrency(
                        travelTotalPreview +
                          (marriageDraft.weddingStyle === "destination_wedding" &&
                          marriageDraft.honeymoonExtraEnabled
                            ? extraTravelTotalPreview
                            : 0),
                        baseCurrency,
                        locale
                      )
                    : formatCurrency(0, baseCurrency, locale),
              })}
            </Text>
            {pendingMarriagePreset && (
              <Alert color="yellow" title={t("bundleMarriagePresetConfirmTitle")}>
                <Stack gap="xs">
                  <Text size="sm">{t("bundleMarriagePresetConfirmBody")}</Text>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      onClick={() => {
                        const result =
                          pendingMarriagePreset.kind === "destination"
                            ? applyTravelPresetToForm(marriageDraft, pendingMarriagePreset.id, true)
                            : applyHoneymoonPresetToForm(
                                marriageDraft,
                                pendingMarriagePreset.id,
                                true
                              );
                        setMarriageDraft((current) => ({ ...current, ...result.draft }));
                        setPendingMarriagePreset(null);
                      }}
                    >
                      {t("bundleMarriagePresetConfirmApply")}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={() => setPendingMarriagePreset(null)}>
                      {t("bundleCancel")}
                    </Button>
                  </Group>
                </Stack>
              </Alert>
            )}
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
                  {isHomeBundle && hasMortgageEvent && !dismissedMortgageWarning && (
                    <Group gap="xs" mt="xs">
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => {
                          if (mortgageEventId && onOpenEventDrawer) {
                            onOpenEventDrawer("housing", mortgageEventId);
                          }
                        }}
                      >
                        {t("bundleHomeWarningMortgageView")}
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => setDismissedMortgageWarning(true)}
                      >
                        {t("bundleHomeWarningMortgageContinue")}
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Alert>
            )}
            {previewEvents.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t("bundleReviewEmpty")}
              </Text>
            ) : (
              <Stack gap="sm">
                {isHomeBundle && (
                  <Card withBorder radius="md" padding="sm">
                    <Stack gap={4}>
                      <Text fw={600}>{resolvedHomeLabel}</Text>
                      <Text size="sm" c="dimmed">
                        {t("bundleHomePreviewAsset", { name: resolvedHomeLabel })}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {t("bundleHomePreviewLiability", { name: resolvedHomeLabel })}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {t("bundleHomePreviewCashflow", { name: resolvedHomeLabel })}
                      </Text>
                      {homeDraft.feesOneOff.some((fee) => fee.amount > 0) && (
                        <Stack gap={2} mt="xs">
                          <Text size="xs" c="dimmed">
                            {t("bundleHomePreviewFeesTitle")}
                          </Text>
                          {homeDraft.feesOneOff
                            .filter((fee) => fee.amount > 0)
                            .map((fee) => (
                              <Text size="xs" c="dimmed" key={fee.id}>
                                {t("bundleHomePreviewFeeItem", {
                                  name: fee.label || t("bundleFeeUntitled"),
                                  amount: formatCurrency(
                                    fee.amount,
                                    baseCurrency,
                                    locale
                                  ),
                                  month: resolveFeeMonth(fee) || "-",
                                })}
                              </Text>
                            ))}
                        </Stack>
                      )}
                    </Stack>
                  </Card>
                )}
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
