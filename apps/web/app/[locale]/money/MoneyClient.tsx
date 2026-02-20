"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Modal,
  Notification,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { monthIndex } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HomeDetailsForm from "../../../components/timeline/HomeDetailsForm";
import CarDetailsForm from "../../../components/timeline/CarDetailsForm";
import InvestmentDetailsForm from "../../../components/timeline/InvestmentDetailsForm";
import InsuranceDetailsForm from "../../../components/timeline/InsuranceDetailsForm";
import LoanDetailsForm from "../../../components/timeline/LoanDetailsForm";
import SmartInvestForm from "../../../components/SmartInvestForm";
import {
  PositionCashflowModal,
  PositionCalculatorModal,
} from "../../../components/PositionModals";
import { type CashflowPreviewPoint } from "../../../components/timeline/CashflowPreviewChart";
import {
  buildHomeCashflowBreakdown,
  buildCarCashflowBreakdown,
  buildInvestmentCashflowBreakdown,
  buildInsuranceCashflowBreakdown,
  buildLoanCashflowBreakdown,
  type PositionCashflowEntry,
} from "../../../src/domain/positions/cashflowBreakdown";
import {
  buildAmortizationSchedule,
  buildValueSchedule,
  buildContributionSchedule,
  type AmortizationRow,
  type ValueRow,
  type ContributionRow,
} from "../../../src/domain/positions/calculations";
import { buildInvestmentValueTable, type ValueTableRow } from "../../../src/domain/positions/investmentValueTable";
import {
  createCarPositionFromTemplate,
  createHomePositionFromTemplate,
  createInsurancePositionFromTemplate,
  createInvestmentPositionFromTemplate,
  createLoanPositionFromTemplate,
  formatCarSummary,
  formatHomeSummary,
  formatInsuranceSummary,
  formatInvestmentSummary,
} from "../../../components/timeline/utils";
import {
  getScenarioById,
  isScenarioV2,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { formatCurrency } from "../../../lib/i18n";
import { buildScenarioEventViews } from "../../../src/domain/events/utils";
import { monthsBetween } from "../../../src/domain/members/age";
import { isValidMonthStr } from "../../../src/utils/month";
import { compareMonthKey } from "../../../src/utils/monthKey";
import { useProjectionWithLedger } from "../../../src/engine/useProjectionWithLedger";
import { buildSmartInvestProjectionBreakdown, type SmartInvestProjectionBreakdown } from "../../../src/domain/smartInvest/projection";
import { buildDefaultSmartInvestPolicy } from "../../../src/domain/smartInvest/defaultPolicy";
import { compileSellLifecycle } from "../../../src/domain/positions/compileSellLifecycle";
import MonthlyBreakdownModalHost from "../../../components/MonthlyBreakdownModalHost";
import MoneyMonthSnapshotPanel from "../../../components/MoneyMonthSnapshotPanel";
import TwoPaneLayout from "../../../components/TwoPaneLayout";
import AddFlowDrawer from "../../../components/add-flow/AddFlowDrawer";
import BundleWizardDrawer from "../../../components/eventTemplates/bundles/BundleWizardDrawer";
import EventCardList from "../../../src/features/money/EventCardList";
import IncomeEventList from "../../../src/features/money/IncomeEventList";
import IncomeSummarySection from "../../../src/features/money/IncomeSummarySection";
import ExpenseSummarySection from "../../../src/features/money/ExpenseSummarySection";
import CashflowEventDrawer, {
  type CashflowEventDraft,
  type ScenarioEventDraft,
} from "../../../features/moneyFlow/CashflowEventDrawer";
import {
  buildCashflowGrowthPayload,
} from "../../../features/moneyFlow/growthMode";
import HousingEventDrawer, {
  type HousingEventDraft,
} from "../../../features/moneyFlow/HousingEventDrawer";
import LoanEventDrawer, {
  type LoanEventDraft,
} from "../../../features/moneyFlow/LoanEventDrawer";
import InsuranceEventDrawer, {
  type InsuranceEventDraft,
} from "../../../features/moneyFlow/InsuranceEventDrawer";
import MortgageDetailDrawer, {
  type MortgageDetailTab,
} from "../../../features/moneyFlow/MortgageDetailDrawer";
import CashBalanceCard from "../../../features/assets/CashBalanceCard";
import ScenarioAssetManager from "../../../features/assets/ScenarioAssetManager";
import ScenarioLiabilityManager from "../../../features/liabilities/ScenarioLiabilityManager";
import type {
  CarPositionDraft,
  HomePositionDraft,
  InsurancePositionDraft,
  InvestmentPositionDraft,
  LoanPositionDraft,
  ScenarioAsset,
  ScenarioLiability,
} from "../../../src/store/scenarioStore";
import { useUiStore } from "../../../src/store/uiStore";
import { compileScenarioV2ToLedger } from "../../../src/engine/scenarioV2Compiler";
import {
  resolveEventCardAmount,
  resolveEventCardStartMonth,
  filterEventsByLedgerImpact,
} from "../../../src/features/money/eventCardUtils";
import {
  buildExpenseSummary,
  buildIncomeSummary,
  filterIncomeEvents,
  groupIncomeEvents,
  sortIncomeEvents,
  type IncomeSortOption,
  type IncomeStatusFilter,
} from "../../../src/features/money/incomeViewModels";
import {
  buildSalaryAdjustmentTags,
  deriveRecurringGroupId,
  getSalaryAdjustmentParentEventId,
  isSalaryAdjustmentEvent,
  resolveRecurringGroupId,
  SALARY_ADJUSTMENT_TAG,
} from "../../../src/features/money/salaryAdjustmentTags";
import {
  computeBundleCashflowSummary,
  type BundleMonthlyBreakdownItem,
} from "../../../src/features/money/bundleSummary";
import { normalizeSalarySchedule } from "../../../src/features/money/normalizeSalarySchedule";
import type { CashflowEvent, ScenarioEvent } from "../../../src/domain/scenarioV2/events";
import type { ScenarioEventDraft as ScenarioV2EventDraft } from "../../../src/domain/scenarioV2/events";
import type { DeleteImpactSummary } from "../../../src/domain/scenarioV2/eventDeleteImpact";
import {
  buildBundleDeleteImpact,
  buildEventDeleteImpact,
  createEmptyLedgerPreview,
} from "../../../src/domain/scenarioV2/eventDeleteImpact";
import type { LedgerRow } from "../../../src/engine/scenarioV2Compiler";
import type { TemplateCategory, TemplateDef, TemplateId } from "../../../src/domain/eventTemplates/types";
import { buildTemplateDrawerDraftOverrides } from "../../../src/domain/eventTemplates/presets";
import type { BundleWizardInput } from "../../../src/domain/eventTemplates/bundles";
import { getTemplateDef } from "../../../src/domain/eventTemplates/registry";
import { selectMonthSnapshot } from "../../../src/engine/projectionSelectors";

type CashflowModalState = {
  opened: boolean;
  title: string;
  entries: ReturnType<typeof buildHomeCashflowBreakdown>["entries"];
  series: ReturnType<typeof buildHomeCashflowBreakdown>["series"];
};

type CalculatorModalState = {
  opened: boolean;
  title: string;
  amortizationRows?: ReturnType<typeof buildAmortizationSchedule>;
  valueRows?: ReturnType<typeof buildValueSchedule>;
  contributionRows?: ReturnType<typeof buildContributionSchedule>;
  assetValueRows?: ReturnType<typeof buildInvestmentValueTable>;
  bucketValueSeries?: ReturnType<typeof buildSmartInvestProjectionBreakdown>["bucketSeries"];
  bucketCurrentRows?: ReturnType<typeof buildSmartInvestProjectionBreakdown>["currentBucketValues"];
};

type MoneyTab = "income" | "expenses" | "assets" | "liabilities" | "inputs";

const resolveBundleWizardOneOffExpenseTotal = (
  wizardInput?: BundleWizardInput
): number | null => {
  if (!wizardInput) {
    return null;
  }
  if (wizardInput.templateId === "life_new_baby_plan") {
    const { input } = wizardInput;
    const deliveryCost = Math.max(0, Math.round(input.deliveryCost ?? 0));
    const agencyFee =
      input.helperEnabled && input.agencyFee
        ? Math.max(0, Math.round(input.agencyFee))
        : 0;
    return deliveryCost + agencyFee;
  }
  return null;
};

type MoneyClientProps = {
  scenarioId?: string;
  initialTab?: string;
  initialAdd?: string;
  initialEditEventId?: string;
  initialEditHomeId?: string;
  initialEditSmartInvest?: string;
  initialShowOnboardingBanner?: boolean;
  initialShowOnboardingSkipped?: boolean;
};

const isDerivedFromEvent = (item: {
  source?: "manual" | "eventGenerated";
  createdByEventId?: string;
}) => item.source === "eventGenerated" || Boolean(item.createdByEventId);

const getEventIdFromItem = (
  item: { createdByEventId?: string },
  fallbackEventId?: string | null
) => item.createdByEventId ?? fallbackEventId ?? null;

const tabOrder: MoneyTab[] = [
  "income",
  "expenses",
  "assets",
  "liabilities",
  "inputs",
];

type MoneyAddAction =
  | "event"
  | "home"
  | "investment"
  | "insurance"
  | "car"
  | "loan";

type CreationIntent = "plan" | "item";
type CreationItemCategory = "income" | "expenses" | "assets" | "liabilities";

type DeleteConfirmation =
  | {
      type: "eventV2";
      id: string;
      label: string;
      impact?: DeleteImpactSummary | null;
    }
  | {
      type: "bundle";
      bundleId: string;
      label: string;
      eventIds: string[];
      impact?: DeleteImpactSummary | null;
    }
  | {
      type: "bundleItem";
      bundleId: string;
      label: string;
      eventIds: string[];
      bundleTitle: string;
      impact?: DeleteImpactSummary | null;
    }
  | {
      type: "asset";
      id: string;
      label: string;
      impact: DeleteImpactSummary;
    }
  | {
      type: "liability";
      id: string;
      label: string;
      impact: DeleteImpactSummary;
    };

type BundleSliceItem = {
  id: string;
  label: string;
  amount: number | null;
  subLabel?: string | null;
  sourceEventId?: string;
};

type BundleSlice = {
  id: string;
  bundleId: string;
  title: string;
  summaryAmount: number | null;
  items: BundleSliceItem[];
};

type MortgageEvent = Extract<ScenarioEvent, { type: "housing" }> & {
  kind: "mortgage";
};

const isMortgageEvent = (event: ScenarioEvent): event is MortgageEvent =>
  event.type === "housing" && event.kind === "mortgage";
const isHousingBundleEvent = (
  event: ScenarioEvent
): event is Extract<ScenarioEvent, { type: "housing" }> =>
  event.type === "housing" && (event.kind === "mortgage" || event.kind === "rent");

export default function MoneyClient({
  scenarioId,
  initialTab,
  initialAdd,
  initialEditEventId,
  initialEditHomeId,
  initialEditSmartInvest,
  initialShowOnboardingBanner = false,
  initialShowOnboardingSkipped = false,
}: MoneyClientProps) {
  const t = useTranslations("money");
  const safeTRaw = useCallback(
    (key: string, fallback: string) => {
      const value = t.raw(key);
      if (typeof value !== "string") {
        return fallback;
      }
      const trimmed = value.trim();
      return !trimmed || trimmed === key ? fallback : trimmed;
    },
    [t]
  );
  const timelineText = useTranslations("timeline");
  const homesText = useTranslations("homes");
  const investmentsText = useTranslations("investments");
  const insurancesText = useTranslations("insurances");
  const loansText = useTranslations("loans");
  const carsText = useTranslations("cars");
  const budgetText = useTranslations("budgetRules");
  const common = useTranslations("common");
  const breakdownText = useTranslations();
  const locale = useLocale();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const addHomePosition = useScenarioStore((state) => state.addHomePosition);
  const updateHomePosition = useScenarioStore((state) => state.updateHomePosition);
  const removeHomePosition = useScenarioStore((state) => state.removeHomePosition);
  const addCarPosition = useScenarioStore((state) => state.addCarPosition);
  const updateCarPosition = useScenarioStore((state) => state.updateCarPosition);
  const removeCarPosition = useScenarioStore((state) => state.removeCarPosition);
  const addInvestmentPosition = useScenarioStore((state) => state.addInvestmentPosition);
  const updateInvestmentPosition = useScenarioStore((state) => state.updateInvestmentPosition);
  const removeInvestmentPosition = useScenarioStore((state) => state.removeInvestmentPosition);
  const addInsurancePosition = useScenarioStore((state) => state.addInsurancePosition);
  const updateInsurancePosition = useScenarioStore((state) => state.updateInsurancePosition);
  const removeInsurancePosition = useScenarioStore((state) => state.removeInsurancePosition);
  const addLoanPosition = useScenarioStore((state) => state.addLoanPosition);
  const updateLoanPosition = useScenarioStore((state) => state.updateLoanPosition);
  const updateSmartInvest = useScenarioStore((state) => state.updateSmartInvest);
  const removeBudgetRule = useScenarioStore((state) => state.removeBudgetRule);
  const addEvent = useScenarioStore((state) => state.addEvent);
  const replaceBundleEvents = useScenarioStore((state) => state.replaceBundleEvents);
  const updateEvent = useScenarioStore((state) => state.updateEvent);
  const removeEvent = useScenarioStore((state) => state.removeEvent);
  const duplicateEvent = useScenarioStore((state) => state.duplicateEvent);
  const upsertBundleInstanceRecord = useScenarioStore(
    (state) => state.upsertBundleInstanceRecord
  );
  const removeBundleInstanceRecord = useScenarioStore(
    (state) => state.removeBundleInstanceRecord
  );
  const upsertScenarioAssets = useScenarioStore((state) => state.upsertScenarioAssets);
  const upsertScenarioLiabilities = useScenarioStore((state) => state.upsertScenarioLiabilities);
  const setScenarioAssets = useScenarioStore((state) => state.setScenarioAssets);
  const setScenarioLiabilities = useScenarioStore((state) => state.setScenarioLiabilities);
  const setScenarioEvents = useScenarioStore((state) => state.setScenarioEvents);
  const setScenarioInitialCash = useScenarioStore(
    (state) => state.setScenarioInitialCash
  );
  const setScenarioBaseMonth = useScenarioStore((state) => state.setScenarioBaseMonth);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const resolvedScenarioId = useMemo(
    () => resolveScenarioIdFromQuery(scenarioId ?? null, activeScenarioId, scenarios),
    [activeScenarioId, scenarioId, scenarios]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const scenarioIsV2 = isScenarioV2(scenario);
  const scenarioEventViews = useMemo(
    () => (scenario ? buildScenarioEventViews(scenario, eventLibrary) : []),
    [eventLibrary, scenario]
  );
  const resolveCarDepreciationRatePct = useCallback(
    (car: CarPositionDraft) =>
      car.depreciationMode === "GLOBAL"
        ? Math.abs(
            scenario?.assumptions.carDepreciationRatePct ??
              car.annualDepreciationRatePct ??
              0
          )
        : car.annualDepreciationRatePct ?? 0,
    [scenario?.assumptions.carDepreciationRatePct]
  );
  const [dismissedPlaceholderBanner, setDismissedPlaceholderBanner] = useState(false);
  const showPlaceholderBanner =
    !dismissedPlaceholderBanner && (initialShowOnboardingBanner || initialShowOnboardingSkipped);
  const scenarioIdValue = scenario?.id;
  const incomeGrowthPct = scenario?.assumptions.salaryGrowthRate ?? null;
  const v2ScenarioEvents = useMemo(() => scenario?.events ?? [], [scenario?.events]);
  const bundleInstanceRecords = useMemo(
    () => scenario?.bundleInstances ?? [],
    [scenario?.bundleInstances]
  );
  const bundleInstanceById = useMemo(
    () => new Map(bundleInstanceRecords.map((record) => [record.id, record])),
    [bundleInstanceRecords]
  );
  const bundleGroups = useMemo(() => {
    if (!scenarioIsV2) {
      return [];
    }
    const groups = new Map<
      string,
      {
        id: string;
        templateId?: string;
        bundleTitle?: string;
        events: ScenarioEvent[];
      }
    >();
    v2ScenarioEvents.forEach((event) => {
      const source = event.source;
      if (!source?.bundleInstanceId) {
        return;
      }
      const existing =
        groups.get(source.bundleInstanceId) ?? {
          id: source.bundleInstanceId,
          templateId: source.templateId,
          bundleTitle: source.bundleTitle,
          events: [],
        };
      existing.events.push(event);
      if (!existing.templateId && source.templateId) {
        existing.templateId = source.templateId;
      }
      if (!existing.bundleTitle && source.bundleTitle) {
        existing.bundleTitle = source.bundleTitle;
      }
      groups.set(source.bundleInstanceId, existing);
    });
    return Array.from(groups.values());
  }, [scenarioIsV2, v2ScenarioEvents]);
  const bundleGroupById = useMemo(
    () => new Map(bundleGroups.map((group) => [group.id, group])),
    [bundleGroups]
  );
  const bundleEventIds = useMemo(() => {
    const ids = new Set<string>();
    bundleGroups.forEach((group) => {
      group.events.forEach((event) => ids.add(event.id));
    });
    return ids;
  }, [bundleGroups]);
  const {
    projection,
    months,
    ledgerByMonth,
    summaryByMonth,
    positionCashflowsByMonth,
    projectionNetCashflowByMonth,
    projectionNetCashflowMode,
    netWorthBreakdownByMonth,
  } = useProjectionWithLedger(
    scenario,
    eventLibrary,
    {
      members,
      budgetRules,
    }
  );
  const projectionMonths = useMemo(() => projection?.months ?? [], [projection]);
  const latestProjectionMonth = projectionMonths.at(-1) ?? null;
  const memberLookupRecord = useMemo(
    () =>
      Object.fromEntries(members.map((member) => [member.id, member.name])),
    [members]
  );
  const netWorthByMonth = useMemo(() => {
    if (!projection) {
      return {};
    }
    return projection.months.reduce<Record<string, number>>((acc, month, index) => {
      acc[month] = projection.netWorth[index] ?? 0;
      return acc;
    }, {});
  }, [projection]);
  const [v2EventDrawerOpen, setV2EventDrawerOpen] = useState(false);
  const [v2EventDrawerMode, setV2EventDrawerMode] = useState<"create" | "edit">(
    "create"
  );
  const [v2EventDrawerType, setV2EventDrawerType] = useState<
    ScenarioEvent["type"] | null
  >(null);
  const [editingV2EventId, setEditingV2EventId] = useState<string | null>(null);
  const [v2EventDefaultKind, setV2EventDefaultKind] = useState<
    "income" | "expense"
  >("income");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templatePickerCategory, setTemplatePickerCategory] =
    useState<TemplateCategory>("popular");
  const [templatePickerIntent, setTemplatePickerIntent] = useState<CreationIntent | null>(null);
  const [templatePickerItemCategory, setTemplatePickerItemCategory] =
    useState<CreationItemCategory | null>(null);
  const [bundleWizardOpen, setBundleWizardOpen] = useState(false);
  const [bundleTemplate, setBundleTemplate] = useState<TemplateDef | null>(null);
  const [bundleWizardMode, setBundleWizardMode] = useState<"create" | "edit">(
    "create"
  );
  const [bundleWizardInstanceId, setBundleWizardInstanceId] = useState<string | null>(null);
  const [bundleWizardInitialInput, setBundleWizardInitialInput] =
    useState<BundleWizardInput | null>(null);
  const [bundleViewId, setBundleViewId] = useState<string | null>(null);
  const [bundleEditNotice, setBundleEditNotice] = useState<{
    bundleId: string;
    templateId?: string;
  } | null>(null);
  const [templateCashflowDraft, setTemplateCashflowDraft] =
    useState<Partial<CashflowEventDraft> | null>(null);
  const [templateHousingDraft, setTemplateHousingDraft] =
    useState<Partial<HousingEventDraft> | null>(null);
  const [templateLoanDraft, setTemplateLoanDraft] =
    useState<Partial<LoanEventDraft> | null>(null);
  const [templateInsuranceDraft, setTemplateInsuranceDraft] =
    useState<Partial<InsuranceEventDraft> | null>(null);
  const [mortgageDetail, setMortgageDetail] = useState<{
    eventId: string;
    tab: MortgageDetailTab;
  } | null>(null);
  const [ledgerActionError, setLedgerActionError] = useState<string | null>(null);
  const [ledgerActionSuccess, setLedgerActionSuccess] = useState<string | null>(null);
  const [adjustmentDraft, setAdjustmentDraft] = useState<{
    sourceEventId: string;
    month: string;
    amount: string;
    error?: string;
  } | null>(null);
  const [creatingHome, setCreatingHome] = useState<HomePositionDraft | null>(null);
  const [creatingCar, setCreatingCar] = useState<CarPositionDraft | null>(null);
  const [creatingInvestment, setCreatingInvestment] =
    useState<InvestmentPositionDraft | null>(null);
  const [creatingInsurance, setCreatingInsurance] =
    useState<InsurancePositionDraft | null>(null);
  const [creatingLoan, setCreatingLoan] = useState<LoanPositionDraft | null>(null);
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null);
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(null);
  const [editingInsuranceId, setEditingInsuranceId] = useState<string | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const activeDrawer = useUiStore((state) => state.activeDrawer);
  const openDrawer = useUiStore((state) => state.openDrawer);
  const closeDrawer = useUiStore((state) => state.closeDrawer);
  const openModal = useUiStore((state) => state.openModal);
  const breakdownMonth = useUiStore((state) => state.breakdownMonth);
  const setBreakdownMonth = useUiStore((state) => state.setBreakdownMonth);
  const breakdownMonthRange = useUiStore((state) => state.breakdownMonthRange);
  const setBreakdownMonthRange = useUiStore((state) => state.setBreakdownMonthRange);
  const smartInvestDrawerOpen = activeDrawer?.type === "smartInvest";
  const normalizedRange = useMemo(() => {
    if (projectionMonths.length === 0) {
      return { fromMonth: null, toMonth: null };
    }
    const baseMonth = projectionMonths[0];
    const clampMonth = (value: string | null, fallback: string) => {
      const index = monthsBetween(baseMonth, value ?? fallback);
      const clampedIndex = Math.min(Math.max(index, 0), projectionMonths.length - 1);
      return projectionMonths[clampedIndex];
    };
    const fallback = breakdownMonth ?? baseMonth;
    const fromMonth = clampMonth(breakdownMonthRange.fromMonth ?? fallback, baseMonth);
    let toMonth = clampMonth(breakdownMonthRange.toMonth ?? fromMonth, fromMonth);
    if (monthsBetween(fromMonth, toMonth) < 0) {
      toMonth = fromMonth;
    }
    return { fromMonth, toMonth };
  }, [breakdownMonth, breakdownMonthRange, projectionMonths]);
  const selectedDashboardMonth = normalizedRange.toMonth ?? projectionMonths[0] ?? null;
  const currentMonthKey = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const currentMonthSnapshot = useMemo(
    () =>
      selectMonthSnapshot({
        projection,
        monthKey: currentMonthKey,
        ledgerByMonth,
        positionCashflowsByMonth,
      }),
    [currentMonthKey, ledgerByMonth, positionCashflowsByMonth, projection]
  );
  const selectedMonthSnapshot = useMemo(
    () =>
      selectMonthSnapshot({
        projection,
        monthKey: selectedDashboardMonth,
        ledgerByMonth,
        positionCashflowsByMonth,
      }),
    [ledgerByMonth, positionCashflowsByMonth, projection, selectedDashboardMonth]
  );
  const handleSnapshotMonthChange = useCallback(
    (month: string) => {
      if (!projectionMonths.includes(month)) {
        return;
      }
      setBreakdownMonthRange({ fromMonth: month, toMonth: month });
      setBreakdownMonth(month);
    },
    [projectionMonths, setBreakdownMonth, setBreakdownMonthRange]
  );
  const [assetDetails, setAssetDetails] = useState<{
    type: "home" | "investment" | "insurance" | "car" | "loan" | "smartInvest";
    id?: string;
  } | null>(null);
  const [assetDetailsMonth, setAssetDetailsMonth] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [expandedBundleSliceIds, setExpandedBundleSliceIds] = useState<string[]>([]);
  const [cashflowModal, setCashflowModal] = useState<CashflowModalState>({
    opened: false,
    title: "",
    entries: [],
    series: [],
  });
  const [calculatorModal, setCalculatorModal] = useState<CalculatorModalState>({
    opened: false,
    title: "",
  });
  const [shouldFocusCashCard, setShouldFocusCashCard] = useState(false);
  const warnedBundleSummary = useRef(new Set<string>());
  const hasHandledInitialAdd = useRef(false);
  const hasHandledInitialEdit = useRef(false);
  const hasSyncedCashAsset = useRef(false);
  const cashCardRef = useRef<HTMLDivElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  const resolvedTab = tabOrder.includes(initialTab as MoneyTab)
    ? (initialTab as MoneyTab)
    : "income";
  const [activeTab, setActiveTab] = useState<MoneyTab>(resolvedTab);
  const [incomeMemberFilter, setIncomeMemberFilter] = useState<string>("all");
  const [incomeStatusFilter, setIncomeStatusFilter] = useState<IncomeStatusFilter>("all");
  const [incomeSortBy, setIncomeSortBy] = useState<IncomeSortOption>("amountDesc");
  const [inputsFilter, setInputsFilter] = useState<
    "all" | "rules" | "assets" | "events"
  >("all");
  const [openAssetEditId, setOpenAssetEditId] = useState<string | null>(null);
  const [openLiabilityEditId, setOpenLiabilityEditId] = useState<string | null>(null);
  const [assetHoldingCostNotice, setAssetHoldingCostNotice] = useState(false);

  useEffect(() => {
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const focusParam = searchParams?.get("focus") ?? "";
    const hasFocusHash = window.location.hash === "#cash";
    if (focusParam === "cash" || hasFocusHash) {
      setActiveTab("assets");
      setShouldFocusCashCard(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!shouldFocusCashCard || activeTab !== "assets") {
      return;
    }
    const node = cashCardRef.current;
    if (!node) {
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => {
      cashInputRef.current?.focus();
    });
    setShouldFocusCashCard(false);
  }, [activeTab, shouldFocusCashCard]);

  const activeTemplateCategory = useMemo<TemplateCategory>(() => {
    switch (activeTab) {
      case "income":
        return "income";
      case "expenses":
        return "expenses";
      case "assets":
        return "assets";
      case "liabilities":
        return "loans";
      case "inputs":
      default:
        return "popular";
    }
  }, [activeTab]);

  useEffect(() => {
    if (projectionMonths.length === 0) {
      if (breakdownMonth !== null) {
        setBreakdownMonth(null);
      }
      if (breakdownMonthRange.fromMonth || breakdownMonthRange.toMonth) {
        setBreakdownMonthRange({ fromMonth: null, toMonth: null });
      }
      return;
    }
    if (
      normalizedRange.fromMonth !== breakdownMonthRange.fromMonth ||
      normalizedRange.toMonth !== breakdownMonthRange.toMonth
    ) {
      setBreakdownMonthRange(normalizedRange);
    }
    if (normalizedRange.toMonth !== breakdownMonth) {
      setBreakdownMonth(normalizedRange.toMonth);
    }
  }, [
    breakdownMonth,
    breakdownMonthRange,
    normalizedRange,
    projectionMonths.length,
    setBreakdownMonth,
    setBreakdownMonthRange,
  ]);


  const budgetCategoryLabels = useMemo(
    () => ({
      health: budgetText("categoryHealth"),
      baseline: budgetText("categoryBaseline"),
      childcare: budgetText("categoryChildcare"),
      education: budgetText("categoryEducation"),
      eldercare: budgetText("categoryEldercare"),
      petcare: budgetText("categoryPetcare"),
    }),
    [budgetText]
  );

  const v2LedgerRows = useMemo<LedgerRow[]>(() => {
    if (!scenario || !scenarioIsV2) {
      return [];
    }
    return compileScenarioV2ToLedger(scenario);
  }, [scenario, scenarioIsV2]);
  const ledgerRowsByEventId = useMemo(() => {
    const map = new Map<string, LedgerRow[]>();
    v2LedgerRows.forEach((row) => {
      if (!row.sourceEventId) {
        return;
      }
      const existing = map.get(row.sourceEventId) ?? [];
      existing.push(row);
      map.set(row.sourceEventId, existing);
    });
    map.forEach((rows, key) => {
      rows.sort((a, b) => {
        const monthSort = compareMonthKey(b.month, a.month);
        if (monthSort !== 0) {
          return monthSort;
        }
        return (a.label ?? "").localeCompare(b.label ?? "");
      });
      map.set(key, rows);
    });
    return map;
  }, [v2LedgerRows]);

  const incomeEvents = useMemo(
    () =>
      v2ScenarioEvents.filter(
        (event) =>
          (event.type === "cashflow" && event.kind === "income") ||
          event.type === "adjustment"
      ),
    [v2ScenarioEvents]
  );
  const expenseEvents = useMemo(
    () =>
      filterEventsByLedgerImpact(v2ScenarioEvents, ledgerRowsByEventId, "expense"),
    [ledgerRowsByEventId, v2ScenarioEvents]
  );
  const standaloneIncomeEvents = useMemo(
    () => incomeEvents.filter((event) => !event.source?.bundleInstanceId),
    [incomeEvents]
  );
  const filteredIncomeEvents = useMemo(
    () => filterIncomeEvents(standaloneIncomeEvents, incomeMemberFilter, incomeStatusFilter),
    [incomeMemberFilter, incomeStatusFilter, standaloneIncomeEvents]
  );
  const visibleIncomeEvents = useMemo(
    () => sortIncomeEvents(filteredIncomeEvents, incomeSortBy),
    [filteredIncomeEvents, incomeSortBy]
  );
  const incomeSummary = useMemo(
    () =>
      buildIncomeSummary({
        events: filteredIncomeEvents,
        ledgerRowsByEventId,
        baseMonth: selectedDashboardMonth ?? scenario?.assumptions.baseMonth ?? undefined,
      }),
    [filteredIncomeEvents, ledgerRowsByEventId, scenario?.assumptions.baseMonth, selectedDashboardMonth]
  );
  const standaloneExpenseEvents = useMemo(
    () => expenseEvents.filter((event) => !event.source?.bundleInstanceId),
    [expenseEvents]
  );
  const expenseSummary = useMemo(
    () =>
      buildExpenseSummary({
        events: standaloneExpenseEvents,
        ledgerRowsByEventId,
        baseMonth: selectedDashboardMonth ?? scenario?.assumptions.baseMonth ?? undefined,
      }),
    [ledgerRowsByEventId, scenario?.assumptions.baseMonth, selectedDashboardMonth, standaloneExpenseEvents]
  );
  const derivedIncomeItems = useMemo(() => {
    return v2ScenarioEvents.flatMap((event) => {
      if (event.type !== "housing") {
        return [];
      }
      if (event.source?.bundleInstanceId) {
        return [];
      }
      const rows = ledgerRowsByEventId.get(event.id) ?? [];
      const incomeRows = rows.filter(
        (row) => row.kind === "income" || (!row.kind && row.amount > 0)
      );
      if (incomeRows.length === 0) {
        return [];
      }
      const latestRow = incomeRows.reduce<LedgerRow | null>((current, row) => {
        if (!current) {
          return row;
        }
        return compareMonthKey(row.month, current.month) > 0 ? row : current;
      }, null);
      return [
        {
          id: `${event.id}-rental-income`,
          sourceEventId: event.id,
          sourceLabel: event.label ?? t("ledgerRowFallbackLabel"),
          amount: latestRow?.amount ?? null,
        },
      ];
    });
  }, [ledgerRowsByEventId, t, v2ScenarioEvents]);
  const editingV2Event = useMemo<ScenarioEvent | null>(() => {
    if (!editingV2EventId) {
      return null;
    }
    return v2ScenarioEvents.find((event) => event.id === editingV2EventId) ?? null;
  }, [editingV2EventId, v2ScenarioEvents]);
  const editingV2DrawerEvent = useMemo(() => {
    if (!editingV2Event) {
      return null;
    }
    if (editingV2Event.type === "cashflow" || editingV2Event.type === "adjustment") {
      return editingV2Event;
    }
    return null;
  }, [editingV2Event]);
  const editingHousingEvent = editingV2Event?.type === "housing" ? editingV2Event : null;
  const editingLoanEvent = editingV2Event?.type === "loan" ? editingV2Event : null;
  const editingInsuranceEvent =
    editingV2Event?.type === "insurance" ? editingV2Event : null;



  const positions = scenario?.positions;
  const homes = useMemo(() => positions?.homes ?? [], [positions?.homes]);
  const investments = useMemo(
    () => positions?.investments ?? [],
    [positions?.investments]
  );
  const insurances = useMemo(
    () => positions?.insurances ?? [],
    [positions?.insurances]
  );
  const cars = useMemo(() => positions?.cars ?? [], [positions?.cars]);
  const loans = useMemo(() => positions?.loans ?? [], [positions?.loans]);
  const baseMonth = scenario?.assumptions.baseMonth ?? null;
  const initialCashValue = scenario?.assumptions.initialCash ?? 0;
  const currentProjectionMonth = baseMonth ?? null;
  const hasInitialCashSetup = Boolean(baseMonth);
  const defaultSmartInvestPolicy = useMemo(
    () => buildDefaultSmartInvestPolicy(timelineText("smartInvestDefaultAllocation")),
    [timelineText]
  );
  const smartInvestPolicy =
    scenario?.assumptions.smartInvest ?? defaultSmartInvestPolicy;
  const smartInvestBreakdown = useMemo(
    () =>
      projection
        ? buildSmartInvestProjectionBreakdown(
            projection,
            smartInvestPolicy.allocation
          )
        : null,
    [projection, smartInvestPolicy.allocation]
  );
  const inputRuleItems = useMemo(() => {
    return budgetRules.map((rule) => ({
        id: rule.id,
        kind: "rule" as const,
        label: rule.name,
        description: t("inputsRuleMeta", {
          category: budgetCategoryLabels[rule.category] ?? rule.category,
          amount: formatCurrency(rule.monthlyAmount, scenario?.baseCurrency ?? "USD", locale),
        }),
        onEdit: () => {
          const query = new URLSearchParams();
          if (scenarioIdValue) {
            query.set("scenarioId", scenarioIdValue);
          }
          query.set("tab", "budget");
          query.set("ruleId", rule.id);
          router.push(`/${locale}/people?${query.toString()}`);
        },
        onDelete: () => removeBudgetRule(rule.id),
      }));
  }, [
    budgetRules,
    budgetCategoryLabels,
    locale,
    removeBudgetRule,
    router,
    scenario?.baseCurrency,
    scenarioIdValue,
    t,
  ]);

  const inputAssetItems = useMemo(() => {
    if (!scenario) {
      return [];
    }
    if (scenarioIsV2) {
      const typeLabel = (kind: ScenarioAsset["kind"]) => {
        switch (kind) {
          case "cash":
            return t("assetTypeCash");
          case "home":
            return t("assetTypeProperty");
          case "investment":
            return t("assetTypeInvestment");
          case "car":
            return t("assetTypeCar");
          case "policy":
            return t("assetTypePolicy");
          case "other":
            return t("assetTypeOther");
          default:
            return kind;
        }
      };
      return (scenario.assets ?? [])
        .filter((asset) => {
          if (!asset.createdByEventId) {
            return true;
          }
          return !bundleEventIds.has(asset.createdByEventId);
        })
        .map((asset) => {
        const resolvedValue =
          asset.currentValue ??
          (asset.kind === "cash" ? scenario.assumptions.initialCash : undefined);
        return {
          id: asset.id,
          kind: "asset" as const,
          label: asset.label ?? t("assetUntitled"),
          description: t("inputsAssetMetaV2", {
            type: typeLabel(asset.kind),
            value:
              typeof resolvedValue === "number"
                ? formatCurrency(resolvedValue, scenario.baseCurrency, locale)
                : t("amountUnset"),
          }),
          onEdit: () => setActiveTab("assets"),
          onDelete: () => {
            if (!scenarioIdValue) {
              return;
            }
            setDeleteConfirmation({
              type: "asset",
              id: asset.id,
              label: asset.label ?? t("assetUntitled"),
              impact: {
                impactedAssets: [asset],
                impactedLiabilities: [],
                ledger: createEmptyLedgerPreview(),
              },
            });
          },
        };
      });
    }
    const currency = scenario.baseCurrency;
    const items = [
      ...homes.map((home) => ({
        id: home.id,
        kind: "asset" as const,
        label: homesText("title"),
        description: formatHomeSummary(homesText, home, currency, locale),
        onEdit: () => setEditingHomeId(home.id),
        onDelete: () => removeHomePosition(scenario.id, home.id),
      })),
      ...investments.map((investment) => ({
        id: investment.id ?? "",
        kind: "asset" as const,
        label: investmentsText("title"),
        description: formatInvestmentSummary(investmentsText, investment, currency, locale),
        onEdit: () => {
          if (investment.id) {
            setEditingInvestmentId(investment.id);
          }
        },
        onDelete: () => {
          if (investment.id) {
            removeInvestmentPosition(scenario.id, investment.id);
          }
        },
      })),
      ...insurances.map((insurance) => ({
        id: insurance.id ?? "",
        kind: "asset" as const,
        label: insurancesText("title"),
        description: formatInsuranceSummary(insurancesText, insurance, currency, locale),
        onEdit: () => {
          if (insurance.id) {
            setEditingInsuranceId(insurance.id);
          }
        },
        onDelete: () => {
          if (insurance.id) {
            removeInsurancePosition(scenario.id, insurance.id);
          }
        },
      })),
      ...cars.map((car) => ({
        id: car.id ?? "",
        kind: "asset" as const,
        label: carsText("title"),
        description: formatCarSummary(carsText, car, currency, locale),
        onEdit: () => {
          if (car.id) {
            setEditingCarId(car.id);
          }
        },
        onDelete: () => {
          if (car.id) {
            removeCarPosition(scenario.id, car.id);
          }
        },
      })),
    ];
    return items;
  }, [
    bundleEventIds,
    cars,
    carsText,
    homes,
    homesText,
    insurances,
    insurancesText,
    investments,
    investmentsText,
    locale,
    removeCarPosition,
    removeHomePosition,
    removeInsurancePosition,
    removeInvestmentPosition,
    scenario,
    scenarioIdValue,
    scenarioIsV2,
    t,
  ]);

  const openV2EventDrawer = useCallback(
    (
      mode: "create" | "edit",
      type: ScenarioEvent["type"],
      eventId?: string | null
    ) => {
      setLedgerActionError(null);
      setV2EventDrawerMode(mode);
      setV2EventDrawerType(type);
      setEditingV2EventId(eventId ?? null);
      setV2EventDrawerOpen(true);
    },
    []
  );

  const closeV2EventDrawer = useCallback(() => {
    setV2EventDrawerOpen(false);
    setEditingV2EventId(null);
    setV2EventDrawerType(null);
    setTemplateCashflowDraft(null);
    setTemplateHousingDraft(null);
    setTemplateLoanDraft(null);
    setTemplateInsuranceDraft(null);
  }, []);

  const openCreationDrawer = useCallback(
    (options?: {
      intent?: CreationIntent | null;
      itemCategory?: CreationItemCategory | null;
      templateCategory?: TemplateCategory;
    }) => {
      setTemplatePickerCategory(options?.templateCategory ?? "popular");
      setTemplatePickerIntent(options?.intent ?? null);
      setTemplatePickerItemCategory(options?.itemCategory ?? null);
      setTemplatePickerOpen(true);
    },
    []
  );
  const openMortgageDetails = useCallback((eventId: string, tab: MortgageDetailTab) => {
    setMortgageDetail({ eventId, tab });
  }, []);

  const handleTemplateSelect = useCallback(
    (template: TemplateDef) => {
      if (template.isBundle) {
        setBundleTemplate(template);
        setBundleWizardMode("create");
        setBundleWizardInstanceId(null);
        setBundleWizardInitialInput(null);
        setBundleWizardOpen(true);
        return;
      }
      const label = t(`templates.${template.id}.name`);
      const draftOverrides = buildTemplateDrawerDraftOverrides(template.id, {
        baseMonth,
        label,
      });
      setTemplateCashflowDraft(null);
      setTemplateHousingDraft(null);
      setTemplateLoanDraft(null);
      setTemplateInsuranceDraft(null);

      if (draftOverrides.drawerType === "cashflow") {
        setV2EventDefaultKind(draftOverrides.cashflow?.kind ?? "income");
        setTemplateCashflowDraft(draftOverrides.cashflow ?? null);
        openV2EventDrawer("create", "cashflow");
        return;
      }
      if (draftOverrides.drawerType === "housing") {
        setTemplateHousingDraft(draftOverrides.housing ?? null);
        openV2EventDrawer("create", "housing");
        return;
      }
      if (draftOverrides.drawerType === "loan") {
        setTemplateLoanDraft(draftOverrides.loan ?? null);
        openV2EventDrawer("create", "loan");
        return;
      }
      if (draftOverrides.drawerType === "insurance") {
        setTemplateInsuranceDraft(draftOverrides.insurance ?? null);
        openV2EventDrawer("create", "insurance");
      }
    },
    [baseMonth, openV2EventDrawer, t]
  );

  const handleOpenBundleEvent = useCallback(
    (type: ScenarioEvent["type"], eventId: string) => {
      openV2EventDrawer("edit", type, eventId);
    },
    [openV2EventDrawer]
  );
  const handleApplyBundleEvents = useCallback(
    (
      events: ScenarioV2EventDraft[],
      _options?: { packAsExperiment?: boolean; experimentTitle?: string },
      context?: {
        bundleInstanceId: string;
        wizardInput: BundleWizardInput;
      }
    ) => {
      if (!scenarioIdValue || !scenario) {
        return { ok: false, error: t("bundleApplyFailed") };
      }
      if (events.length === 0) {
        return { ok: true };
      }
      const resolvedBundleId =
        context?.bundleInstanceId ?? events[0]?.source?.bundleInstanceId ?? null;
      if (bundleWizardMode === "edit" && resolvedBundleId) {
        const result = replaceBundleEvents(
          resolvedBundleId,
          events,
          scenarioIdValue
        );
        if (!result.ok) {
          return { ok: false, error: t("bundleApplyFailed") };
        }
      } else {
        for (const event of events) {
          const result = addEvent(event, scenarioIdValue);
          if (!result.ok) {
            return { ok: false, error: t("bundleApplyFailed") };
          }
        }
      }
      if (resolvedBundleId && context?.wizardInput) {
        upsertBundleInstanceRecord(scenarioIdValue, {
          id: resolvedBundleId,
          wizardInput: context.wizardInput,
          updatedAt: Date.now(),
        });
      }
      return { ok: true };
    },
    [
      addEvent,
      bundleWizardMode,
      replaceBundleEvents,
      scenario,
      scenarioIdValue,
      t,
      upsertBundleInstanceRecord,
    ]
  );

  const handleAddCashflowEvent = useCallback(
    (kind: "income" | "expense") => {
      openCreationDrawer({
        intent: "item",
        itemCategory: kind === "income" ? "income" : "expenses",
        templateCategory: kind === "income" ? "income" : "expenses",
      });
    },
    [openCreationDrawer]
  );

  const handleFabAdd = useCallback(() => {
    openCreationDrawer({ templateCategory: activeTemplateCategory });
  }, [activeTemplateCategory, openCreationDrawer]);


  const applySalaryScheduleNormalization = useCallback(
    (params: {
      parentEventId: string;
      draftEvent?: ScenarioEvent;
      deletedEventId?: string;
    }): boolean => {
      if (!scenarioIdValue) {
        return false;
      }
      const { parentEventId, draftEvent, deletedEventId } = params;
      if (draftEvent && draftEvent.id === parentEventId && draftEvent.type === "cashflow") {
        const existingParent = v2ScenarioEvents.find((event) => event.id === parentEventId);
        if (existingParent && existingParent.type === "cashflow") {
          const mutatesTemporalRange =
            existingParent.startMonth !== draftEvent.startMonth ||
            (existingParent.endMonth ?? null) !== (draftEvent.endMonth ?? null);
          if (mutatesTemporalRange) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("[salary-adjustment] blocked baseline temporal mutation", {
                parentEventId,
                original: {
                  startMonth: existingParent.startMonth,
                  endMonth: existingParent.endMonth ?? null,
                },
                attempted: {
                  startMonth: draftEvent.startMonth,
                  endMonth: draftEvent.endMonth ?? null,
                },
              });
            }
            setLedgerActionError("薪金調整不可修改基準薪金的起訖月份");
            return false;
          }
        }
      }
      const nextEvents = v2ScenarioEvents
        .filter((event) => event.id !== deletedEventId)
        .map((event) => (draftEvent && event.id === draftEvent.id ? draftEvent : event));
      if (draftEvent && !nextEvents.some((event) => event.id === draftEvent.id)) {
        nextEvents.push(draftEvent);
      }

      const parent = nextEvents.find((event) => event.id === parentEventId);
      if (!parent || parent.type !== "cashflow" || parent.kind !== "income" || parent.cadence !== "monthly") {
        setLedgerActionError("薪金調整需要綁定現有薪金事件");
        return false;
      }

      const adjustments = nextEvents.filter(
        (event): event is CashflowEvent =>
          event.type === "cashflow" &&
          isSalaryAdjustmentEvent(event) &&
          getSalaryAdjustmentParentEventId(event) === parentEventId
      );
      const normalized = normalizeSalarySchedule(parent, adjustments);
      if (normalized.issues.includes("adjustment_before_base_start")) {
        setLedgerActionError("生效月份不可早於或等於薪金開始月份");
        return false;
      }
      if (normalized.issues.includes("duplicate_adjustment_start_month")) {
        setLedgerActionError("同月份已有薪金調整");
        return false;
      }
      if (normalized.issues.includes("missing_adjustment_start_month")) {
        setLedgerActionError("請填寫薪金調整生效月份");
        return false;
      }
      if (normalized.issues.includes("adjustment_after_base_end")) {
        setLedgerActionError("生效月份不可晚於薪金結束月份");
        return false;
      }

      const normalizedEvents = nextEvents
        .filter(
          (event) =>
            !(
              event.type === "cashflow" &&
              isSalaryAdjustmentEvent(event) &&
              getSalaryAdjustmentParentEventId(event) === parentEventId
            )
        )
        .map((event) => (event.id === parent.id ? normalized.base : event));
      normalizedEvents.push(...normalized.adjustments);
      setScenarioEvents(scenarioIdValue, normalizedEvents);
      return true;
    },
    [scenarioIdValue, setScenarioEvents, v2ScenarioEvents, setLedgerActionError]
  );

  const handleCreateSalaryAdjustment = useCallback(
    (parentEventId: string) => {
      const parentEvent = v2ScenarioEvents.find((event) => event.id === parentEventId);
      if (!parentEvent || parentEvent.type !== "cashflow") {
        return;
      }
      setV2EventDefaultKind("income");
      setTemplateCashflowDraft({
        kind: "income",
        cadence: "monthly",
        growthMode: parentEvent.growthMode ?? "assumption",
        customGrowthRatePct:
          parentEvent.growthMode === "custom" && typeof parentEvent.customGrowthRatePct === "number"
            ? String(parentEvent.customGrowthRatePct)
            : "",
        growthSource: parentEvent.growthSource,
        label: "薪金調整",
        memberId: parentEvent.memberId ?? "",
        startMonth: parentEvent.startMonth ?? "",
        tags: buildSalaryAdjustmentTags(parentEventId),
      });
      openV2EventDrawer("create", "cashflow");
    },
    [openV2EventDrawer, v2ScenarioEvents]
  );

  const handleSaveV2Event = (draft: ScenarioEventDraft) => {
    if (!scenarioIdValue) {
      return;
    }
    setLedgerActionError(null);
    if (draft.type === "adjustment") {
      const amount = Number(draft.amount);
      const payload = {
        type: "adjustment" as const,
        label: draft.label.trim() || undefined,
        kind: draft.kind,
        amount,
        month: draft.month,
        memberId: draft.memberId || undefined,
        tags: draft.tags && draft.tags.length > 0 ? draft.tags : ["adjustment"],
      };
      if (draft.id) {
        const result = updateEvent(draft.id, payload, scenarioIdValue);
        if (!result.ok) {
          setLedgerActionError(t("ledgerEventUpdateFailed"));
          return;
        }
      } else {
        const result = addEvent(payload, scenarioIdValue);
        if (!result.ok) {
          setLedgerActionError(t("ledgerEventCreateFailed"));
          return;
        }
      }
      setV2EventDrawerOpen(false);
      setEditingV2EventId(null);
      setV2EventDrawerType(null);
      return;
    }

    const amount = Number(draft.amount);
    const salaryAdjustmentParentId = getSalaryAdjustmentParentEventId({
      id: draft.id ?? "",
      type: "cashflow",
      kind: draft.kind,
      cadence: draft.cadence,
      amount,
      tags: draft.tags,
    });
    if (salaryAdjustmentParentId) {
      const parent = v2ScenarioEvents.find((event) => event.id === salaryAdjustmentParentId);
      if (!parent || parent.type !== "cashflow" || parent.kind !== "income") {
        setLedgerActionError("薪金調整需要綁定現有薪金事件");
        return;
      }
      if (draft.startMonth && parent.startMonth && compareMonthKey(draft.startMonth, parent.startMonth) < 0) {
        setLedgerActionError("生效月份不可早於薪金開始月份");
        return;
      }
    }
    const growthPayload = buildCashflowGrowthPayload({
      kind: draft.kind,
      cadence: draft.cadence,
      growthMode: draft.growthMode,
      customGrowthRatePct:
        draft.growthMode === "custom" ? Number(draft.customGrowthRatePct) : undefined,
      tags: draft.tags,
      growthSource: draft.growthSource,
    });

    const isSalaryAdjustment = Boolean(draft.tags?.includes(SALARY_ADJUSTMENT_TAG));
    const parentEvent = salaryAdjustmentParentId
      ? v2ScenarioEvents.find((event) => event.id === salaryAdjustmentParentId)
      : null;
    const parentGroupId =
      parentEvent && parentEvent.type === "cashflow"
        ? resolveRecurringGroupId(parentEvent) ?? deriveRecurringGroupId(parentEvent)
        : undefined;
    const payload: ScenarioEvent = {
      id: draft.id ?? crypto.randomUUID(),
      type: "cashflow" as const,
      label: draft.label.trim() || (isSalaryAdjustment ? "薪金調整" : undefined),
      kind: isSalaryAdjustment ? ("income" as const) : draft.kind,
      cadence: isSalaryAdjustment ? ("monthly" as const) : draft.cadence,
      amount,
      ...growthPayload,
      startMonth:
        (isSalaryAdjustment || draft.cadence !== "oneOff")
          ? draft.startMonth || undefined
          : undefined,
      endMonth: draft.cadence === "oneOff" ? undefined : draft.endMonth || undefined,
      occurrenceMonth: draft.cadence === "oneOff" ? draft.occurrenceMonth : undefined,
      everyNMonths:
        draft.cadence === "everyNMonths" ? Number(draft.everyNMonths) : undefined,
      memberId: draft.memberId || undefined,
      tags: draft.tags && draft.tags.length > 0 ? draft.tags : undefined,
      parentEventId: isSalaryAdjustment ? salaryAdjustmentParentId ?? undefined : undefined,
      groupId: isSalaryAdjustment ? parentGroupId : undefined,
      groupRole: isSalaryAdjustment ? ("adjustment" as const) : undefined,
      effectiveMonth: isSalaryAdjustment ? draft.startMonth || undefined : undefined,
    };

    if (payload.type === "cashflow" && payload.kind === "income" && !isSalaryAdjustment) {
      payload.groupId = resolveRecurringGroupId(payload) ?? deriveRecurringGroupId(payload);
      payload.groupRole = "base";
      payload.effectiveMonth = payload.startMonth;
    }

    if (salaryAdjustmentParentId) {
      if (
        !applySalaryScheduleNormalization({
          parentEventId: salaryAdjustmentParentId,
          draftEvent: payload,
        })
      ) {
        return;
      }
    } else if (draft.id) {
      const result = updateEvent(draft.id, payload, scenarioIdValue);
      if (!result.ok) {
        setLedgerActionError(t("ledgerEventUpdateFailed"));
        return;
      }
    } else {
      const result = addEvent(payload, scenarioIdValue);
      if (!result.ok) {
        setLedgerActionError(t("ledgerEventCreateFailed"));
        return;
      }
    }

    if (salaryAdjustmentParentId) {
      const fromAmount = parentEvent && parentEvent.type === "cashflow" ? parentEvent.amount : null;
      setLedgerActionSuccess(
        `已保存薪金調整：${payload.startMonth ?? "--"} 起 ${fromAmount ?? "--"} → ${payload.amount}`
      );
    }

    setV2EventDrawerOpen(false);
    setEditingV2EventId(null);
    setV2EventDrawerType(null);
  };

  const handleSaveHousingEvent = (draft: HousingEventDraft) => {
    if (!scenarioIdValue) {
      return;
    }
    setLedgerActionError(null);
    let savedEventId = draft.id ?? null;
    const payload = {
      type: "housing" as const,
      label: draft.label.trim() || undefined,
      kind: draft.kind,
      startMonth: draft.startMonth,
      endMonth: draft.endMonth || undefined,
      rentMonthly: draft.kind === "rent" ? Number(draft.rentMonthly) : undefined,
      rentAnnualGrowthPct:
        draft.kind === "rent" && draft.rentAnnualGrowthPct
          ? Number(draft.rentAnnualGrowthPct)
          : undefined,
      purchasePrice: draft.kind === "mortgage" ? Number(draft.purchasePrice) : undefined,
      downPaymentMode: draft.kind === "mortgage" ? draft.downPaymentMode : undefined,
      downPaymentPercent:
        draft.kind === "mortgage" && draft.downPaymentPercent
          ? Number(draft.downPaymentPercent)
          : undefined,
      downPaymentAmount:
        draft.kind === "mortgage" && draft.downPaymentAmount
          ? Number(draft.downPaymentAmount)
          : undefined,
      mortgageRatePct:
        draft.kind === "mortgage" ? Number(draft.mortgageRatePct) : undefined,
      mortgageTermYears:
        draft.kind === "mortgage" ? Number(draft.mortgageTermYears) : undefined,
      mortgagePayment:
        draft.kind === "mortgage" && draft.mortgagePayment
          ? Number(draft.mortgagePayment)
          : undefined,
      mortgagePaymentIsEstimated:
        draft.kind === "mortgage"
          ? draft.mortgagePaymentSource === "estimated"
          : undefined,
      feesOneOff:
        draft.kind === "mortgage"
          ? draft.feesOneOff.map((fee) => ({
              id: fee.id,
              label: fee.label.trim() || undefined,
              amount: Number(fee.amount),
              month: fee.month,
            }))
          : undefined,
      ongoingCosts:
        draft.kind === "mortgage"
          ? draft.ongoingCosts.map((cost) => ({
              id: cost.id,
              label: cost.label.trim() || undefined,
              amount: Number(cost.amount),
              startMonth: cost.startMonth,
              endMonth: cost.endMonth || undefined,
            }))
          : undefined,
      rental:
        draft.kind === "mortgage" && draft.rental.enabled
          ? {
              enabled: true,
              rentMonthly: Number(draft.rental.rentMonthly),
              startMonth: draft.rental.startMonth,
              endMonth: draft.rental.endMonth || undefined,
              vacancyRatePct: draft.rental.vacancyRatePct
                ? Number(draft.rental.vacancyRatePct)
                : undefined,
            }
          : undefined,
      propertyAssetId: draft.kind === "mortgage" ? draft.propertyAssetId : undefined,
      mortgageLiabilityId:
        draft.kind === "mortgage" ? draft.mortgageLiabilityId : undefined,
      memberId: draft.memberId || undefined,
    };

    if (draft.id) {
      const result = updateEvent(draft.id, payload, scenarioIdValue);
      if (!result.ok) {
        setLedgerActionError(t("ledgerEventUpdateFailed"));
        return;
      }
    } else {
      const result = addEvent(payload, scenarioIdValue);
      if (!result.ok) {
        setLedgerActionError(t("ledgerEventCreateFailed"));
        return;
      }
      savedEventId = result.event?.id ?? null;
    }

    if (payload.kind === "mortgage" && payload.propertyAssetId && payload.mortgageLiabilityId) {
      const createdByEventId = savedEventId ?? payload.propertyAssetId;
      upsertScenarioAssets(scenarioIdValue, [
        {
          id: payload.propertyAssetId,
          kind: "home",
          label: payload.label,
          source: "eventGenerated",
          createdByEventId,
          createdByTemplate: "housing_mortgage",
        },
      ]);
      upsertScenarioLiabilities(scenarioIdValue, [
        {
          id: payload.mortgageLiabilityId,
          kind: "mortgage",
          label: payload.label,
          source: "eventGenerated",
          createdByEventId,
          createdByTemplate: "housing_mortgage",
        },
      ]);
    }

    setV2EventDrawerOpen(false);
    setEditingV2EventId(null);
    setV2EventDrawerType(null);
  };

  const handleSaveLoanEvent = (draft: LoanEventDraft) => {
    if (!scenarioIdValue) {
      return;
    }
    setLedgerActionError(null);
    const payload = {
      type: "loan" as const,
      label: draft.label.trim() || undefined,
      loanKind: draft.loanKind,
      startMonth: draft.startMonth,
      principal: Number(draft.principal),
      annualInterestRatePct: Number(draft.annualInterestRatePct),
      termYears: Number(draft.termYears),
      monthlyPayment: draft.monthlyPayment ? Number(draft.monthlyPayment) : undefined,
      paymentMethod: draft.paymentMethod,
      paymentIsEstimated: draft.paymentIsEstimated,
      purchasePrice: draft.purchasePrice ? Number(draft.purchasePrice) : undefined,
      downPaymentMode: draft.downPaymentMode,
      downPaymentPercent: draft.downPaymentPercent
        ? Number(draft.downPaymentPercent)
        : undefined,
      downPaymentAmount: draft.downPaymentAmount
        ? Number(draft.downPaymentAmount)
        : undefined,
      liabilityId: draft.liabilityId,
      memberId: draft.memberId || undefined,
    };

    if (draft.id) {
      const result = updateEvent(draft.id, payload, scenarioIdValue);
      if (!result.ok) {
        setLedgerActionError(t("ledgerEventUpdateFailed"));
        return;
      }
    } else {
      const result = addEvent(payload, scenarioIdValue);
      if (!result.ok) {
        setLedgerActionError(t("ledgerEventCreateFailed"));
        return;
      }
    }

    upsertScenarioLiabilities(scenarioIdValue, [
      {
        id: payload.liabilityId,
        kind:
          payload.loanKind === "car"
            ? "carLoan"
            : payload.loanKind === "credit"
            ? "credit"
            : payload.loanKind === "personal"
            ? "loan"
            : "other",
        label: payload.label,
      },
    ]);

    setV2EventDrawerOpen(false);
    setEditingV2EventId(null);
    setV2EventDrawerType(null);
  };

  const handleSaveInsuranceEvent = (draft: InsuranceEventDraft) => {
    if (!scenarioIdValue) {
      return;
    }
    setLedgerActionError(null);
    const payload = {
      type: "insurance" as const,
      label: draft.label.trim() || undefined,
      mode: draft.mode,
      startMonth: draft.mode === "quick" ? draft.startMonth : undefined,
      endMonth: draft.mode === "quick" ? draft.endMonth || undefined : undefined,
      premiumMonthly:
        draft.mode === "quick" ? Number(draft.premiumMonthly) : undefined,
      premiumAnnualGrowthPct:
        draft.mode === "quick" && draft.premiumAnnualGrowthPct
          ? Number(draft.premiumAnnualGrowthPct)
          : undefined,
      policies:
        draft.mode === "detailed"
          ? draft.policies.map((policy) => ({
              id: policy.id,
              name: policy.name.trim() || undefined,
              kind: policy.kind,
              startMonth: policy.startMonth,
              endMonth: policy.endMonth || undefined,
              premiumMonthly: Number(policy.premiumMonthly),
              premiumAnnualGrowthPct: policy.premiumAnnualGrowthPct
                ? Number(policy.premiumAnnualGrowthPct)
                : undefined,
              cashValue: policy.cashValue ? Number(policy.cashValue) : undefined,
              expectedAnnualReturnPct: policy.expectedAnnualReturnPct
                ? Number(policy.expectedAnnualReturnPct)
                : undefined,
              policyId: policy.policyId,
              policyAssetId: policy.policyAssetId,
            }))
          : undefined,
      memberId: draft.memberId || undefined,
    };

    if (draft.id) {
      const result = updateEvent(draft.id, payload, scenarioIdValue);
      if (!result.ok) {
        setLedgerActionError(t("ledgerEventUpdateFailed"));
        return;
      }
    } else {
      const result = addEvent(payload, scenarioIdValue);
      if (!result.ok) {
        setLedgerActionError(t("ledgerEventCreateFailed"));
        return;
      }
    }

    setV2EventDrawerOpen(false);
    setEditingV2EventId(null);
    setV2EventDrawerType(null);
  };
  const handleEditV2Event = useCallback(
    (eventId: string) => {
      if (!scenarioIsV2) {
        return;
      }
      const match = v2ScenarioEvents.find((event) => event.id === eventId);
      if (!match) {
        setLedgerActionError(t("ledgerEventMissing"));
        return;
      }
      if (match.source?.bundleInstanceId) {
        setBundleViewId(match.source.bundleInstanceId);
        return;
      }
      openV2EventDrawer("edit", match.type, eventId);
    },
    [openV2EventDrawer, scenarioIsV2, t, v2ScenarioEvents]
  );
  const openEventDrawer = useCallback(
    (eventId: string) => {
      handleEditV2Event(eventId);
    },
    [handleEditV2Event]
  );
  const resolveBundleTitle = useCallback(
    (bundle: { templateId?: string; bundleTitle?: string }) => {
      const templateName = bundle.templateId
        ? t(`templates.${bundle.templateId}.name`)
        : t("bundleTitleFallback");
      if (bundle.bundleTitle) {
        return t("bundleTitleWithName", {
          template: templateName,
          name: bundle.bundleTitle,
        });
      }
      return templateName;
    },
    [t]
  );
  const toggleBundleSliceExpanded = useCallback((sliceId: string) => {
    setExpandedBundleSliceIds((current) =>
      current.includes(sliceId)
        ? current.filter((id) => id !== sliceId)
        : [...current, sliceId]
    );
  }, []);
  const handleViewBundle = useCallback((bundleId: string) => {
    setBundleViewId(bundleId);
  }, []);
  const handleEditBundle = useCallback(
    (bundleId: string) => {
      const bundle = bundleGroupById.get(bundleId);
      if (!bundle) {
        return;
      }
      const record = bundleInstanceById.get(bundleId);
      if (!record) {
        setBundleEditNotice({
          bundleId,
          templateId: bundle.templateId,
        });
        return;
      }
      const templateDef = record.wizardInput?.templateId
        ? getTemplateDef(record.wizardInput.templateId)
        : bundle.templateId
        ? getTemplateDef(bundle.templateId as TemplateId)
        : null;
      if (!templateDef) {
        setBundleEditNotice({
          bundleId,
          templateId: bundle.templateId,
        });
        return;
      }
      setBundleWizardMode("edit");
      setBundleWizardInstanceId(bundleId);
      setBundleWizardInitialInput(record.wizardInput);
      setBundleTemplate(templateDef);
      setBundleWizardOpen(true);
      setBundleEditNotice(null);
    },
    [bundleGroupById, bundleInstanceById]
  );
  const handleRebuildBundle = useCallback(() => {
    if (!bundleEditNotice) {
      return;
    }
    const templateDef = bundleEditNotice.templateId
      ? getTemplateDef(bundleEditNotice.templateId as TemplateId)
      : null;
    if (!templateDef) {
      setBundleEditNotice(null);
      return;
    }
    setBundleWizardMode("create");
    setBundleWizardInstanceId(null);
    setBundleWizardInitialInput(null);
    setBundleTemplate(templateDef);
    setBundleWizardOpen(true);
    setBundleEditNotice(null);
  }, [bundleEditNotice]);
  const handleDuplicateV2Event = (eventId: string) => {
    if (!scenarioIdValue) {
      return;
    }
    setLedgerActionError(null);
    const result = duplicateEvent(eventId, scenarioIdValue);
    if (!result.ok) {
      setLedgerActionError(t("ledgerEventDuplicateFailed"));
    }
  };
  const handleDeleteBundle = useCallback(
    (bundleId: string) => {
      const bundle = bundleGroupById.get(bundleId);
      if (!bundle) {
        return;
      }
      const bundleTitle = resolveBundleTitle(bundle);
      const eventIds = bundle.events.map((event) => event.id);
      const impact = scenario ? buildBundleDeleteImpact(scenario, eventIds) : null;
      setDeleteConfirmation({
        type: "bundle",
        bundleId,
        label: bundleTitle,
        eventIds,
        impact,
      });
    },
    [bundleGroupById, resolveBundleTitle, scenario]
  );
  const handleDeleteV2Event = useCallback(
    (eventId: string) => {
      if (!scenarioIsV2) {
        return;
      }
      const match = v2ScenarioEvents.find((event) => event.id === eventId);
      if (!match) {
        setLedgerActionError(t("ledgerEventMissing"));
        return;
      }
      if (match.source?.bundleInstanceId) {
        const bundle = bundleGroupById.get(match.source.bundleInstanceId);
        const bundleTitle = resolveBundleTitle({
          templateId: bundle?.templateId ?? match.source.templateId,
          bundleTitle: bundle?.bundleTitle ?? match.source.bundleTitle,
        });
        const eventIds = bundle?.events.map((event) => event.id) ?? [eventId];
        const impact = scenario
          ? buildBundleDeleteImpact(scenario, eventIds)
          : null;
        setDeleteConfirmation({
          type: "bundleItem",
          bundleId: match.source.bundleInstanceId,
          label: bundleTitle,
          bundleTitle,
          eventIds,
          impact,
        });
        return;
      }
      const impact = scenario ? buildEventDeleteImpact(scenario, eventId) : null;
      const summaryImpact = impact
        ? {
            impactedAssets: impact.impactedAssets,
            impactedLiabilities: impact.impactedLiabilities,
            ledger: impact.ledger,
          }
        : null;
      setDeleteConfirmation({
        type: "eventV2",
        id: eventId,
        label: match.label ?? t("ledgerRowFallbackLabel"),
        impact: summaryImpact,
      });
    },
    [bundleGroupById, resolveBundleTitle, scenario, scenarioIsV2, t, v2ScenarioEvents]
  );
  const handleAdjustEvent = (row: LedgerRow) => {
    if (!row.sourceEventId) {
      return;
    }
    const sourceEvent = v2ScenarioEvents.find((event) => event.id === row.sourceEventId);
    if (!sourceEvent) {
      setLedgerActionError(t("ledgerEventUpdateFailed"));
      return;
    }
    const month =
      sourceEvent.type === "cashflow"
        ? sourceEvent.cadence === "oneOff"
          ? sourceEvent.occurrenceMonth ?? row.month
          : sourceEvent.startMonth ?? row.month
        : sourceEvent.type === "adjustment"
          ? sourceEvent.month
          : sourceEvent.type === "insurance" && sourceEvent.mode === "quick"
            ? sourceEvent.startMonth ?? row.month
            : sourceEvent.startMonth ?? row.month;
    const amount =
      sourceEvent.type === "cashflow" || sourceEvent.type === "adjustment"
        ? sourceEvent.amount
        : sourceEvent.type === "housing"
          ? sourceEvent.kind === "rent"
            ? sourceEvent.rentMonthly
            : sourceEvent.mortgagePayment
          : sourceEvent.type === "loan"
            ? sourceEvent.monthlyPayment
            : sourceEvent.type === "insurance" && sourceEvent.mode === "quick"
              ? sourceEvent.premiumMonthly
              : null;
    if (!month || !Number.isFinite(amount ?? NaN)) {
      setLedgerActionError(t("ledgerEventUpdateFailed"));
      return;
    }
    setLedgerActionError(null);
    setAdjustmentDraft({
      sourceEventId: row.sourceEventId,
      month,
      amount: String(amount),
    });
  };
  const inputEventItems = useMemo(() => {
    const standaloneEvents = v2ScenarioEvents.filter((event) => !bundleEventIds.has(event.id));
    const groupedIncome = groupIncomeEvents(standaloneEvents.filter((event) => event.type === "cashflow" && event.kind === "income"));
    const groupedIds = new Set<string>();
    const groupedItems = groupedIncome.map(({ baseEvent, adjustments, groupStartMonth, groupEndMonth }) => {
      [baseEvent, ...adjustments].forEach((event) => groupedIds.add(event.id));
      const amount = resolveEventCardAmount(baseEvent);
      const latestAdjustment = adjustments[adjustments.length - 1];
      return {
        id: baseEvent.id,
        kind: "event" as const,
        label: baseEvent.label ?? t("ledgerRowFallbackLabel"),
        description:
          t("inputsEventMeta", {
            month: groupStartMonth ?? resolveEventCardStartMonth(baseEvent) ?? t("amountUnset"),
            amount:
              amount !== null
                ? formatCurrency(amount, scenario?.baseCurrency ?? "USD", locale)
                : t("amountUnset"),
          }) +
          (adjustments.length > 0
            ? ` · 調整 ${adjustments.length} 次（最新：${resolveEventCardStartMonth(latestAdjustment) ?? "--"} ${formatCurrency(Math.abs(latestAdjustment?.type === "cashflow" ? latestAdjustment.amount : 0), scenario?.baseCurrency ?? "USD", locale)}） · ${groupStartMonth ?? "--"}→${groupEndMonth ?? t("eventCardOpenEnded")}`
            : ""),
        onEdit: () => openV2EventDrawer("edit", baseEvent.type, baseEvent.id),
        onDelete: () => handleDeleteV2Event(baseEvent.id),
      };
    });

    const otherItems = standaloneEvents
      .filter((event) => !groupedIds.has(event.id))
      .map((event) => {
        const amount = resolveEventCardAmount(event);
        const startMonth = resolveEventCardStartMonth(event) ?? t("amountUnset");
        return {
          id: event.id,
          kind: "event" as const,
          label: event.label ?? t("ledgerRowFallbackLabel"),
          description: t("inputsEventMeta", {
            month: startMonth,
            amount:
              amount !== null
                ? formatCurrency(amount, scenario?.baseCurrency ?? "USD", locale)
                : t("amountUnset"),
          }),
          onEdit: () => openV2EventDrawer("edit", event.type, event.id),
          onDelete: () => handleDeleteV2Event(event.id),
        };
      });

    return [...groupedItems, ...otherItems];
  }, [
    bundleEventIds,
    handleDeleteV2Event,
    locale,
    openV2EventDrawer,
    scenario?.baseCurrency,
    t,
    v2ScenarioEvents,
  ]);
  const scenarioAssets = useMemo(() => scenario?.assets ?? [], [scenario?.assets]);
  const cashAsset = useMemo(
    () => scenarioAssets.find((asset) => asset.kind === "cash") ?? null,
    [scenarioAssets]
  );
  const nonCashAssets = useMemo(
    () => scenarioAssets.filter((asset) => asset.kind !== "cash"),
    [scenarioAssets]
  );
  const scenarioLiabilities = useMemo(
    () => scenario?.liabilities ?? [],
    [scenario?.liabilities]
  );
  const bundleSummaryLabels = useMemo(
    () => ({
      mortgagePayment: t("bundleDetailMortgagePaymentLabel"),
      rentalIncome: t("bundleHomeRentalMonthly"),
      holdingCost: breakdownText("breakdownLabels.holdingCost"),
      fallback: t("ledgerRowFallbackLabel"),
    }),
    [breakdownText, t]
  );
  const bundleCardItems = useMemo(() => {
    if (!scenarioIsV2 || !scenario) {
      return [];
    }
    return bundleGroups.map((bundle) => {
      const eventIds = bundle.events.map((event) => event.id);
      const cashflowSummary = computeBundleCashflowSummary(
        bundle.events,
        ledgerRowsByEventId,
        selectedDashboardMonth,
        bundleSummaryLabels
      );
      const { hasStartMonthOneOffImpact, hasMonthlyImpact, oneOffTotal } =
        cashflowSummary;
      const assets = scenarioAssets.filter(
        (asset) => asset.createdByEventId && eventIds.includes(asset.createdByEventId)
      );
      const liabilities = scenarioLiabilities.filter(
        (liability) =>
          liability.createdByEventId && eventIds.includes(liability.createdByEventId)
      );
      return {
        id: bundle.id,
        title: resolveBundleTitle(bundle),
        eventIds,
        assets,
        liabilities,
        monthlyIncome: cashflowSummary.monthlyIncome,
        monthlyExpense: cashflowSummary.monthlyExpense,
        monthlyNet: cashflowSummary.monthlyNet,
        monthlySummary: cashflowSummary,
        hasMonthlyImpact,
        hasStartMonthOneOffImpact,
        oneOffTotal,
      };
    });
  }, [
    bundleGroups,
    bundleSummaryLabels,
    ledgerRowsByEventId,
    resolveBundleTitle,
    scenario,
    scenarioAssets,
    scenarioIsV2,
    scenarioLiabilities,
    selectedDashboardMonth,
  ]);
  const isMonthWithinRange = useCallback(
    (month: string | null, startMonth?: string | null, endMonth?: string | null) => {
      if (!month || !startMonth) {
        return false;
      }
      if (compareMonthKey(month, startMonth) < 0) {
        return false;
      }
      if (endMonth && compareMonthKey(month, endMonth) > 0) {
        return false;
      }
      return true;
    },
    []
  );
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    if (!selectedDashboardMonth) {
      return;
    }
    bundleCardItems.forEach((bundle) => {
      const group = bundleGroupById.get(bundle.id);
      if (!group) {
        return;
      }
      group.events.filter(isHousingBundleEvent).forEach((event) => {
          if (
            !isMonthWithinRange(
              selectedDashboardMonth,
              event.startMonth,
              event.endMonth
            )
          ) {
            return;
          }
          const rows = ledgerRowsByEventId.get(event.id) ?? [];
          const hasRows = rows.some((row) => row.month === selectedDashboardMonth);
          if (hasRows) {
            return;
          }
          const warningKey = `${bundle.id}:${event.id}:${selectedDashboardMonth}`;
          if (warnedBundleSummary.current.has(warningKey)) {
            return;
          }
          warnedBundleSummary.current.add(warningKey);
          console.warn(
            "[bundle summary] Missing ledger rows for housing event in bundle summary.",
            {
              bundleId: bundle.id,
              eventId: event.id,
              month: selectedDashboardMonth,
            }
          );
        });
    });
  }, [
    bundleCardItems,
    bundleGroupById,
    isMonthWithinRange,
    ledgerRowsByEventId,
    selectedDashboardMonth,
  ]);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    bundleCardItems.forEach((bundle) => {
      const wizardInput = bundleInstanceById.get(bundle.id)?.wizardInput;
      const expectedOneOffExpense = resolveBundleWizardOneOffExpenseTotal(wizardInput);
      if (expectedOneOffExpense === null) {
        return;
      }
      if (Math.abs(expectedOneOffExpense - bundle.oneOffTotal) < 1) {
        return;
      }
      const warningKey = `${bundle.id}:${expectedOneOffExpense}:${bundle.oneOffTotal}`;
      if (warnedBundleSummary.current.has(warningKey)) {
        return;
      }
      warnedBundleSummary.current.add(warningKey);
      console.warn("[bundle summary] Bundle one-off total does not match leaf events.", {
        bundleId: bundle.id,
        expectedOneOffExpense,
        actualOneOffExpense: bundle.oneOffTotal,
      });
    });
  }, [bundleCardItems, bundleInstanceById]);
  const activeBundleCard = useMemo(
    () => bundleCardItems.find((bundle) => bundle.id === bundleViewId) ?? null,
    [bundleCardItems, bundleViewId]
  );
  const activeBundleGroup = useMemo(
    () =>
      bundleViewId ? bundleGroupById.get(bundleViewId) ?? null : null,
    [bundleGroupById, bundleViewId]
  );
  const activeBundleMortgageEvent = useMemo(() => {
    if (!activeBundleGroup) {
      return null;
    }
    return activeBundleGroup.events.find(isMortgageEvent) ?? null;
  }, [activeBundleGroup]);
  const activeBundleMortgageSummary = useMemo(() => {
    if (!activeBundleMortgageEvent) {
      return null;
    }
    const purchasePrice = activeBundleMortgageEvent.purchasePrice;
    let downPayment = 0;
    if (activeBundleMortgageEvent.downPaymentMode === "amount") {
      downPayment = activeBundleMortgageEvent.downPaymentAmount ?? 0;
    } else if (activeBundleMortgageEvent.downPaymentMode === "percent") {
      downPayment =
        (purchasePrice ?? 0) *
        ((activeBundleMortgageEvent.downPaymentPercent ?? 0) / 100);
    } else if (typeof activeBundleMortgageEvent.downPaymentAmount === "number") {
      downPayment = activeBundleMortgageEvent.downPaymentAmount ?? 0;
    }
    const loanAmount =
      typeof purchasePrice === "number"
        ? Math.max(purchasePrice - downPayment, 0)
        : null;
    return {
      eventId: activeBundleMortgageEvent.id,
      loanAmount,
      ratePct: activeBundleMortgageEvent.mortgageRatePct ?? null,
      termYears: activeBundleMortgageEvent.mortgageTermYears ?? null,
      monthlyPayment: activeBundleMortgageEvent.mortgagePayment ?? null,
    };
  }, [activeBundleMortgageEvent]);
  const activeBundleSummary = useMemo(
    () => activeBundleCard?.monthlySummary ?? null,
    [activeBundleCard?.monthlySummary]
  );
  const bundleDetailIncomeItems = useMemo(
    () =>
      activeBundleSummary?.breakdown.filter((item) => item.direction === "income") ??
      [],
    [activeBundleSummary?.breakdown]
  );
  const bundleDetailExpenseItems = useMemo(
    () =>
      activeBundleSummary?.breakdown.filter((item) => item.direction === "expense") ??
      [],
    [activeBundleSummary?.breakdown]
  );
  const bundleDetailOneOffIncomeItems = useMemo(
    () =>
      activeBundleSummary?.oneOffBreakdown.filter(
        (item) => item.direction === "income"
      ) ?? [],
    [activeBundleSummary?.oneOffBreakdown]
  );
  const bundleDetailOneOffExpenseItems = useMemo(
    () =>
      activeBundleSummary?.oneOffBreakdown.filter(
        (item) => item.direction === "expense"
      ) ?? [],
    [activeBundleSummary?.oneOffBreakdown]
  );
  const mortgageDetailEvent = useMemo(() => {
    if (!mortgageDetail) {
      return null;
    }
    const match = v2ScenarioEvents.find((event) => event.id === mortgageDetail.eventId);
    if (match?.type !== "housing" || match.kind !== "mortgage") {
      return null;
    }
    return match;
  }, [mortgageDetail, v2ScenarioEvents]);
  const mortgageDetailAsset = useMemo(() => {
    if (!mortgageDetailEvent?.propertyAssetId) {
      return null;
    }
    return (
      scenarioAssets.find((asset) => asset.id === mortgageDetailEvent.propertyAssetId) ??
      null
    );
  }, [mortgageDetailEvent?.propertyAssetId, scenarioAssets]);
  const mortgageDetailLiability = useMemo(() => {
    if (!mortgageDetailEvent?.mortgageLiabilityId) {
      return null;
    }
    return (
      scenarioLiabilities.find(
        (liability) => liability.id === mortgageDetailEvent.mortgageLiabilityId
      ) ?? null
    );
  }, [mortgageDetailEvent?.mortgageLiabilityId, scenarioLiabilities]);
  const assetSourcesById = useMemo(() => {
    const sources: Record<
      string,
      {
        id: string;
        label: string;
        hasRelatedDebt?: boolean;
        hasRelatedCashflows?: boolean;
        eventType?: string;
        eventKind?: string;
      }[]
    > = {};
    const addSource = (
      assetId: string | undefined,
      event: ScenarioEvent,
      options?: { label?: string; hasRelatedDebt?: boolean }
    ) => {
      if (!assetId) {
        return;
      }
      const eventLabel = options?.label ?? event.label ?? t("ledgerRowFallbackLabel");
      const hasRelatedCashflows = (ledgerRowsByEventId.get(event.id) ?? []).length > 0;
      sources[assetId] = [
        ...(sources[assetId] ?? []),
        {
          id: event.id,
          label: eventLabel,
          hasRelatedDebt: options?.hasRelatedDebt,
          hasRelatedCashflows,
          eventType: event.type,
          eventKind: "kind" in event ? event.kind : undefined,
        },
      ];
    };
    v2ScenarioEvents.forEach((event) => {
      if (event.type === "housing" && event.kind === "mortgage") {
        addSource(event.propertyAssetId, event, {
          hasRelatedDebt: Boolean(event.mortgageLiabilityId),
        });
      }
      if (event.type === "insurance" && event.mode === "detailed") {
        (event.policies ?? []).forEach((policy) => {
          if (policy.kind === "savings") {
            addSource(policy.policyAssetId, event, {
              label: policy.name ?? event.label,
              hasRelatedDebt: false,
            });
          }
        });
      }
    });
    return sources;
  }, [ledgerRowsByEventId, t, v2ScenarioEvents]);
  const liabilitySourcesById = useMemo(() => {
    const sources: Record<
      string,
      {
        id: string;
        label: string;
        hasRelatedDebt?: boolean;
        hasRelatedCashflows?: boolean;
        eventType?: string;
        eventKind?: string;
      }[]
    > = {};
    const addSource = (
      liabilityId: string | undefined,
      event: ScenarioEvent
    ) => {
      if (!liabilityId) {
        return;
      }
      const eventLabel = event.label ?? t("ledgerRowFallbackLabel");
      const hasRelatedCashflows = (ledgerRowsByEventId.get(event.id) ?? []).length > 0;
      sources[liabilityId] = [
        ...(sources[liabilityId] ?? []),
        {
          id: event.id,
          label: eventLabel,
          hasRelatedDebt: true,
          hasRelatedCashflows,
          eventType: event.type,
          eventKind: "kind" in event ? event.kind : undefined,
        },
      ];
    };
    v2ScenarioEvents.forEach((event) => {
      if (event.type === "housing" && event.kind === "mortgage") {
        addSource(event.mortgageLiabilityId, event);
      }
      if (event.type === "loan") {
        addSource(event.liabilityId, event);
      }
    });
    return sources;
  }, [ledgerRowsByEventId, t, v2ScenarioEvents]);
  const assetValueById = useMemo(() => {
    const values = new Map<string, number>();
    v2ScenarioEvents.forEach((event) => {
      if (event.type === "housing" && event.kind === "mortgage") {
        if (event.propertyAssetId && typeof event.purchasePrice === "number") {
          values.set(event.propertyAssetId, event.purchasePrice);
        }
      }
      if (event.type === "insurance" && event.mode === "detailed") {
        (event.policies ?? []).forEach((policy) => {
          if (
            policy.kind === "savings" &&
            policy.policyAssetId &&
            typeof policy.cashValue === "number"
          ) {
            values.set(policy.policyAssetId, policy.cashValue);
          }
        });
      }
    });
    return values;
  }, [v2ScenarioEvents]);
  const liabilityDefaultsById = useMemo(() => {
    const values = new Map<
      string,
      { principalOutstanding?: number; annualInterestRatePct?: number; termYears?: number }
    >();
    v2ScenarioEvents.forEach((event) => {
      if (event.type === "housing" && event.kind === "mortgage") {
        if (event.mortgageLiabilityId) {
          const downPaymentAmount =
            event.downPaymentMode === "amount"
              ? event.downPaymentAmount ?? 0
              : typeof event.purchasePrice === "number"
                ? (event.purchasePrice * (event.downPaymentPercent ?? 0)) / 100
                : 0;
          const principalOutstanding =
            typeof event.purchasePrice === "number"
              ? Math.max(event.purchasePrice - downPaymentAmount, 0)
              : undefined;
          values.set(event.mortgageLiabilityId, {
            principalOutstanding,
            annualInterestRatePct: event.mortgageRatePct,
            termYears: event.mortgageTermYears,
          });
        }
      }
      if (event.type === "loan") {
        values.set(event.liabilityId, {
          principalOutstanding: event.principal,
          annualInterestRatePct: event.annualInterestRatePct,
          termYears: event.termYears,
        });
      }
    });
    return values;
  }, [v2ScenarioEvents]);
  const assetItems = useMemo(
    () =>
      nonCashAssets.map((asset) => {
        const resolvedValue =
          asset.currentValue ??
          assetValueById.get(asset.id);
        return {
          ...asset,
          currentValue: resolvedValue,
        };
      }),
    [assetValueById, nonCashAssets]
  );
  const liabilityItems = useMemo(
    () =>
      scenarioLiabilities.map((liability) => {
        const derived = liabilityDefaultsById.get(liability.id);
        return {
          ...liability,
          principalOutstanding:
            liability.principalOutstanding ?? derived?.principalOutstanding,
          annualInterestRatePct:
            liability.annualInterestRatePct ?? derived?.annualInterestRatePct,
          termYears: liability.termYears ?? derived?.termYears,
        };
      }),
    [liabilityDefaultsById, scenarioLiabilities]
  );
  const standaloneAssetItems = useMemo(
    () =>
      assetItems.filter(
        (asset) => !asset.createdByEventId || !bundleEventIds.has(asset.createdByEventId)
      ),
    [assetItems, bundleEventIds]
  );
  const standaloneLiabilityItems = useMemo(
    () =>
      liabilityItems.filter(
        (liability) =>
          !liability.createdByEventId || !bundleEventIds.has(liability.createdByEventId)
      ),
    [bundleEventIds, liabilityItems]
  );
  const bundleAssetItems = useMemo(
    () =>
      assetItems.filter(
        (asset) => asset.createdByEventId && bundleEventIds.has(asset.createdByEventId)
      ),
    [assetItems, bundleEventIds]
  );
  const bundleLiabilityItems = useMemo(
    () =>
      liabilityItems.filter(
        (liability) =>
          liability.createdByEventId && bundleEventIds.has(liability.createdByEventId)
      ),
    [bundleEventIds, liabilityItems]
  );
  const bundleSlicesByType = useMemo(() => {
    const slices: Record<
      "income" | "expenses" | "assets" | "liabilities",
      BundleSlice[]
    > = {
      income: [],
      expenses: [],
      assets: [],
      liabilities: [],
    };
    if (!scenarioIsV2) {
      return slices;
    }
    const bundleAssetByEventId = new Map<string, typeof bundleAssetItems>();
    bundleAssetItems.forEach((asset) => {
      if (!asset.createdByEventId) {
        return;
      }
      const existing = bundleAssetByEventId.get(asset.createdByEventId) ?? [];
      bundleAssetByEventId.set(asset.createdByEventId, [...existing, asset]);
    });
    const bundleLiabilityByEventId = new Map<string, typeof bundleLiabilityItems>();
    bundleLiabilityItems.forEach((liability) => {
      if (!liability.createdByEventId) {
        return;
      }
      const existing = bundleLiabilityByEventId.get(liability.createdByEventId) ?? [];
      bundleLiabilityByEventId.set(liability.createdByEventId, [...existing, liability]);
    });

    bundleGroups.forEach((bundle) => {
      const bundleId = bundle.id;
      const title = resolveBundleTitle(bundle);
      const bundleEventIdSet = new Set(bundle.events.map((event) => event.id));
      const monthlySummary = computeBundleCashflowSummary(
        bundle.events,
        ledgerRowsByEventId,
        selectedDashboardMonth,
        bundleSummaryLabels
      );
      const incomeItems: BundleSliceItem[] = monthlySummary.breakdown
        .filter((item: BundleMonthlyBreakdownItem) => item.direction === "income")
        .map((item) => ({
          id: item.id,
          label: item.label,
          amount: item.amount,
          sourceEventId: item.sourceEventId,
        }));
      if (incomeItems.length > 0) {
        const summaryAmount = monthlySummary.monthlyIncome;
        slices.income.push({
          id: `${bundleId}-income`,
          bundleId,
          title,
          summaryAmount,
          items: incomeItems,
        });
      }

      const expenseItems: BundleSliceItem[] = monthlySummary.breakdown
        .filter((item: BundleMonthlyBreakdownItem) => item.direction === "expense")
        .map((item) => ({
          id: item.id,
          label: item.label,
          amount: item.amount,
          sourceEventId: item.sourceEventId,
        }));
      if (expenseItems.length > 0) {
        const summaryAmount = monthlySummary.monthlyExpense;
        slices.expenses.push({
          id: `${bundleId}-expenses`,
          bundleId,
          title,
          summaryAmount,
          items: expenseItems,
        });
      }

      const bundleAssets = Array.from(bundleEventIdSet).flatMap(
        (eventId) => bundleAssetByEventId.get(eventId) ?? []
      );
      if (bundleAssets.length > 0) {
        const items = bundleAssets.map((asset) => ({
          id: asset.id,
          label: asset.label ?? t("assetUntitled"),
          amount: typeof asset.currentValue === "number" ? asset.currentValue : null,
        }));
        const summaryAmount = items.some((item) => item.amount !== null)
          ? items.reduce((sum, item) => sum + (item.amount ?? 0), 0)
          : null;
        slices.assets.push({
          id: `${bundleId}-assets`,
          bundleId,
          title,
          summaryAmount,
          items,
        });
      }

      const bundleLiabilities = Array.from(bundleEventIdSet).flatMap(
        (eventId) => bundleLiabilityByEventId.get(eventId) ?? []
      );
      if (bundleLiabilities.length > 0) {
        const items = bundleLiabilities.map((liability) => ({
          id: liability.id,
          label: liability.label ?? t("liabilityUntitled"),
          amount:
            typeof liability.principalOutstanding === "number"
              ? liability.principalOutstanding
              : null,
        }));
        const summaryAmount = items.some((item) => item.amount !== null)
          ? items.reduce((sum, item) => sum + (item.amount ?? 0), 0)
          : null;
        slices.liabilities.push({
          id: `${bundleId}-liabilities`,
          bundleId,
          title,
          summaryAmount,
          items,
        });
      }
    });

    return slices;
  }, [
    bundleAssetItems,
    bundleGroups,
    bundleLiabilityItems,
    bundleSummaryLabels,
    ledgerRowsByEventId,
    resolveBundleTitle,
    scenarioIsV2,
    selectedDashboardMonth,
    t,
  ]);
  const formatSliceAmount = useCallback(
    (amount: number | null) =>
      amount !== null
        ? formatCurrency(amount, scenario?.baseCurrency ?? "USD", locale)
        : t("amountUnset"),
    [locale, scenario?.baseCurrency, t]
  );
  const formatGrowthPct = useCallback(
    (value: number | null | undefined) => {
      if (!Number.isFinite(value ?? NaN)) {
        return "0";
      }
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
        value ?? 0
      );
    },
    [locale]
  );
  const handleUpsertAssetItem = (item: ScenarioAsset) => {
    if (!scenario || !scenarioIdValue) {
      return;
    }
    const isNew = !scenarioAssets.some((asset) => asset.id === item.id);
    upsertScenarioAssets(scenarioIdValue, [
      {
        ...item,
        currency: item.currency ?? scenario.baseCurrency,
        source: item.source ?? "manual",
      },
    ]);
    if (isNew) {
      setAssetHoldingCostNotice(true);
    }
  };

  useEffect(() => {
    if (!scenarioIdValue || !cashAsset || hasSyncedCashAsset.current) {
      return;
    }
    if (
      typeof cashAsset.currentValue === "number" &&
      cashAsset.currentValue !== scenario?.assumptions.initialCash
    ) {
      setScenarioInitialCash(scenarioIdValue, cashAsset.currentValue);
    }
    if (!scenario?.assumptions.baseMonth && cashAsset.startMonth) {
      setScenarioBaseMonth(scenarioIdValue, cashAsset.startMonth);
    }
    hasSyncedCashAsset.current = true;
  }, [
    cashAsset,
    scenario?.assumptions.baseMonth,
    scenario?.assumptions.initialCash,
    scenarioIdValue,
    setScenarioBaseMonth,
    setScenarioInitialCash,
  ]);

  const focusCashCard = useCallback(() => {
    setActiveTab("assets");
    setShouldFocusCashCard(true);
  }, []);

  const handleCashAmountChange = useCallback(
    (value: number) => {
      if (!scenarioIdValue) {
        return;
      }
      setScenarioInitialCash(scenarioIdValue, Math.max(0, value));
      if (cashAsset) {
        upsertScenarioAssets(scenarioIdValue, [
          {
            ...cashAsset,
            currentValue: Math.max(0, value),
            startMonth: cashAsset.startMonth ?? baseMonth ?? undefined,
            currency: cashAsset.currency ?? scenario?.baseCurrency,
            source: cashAsset.source ?? "manual",
          },
        ]);
      }
    },
    [
      baseMonth,
      cashAsset,
      scenario?.baseCurrency,
      scenarioIdValue,
      setScenarioInitialCash,
      upsertScenarioAssets,
    ]
  );

  const handleCashBaseMonthChange = useCallback(
    (value: string | null) => {
      if (!scenarioIdValue) {
        return;
      }
      setScenarioBaseMonth(scenarioIdValue, value);
      if (cashAsset) {
        upsertScenarioAssets(scenarioIdValue, [
          {
            ...cashAsset,
            startMonth: value ?? undefined,
            currency: cashAsset.currency ?? scenario?.baseCurrency,
            source: cashAsset.source ?? "manual",
          },
        ]);
      }
    },
    [
      cashAsset,
      scenario?.baseCurrency,
      scenarioIdValue,
      setScenarioBaseMonth,
      upsertScenarioAssets,
    ]
  );
  const handleRemoveAssetItem = (item: ScenarioAsset) => {
    if (!scenarioIdValue) {
      return;
    }
    if (isDerivedFromEvent(item)) {
      const eventId = getEventIdFromItem(item);
      if (eventId) {
        handleDeleteV2Event(eventId);
      }
      return;
    }
    setDeleteConfirmation({
      type: "asset",
      id: item.id,
      label: item.label ?? t("assetUntitled"),
      impact: {
        impactedAssets: [item],
        impactedLiabilities: [],
        ledger: createEmptyLedgerPreview(),
      },
    });
  };
  const handleUpsertLiabilityItem = (item: ScenarioLiability) => {
    if (!scenarioIdValue) {
      return;
    }
    upsertScenarioLiabilities(scenarioIdValue, [
      {
        ...item,
        source: item.source ?? "manual",
      },
    ]);
  };
  const handleRemoveLiabilityItem = (item: ScenarioLiability) => {
    if (!scenarioIdValue) {
      return;
    }
    if (isDerivedFromEvent(item)) {
      const eventId = getEventIdFromItem(item);
      if (eventId) {
        handleDeleteV2Event(eventId);
      }
      return;
    }
    setDeleteConfirmation({
      type: "liability",
      id: item.id,
      label: item.label ?? t("liabilityUntitled"),
      impact: {
        impactedAssets: [],
        impactedLiabilities: [item],
        ledger: createEmptyLedgerPreview(),
      },
    });
  };
  const inputsItems = useMemo(() => {
    if (inputsFilter === "rules") {
      return inputRuleItems;
    }
    if (inputsFilter === "assets") {
      return inputAssetItems;
    }
    if (inputsFilter === "events") {
      return inputEventItems;
    }
    return [...inputRuleItems, ...inputAssetItems, ...inputEventItems];
  }, [inputAssetItems, inputEventItems, inputRuleItems, inputsFilter]);
  const visibleBundleCards = useMemo(() => {
    if (inputsFilter === "all" || inputsFilter === "events") {
      return bundleCardItems;
    }
    return [];
  }, [bundleCardItems, inputsFilter]);
  const isPastSellMonth = (sellMonth?: string) => {
    if (!sellMonth || !currentProjectionMonth) {
      return false;
    }
    if (!isValidMonthStr(sellMonth) || !isValidMonthStr(currentProjectionMonth)) {
      return false;
    }
    return monthIndex(currentProjectionMonth, sellMonth) < 0;
  };
  const renderBundleSliceSection = (
    slices: BundleSlice[],
    summaryKey:
      | "bundleSliceIncomeSummary"
      | "bundleSliceExpenseSummary"
      | "bundleSliceAssetSummary"
      | "bundleSliceLiabilitySummary"
  ) => {
    if (slices.length === 0) {
      return null;
    }
    return (
      <Stack gap="xs">
        <Text size="sm" fw={600}>
          {t("bundleSliceSectionTitle")}
        </Text>
        {slices.map((slice) => {
          const expanded = expandedBundleSliceIds.includes(slice.id);
          return (
            <Card key={slice.id} withBorder radius="md" padding="sm">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={2}>
                    <Text fw={600}>{slice.title}</Text>
                    <Text size="sm" c="dimmed">
                      {t(summaryKey, {
                        amount: formatSliceAmount(slice.summaryAmount),
                      })}
                    </Text>
                  </Stack>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => handleViewBundle(slice.bundleId)}
                    >
                      {t("bundleCardView")}
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => toggleBundleSliceExpanded(slice.id)}
                    >
                      {expanded ? t("bundleSliceCollapse") : t("bundleSliceExpand")}
                    </Button>
                  </Group>
                </Group>
                {expanded && (
                  <Stack gap={4}>
                    {slice.items.map((item) => (
                      <Group
                        key={item.id}
                        justify="space-between"
                        wrap="nowrap"
                        onClick={() => handleViewBundle(slice.bundleId)}
                        style={{ cursor: "pointer" }}
                      >
                        <Text size="sm">
                          {item.label}
                          {item.subLabel ? ` · ${item.subLabel}` : ""}
                        </Text>
                        <Text size="sm" fw={500}>
                          {formatSliceAmount(item.amount)}
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          );
        })}
      </Stack>
    );
  };

  useEffect(() => {
    if (hasHandledInitialAdd.current) {
      return;
    }
    if (!initialAdd || !scenarioIdValue) {
      return;
    }
    const action = initialAdd as MoneyAddAction;
    if (action === "event") {
      setActiveTab("income");
      handleAddCashflowEvent("income");
      hasHandledInitialAdd.current = true;
      return;
    }
    if (action === "loan") {
      setActiveTab("liabilities");
      setCreatingLoan(createLoanPositionFromTemplate({ baseMonth }));
      hasHandledInitialAdd.current = true;
      return;
    }
    if (action === "home") {
      setActiveTab("assets");
      setCreatingHome(createHomePositionFromTemplate({ baseMonth }));
      hasHandledInitialAdd.current = true;
      return;
    }
    if (action === "investment") {
      setActiveTab("assets");
      setCreatingInvestment(createInvestmentPositionFromTemplate({ baseMonth }));
      hasHandledInitialAdd.current = true;
      return;
    }
    if (action === "insurance") {
      setActiveTab("assets");
      setCreatingInsurance(createInsurancePositionFromTemplate({ baseMonth }));
      hasHandledInitialAdd.current = true;
      return;
    }
    if (action === "car") {
      setActiveTab("assets");
      setCreatingCar(createCarPositionFromTemplate({ baseMonth }));
      hasHandledInitialAdd.current = true;
    }
  }, [baseMonth, handleAddCashflowEvent, initialAdd, scenarioIdValue, setActiveTab]);

  useEffect(() => {
    if (hasHandledInitialEdit.current) {
      return;
    }
    if (!scenarioIdValue) {
      return;
    }
    if (initialEditEventId) {
      const match = v2ScenarioEvents.find((event) => event.id === initialEditEventId);
      if (match) {
        setActiveTab("income");
        openV2EventDrawer("edit", match.type, match.id);
        hasHandledInitialEdit.current = true;
        return;
      }
    }
    if (initialEditHomeId) {
      setActiveTab("assets");
      setEditingHomeId(initialEditHomeId);
      hasHandledInitialEdit.current = true;
      return;
    }
    if (initialEditSmartInvest) {
      setActiveTab("assets");
      openDrawer("smartInvest");
      hasHandledInitialEdit.current = true;
    }
  }, [
    initialEditEventId,
    initialEditHomeId,
    initialEditSmartInvest,
    openDrawer,
    openV2EventDrawer,
    scenarioIdValue,
    setActiveTab,
    v2ScenarioEvents,
  ]);

  useEffect(() => {
    if (!assetDetails) {
      setAssetDetailsMonth(null);
      return;
    }
    setAssetDetailsMonth(latestProjectionMonth);
  }, [assetDetails, latestProjectionMonth]);

  // Close asset details drawer if the displayed asset was deleted
  useEffect(() => {
    if (!assetDetails || !scenarioIdValue) return;
    
    const assetExists = (() => {
      switch (assetDetails.type) {
        case "home":
          return assetDetails.id && homes.some((h) => h.id === assetDetails.id);
        case "car":
          return assetDetails.id && cars.some((c) => c.id === assetDetails.id);
        case "investment":
          return assetDetails.id && investments.some((i) => i.id === assetDetails.id);
        case "insurance":
          return assetDetails.id && insurances.some((i) => i.id === assetDetails.id);
        case "loan":
          return assetDetails.id && loans.some((loan) => loan.id === assetDetails.id);
        case "smartInvest":
          return true; // smartInvest is never truly deleted, just disabled
        default:
          return false;
      }
    })();

    if (!assetExists) {
      setAssetDetails(null);
    }
  }, [homes, cars, investments, insurances, loans, assetDetails, scenarioIdValue]);

  useEffect(() => {
    if (!mortgageDetail) {
      return;
    }
    if (!mortgageDetailEvent) {
      setMortgageDetail(null);
    }
  }, [mortgageDetail, mortgageDetailEvent]);

  const removeBundleEvents = useCallback(
    (bundleId: string, eventIds: string[]) => {
      if (!scenarioIdValue || !scenario) {
        return;
      }
      const eventIdSet = new Set(eventIds);
      const remainingEvents = (scenario.events ?? []).filter(
        (event) => !eventIdSet.has(event.id)
      );
      const referencedAssetIds = new Set<string>();
      const referencedLiabilityIds = new Set<string>();
      remainingEvents.forEach((event) => {
        if (event.type === "housing" && event.kind === "mortgage") {
          if (event.propertyAssetId) {
            referencedAssetIds.add(event.propertyAssetId);
          }
          if (event.mortgageLiabilityId) {
            referencedLiabilityIds.add(event.mortgageLiabilityId);
          }
        }
        if (event.type === "insurance" && event.mode === "detailed") {
          (event.policies ?? []).forEach((policy) => {
            if (policy.policyAssetId) {
              referencedAssetIds.add(policy.policyAssetId);
            }
          });
        }
        if (event.type === "loan" && event.liabilityId) {
          referencedLiabilityIds.add(event.liabilityId);
        }
      });
      const nextAssets = (scenario.assets ?? []).filter((asset) => {
        if (!asset.createdByEventId || !eventIdSet.has(asset.createdByEventId)) {
          return true;
        }
        return referencedAssetIds.has(asset.id);
      });
      const nextLiabilities = (scenario.liabilities ?? []).filter((liability) => {
        if (
          !liability.createdByEventId ||
          !eventIdSet.has(liability.createdByEventId)
        ) {
          return true;
        }
        return referencedLiabilityIds.has(liability.id);
      });
      setScenarioEvents(scenarioIdValue, remainingEvents);
      setScenarioAssets(scenarioIdValue, nextAssets);
      setScenarioLiabilities(scenarioIdValue, nextLiabilities);
      removeBundleInstanceRecord(scenarioIdValue, bundleId);
    },
    [
      removeBundleInstanceRecord,
      scenario,
      scenarioIdValue,
      setScenarioAssets,
      setScenarioEvents,
      setScenarioLiabilities,
    ]
  );

  // Close editing drawers if the edited item was deleted
  useEffect(() => {
    if (editingHomeId && !homes.some((h) => h.id === editingHomeId)) {
      setEditingHomeId(null);
    }
    if (editingCarId && !cars.some((c) => c.id === editingCarId)) {
      setEditingCarId(null);
    }
    if (editingInvestmentId && !investments.some((i) => i.id === editingInvestmentId)) {
      setEditingInvestmentId(null);
    }
    if (editingInsuranceId && !insurances.some((i) => i.id === editingInsuranceId)) {
      setEditingInsuranceId(null);
    }
    if (editingLoanId && !loans.some((l) => l.id === editingLoanId)) {
      setEditingLoanId(null);
    }
  }, [homes, cars, investments, insurances, loans, editingHomeId, editingCarId, editingInvestmentId, editingInsuranceId, editingLoanId]);

  const handleConfirmDelete = () => {
    if (!deleteConfirmation || !scenarioIdValue) return;
    const { type } = deleteConfirmation;

    switch (type) {
      case "eventV2": {
        const targetEvent = v2ScenarioEvents.find((event) => event.id === deleteConfirmation.id);
        if (targetEvent && isSalaryAdjustmentEvent(targetEvent)) {
          const parentEventId = getSalaryAdjustmentParentEventId(targetEvent);
          if (parentEventId) {
            applySalaryScheduleNormalization({
              parentEventId,
              deletedEventId: deleteConfirmation.id,
            });
            break;
          }
        }
        removeEvent(deleteConfirmation.id, scenarioIdValue, { cascade: true });
        break;
      }
      case "bundle":
      case "bundleItem":
        removeBundleEvents(deleteConfirmation.bundleId, deleteConfirmation.eventIds);
        break;
      case "asset": {
        if (!scenario) {
          break;
        }
        const nextAssets = (scenario.assets ?? []).filter(
          (entry) => entry.id !== deleteConfirmation.id
        );
        setScenarioAssets(scenarioIdValue, nextAssets);
        break;
      }
      case "liability": {
        if (!scenario) {
          break;
        }
        const nextLiabilities = (scenario.liabilities ?? []).filter(
          (entry) => entry.id !== deleteConfirmation.id
        );
        setScenarioLiabilities(scenarioIdValue, nextLiabilities);
        break;
      }
    }

    if (type === "bundle" || type === "bundleItem") {
      setBundleViewId(null);
    }

    setDeleteConfirmation(null);
  };

  const handleConfirmAdjustment = () => {
    if (!adjustmentDraft || !scenarioIdValue) {
      return;
    }
    const amountValue = Number(adjustmentDraft.amount);
    if (!Number.isFinite(amountValue) || amountValue === 0) {
      setAdjustmentDraft({
        ...adjustmentDraft,
        error: t("ledgerAdjustmentAmountRequired"),
      });
      return;
    }
    const sourceEvent = v2ScenarioEvents.find(
      (event) => event.id === adjustmentDraft.sourceEventId
    );
    if (!sourceEvent) {
      setLedgerActionError(t("ledgerEventMissing"));
      return;
    }

    if (!isValidMonthStr(adjustmentDraft.month)) {
      setLedgerActionError(t("ledgerEventStartRequired"));
      return;
    }

    let payload: ScenarioEvent | null = null;
    switch (sourceEvent.type) {
      case "cashflow":
        payload = {
          ...sourceEvent,
          amount: amountValue,
          startMonth:
            sourceEvent.cadence === "oneOff"
              ? sourceEvent.startMonth
              : adjustmentDraft.month,
          occurrenceMonth:
            sourceEvent.cadence === "oneOff"
              ? adjustmentDraft.month
              : sourceEvent.occurrenceMonth,
          effectiveMonth: sourceEvent.groupRole === "adjustment" ? adjustmentDraft.month : sourceEvent.effectiveMonth,
        };
        break;
      case "adjustment":
        payload = {
          ...sourceEvent,
          amount: amountValue,
          month: adjustmentDraft.month,
        };
        break;
      case "housing":
        payload = {
          ...sourceEvent,
          startMonth: adjustmentDraft.month,
          rentMonthly:
            sourceEvent.kind === "rent" ? amountValue : sourceEvent.rentMonthly,
          mortgagePayment:
            sourceEvent.kind === "mortgage" ? amountValue : sourceEvent.mortgagePayment,
        };
        break;
      case "loan":
        payload = {
          ...sourceEvent,
          startMonth: adjustmentDraft.month,
          monthlyPayment: amountValue,
          paymentMethod: "manual",
          paymentIsEstimated: false,
        };
        break;
      case "insurance":
        if (sourceEvent.mode !== "quick") {
          setLedgerActionError(t("ledgerEventUpdateFailed"));
          return;
        }
        payload = {
          ...sourceEvent,
          startMonth: adjustmentDraft.month,
          premiumMonthly: amountValue,
        };
        break;
      default:
        payload = null;
    }
    if (!payload) {
      setLedgerActionError(t("ledgerEventUpdateFailed"));
      return;
    }

    const result = updateEvent(sourceEvent.id, payload, scenarioIdValue);
    if (!result.ok) {
      setLedgerActionError(t("ledgerEventUpdateFailed"));
      return;
    }
    setAdjustmentDraft(null);
  };
  
  const editingHome = homes.find((home) => home.id === editingHomeId) ?? null;
  const editingCar = cars.find((car) => car.id === editingCarId) ?? null;
  const editingInvestment =
    investments.find((investment) => investment.id === editingInvestmentId) ?? null;
  const editingInsurance =
    insurances.find((insurance) => insurance.id === editingInsuranceId) ?? null;
  const editingLoan = loans.find((loan) => loan.id === editingLoanId) ?? null;

  const sellEntries = useMemo(
    () => (scenario ? compileSellLifecycle(scenario) : []),
    [scenario]
  );

  const buildAssetCashflowSeries = useMemo(() => {
    if (!projection) {
      return () => [];
    }
    return (
      predicate: (key: string) => boolean,
      extraEntries?: Array<{ month: string; amount: number }>
    ) => {
      const totals = new Map<string, number>();
      projection.months.forEach((month) => totals.set(month, 0));
      const breakdown = projection.breakdown?.cashflow.byKey ?? {};
      Object.entries(breakdown).forEach(([key, series]) => {
        if (!predicate(key)) {
          return;
        }
        series.forEach((amount, index) => {
          if (!amount) {
            return;
          }
          const month = projection.months[index];
          if (!month) {
            return;
          }
          totals.set(month, (totals.get(month) ?? 0) + amount);
        });
      });
      extraEntries?.forEach((entry) => {
        if (!totals.has(entry.month)) {
          return;
        }
        totals.set(entry.month, (totals.get(entry.month) ?? 0) + entry.amount);
      });
      return projection.months.map((month) => ({
        month,
        amount: totals.get(month) ?? 0,
      }));
    };
  }, [projection]);

  const assetDetailsData = useMemo(() => {
    if (!assetDetails || !projection) {
      return null;
    }
    const assetsByKey = projection.breakdown?.assets.assetsByKey ?? {};
    const liabilitiesByKey = projection.breakdown?.assets.liabilitiesByKey ?? {};
    const monthIndexValue =
      assetDetailsMonth && projection.months.includes(assetDetailsMonth)
        ? projection.months.indexOf(assetDetailsMonth)
        : Math.max(projection.months.length - 1, 0);
    const selectedMonth = projection.months[monthIndexValue];
    const withSeriesValue = (series: number[] | undefined) =>
      series?.[monthIndexValue] ?? 0;

    if (assetDetails.type === "home" && assetDetails.id) {
      const assetKey = `home:${assetDetails.id}`;
      const liabilityKey = `home:${assetDetails.id}:mortgage`;
      const cashflowSeries = buildAssetCashflowSeries(
        (key) => key.startsWith(`home:${assetDetails.id}:`),
        sellEntries
          .filter((entry) => entry.positionType === "home" && entry.positionId === assetDetails.id)
          .map((entry) => ({ month: entry.month, amount: entry.amount }))
      );
      return {
        title: homesText("title"),
        selectedMonth,
        cashflowSeries,
        assetValue: withSeriesValue(assetsByKey[assetKey]),
        liabilityValue: withSeriesValue(liabilitiesByKey[liabilityKey]),
      };
    }

    if (assetDetails.type === "investment" && assetDetails.id) {
      const assetKey = `investment:${assetDetails.id}`;
      const cashflowSeries = buildAssetCashflowSeries((key) =>
        key.startsWith(`investment:${assetDetails.id}:`)
      );
      return {
        title: investmentsText("title"),
        selectedMonth,
        cashflowSeries,
        assetValue: withSeriesValue(assetsByKey[assetKey]),
      };
    }

    if (assetDetails.type === "insurance" && assetDetails.id) {
      const assetKey = `insurance:${assetDetails.id}`;
      const cashflowSeries = buildAssetCashflowSeries((key) =>
        key.startsWith(`insurance:${assetDetails.id}:`)
      );
      return {
        title: insurancesText("title"),
        selectedMonth,
        cashflowSeries,
        assetValue: withSeriesValue(assetsByKey[assetKey]),
      };
    }

    if (assetDetails.type === "car" && assetDetails.id) {
      const assetKey = `car:${assetDetails.id}`;
      const liabilityKey = `car:${assetDetails.id}:loan`;
      const cashflowSeries = buildAssetCashflowSeries(
        (key) => key.startsWith(`car:${assetDetails.id}:`),
        sellEntries
          .filter((entry) => entry.positionType === "car" && entry.positionId === assetDetails.id)
          .map((entry) => ({ month: entry.month, amount: entry.amount }))
      );
      return {
        title: carsText("title"),
        selectedMonth,
        cashflowSeries,
        assetValue: withSeriesValue(assetsByKey[assetKey]),
        liabilityValue: withSeriesValue(liabilitiesByKey[liabilityKey]),
      };
    }

    if (assetDetails.type === "loan" && assetDetails.id) {
      const liabilityKey = `loan:${assetDetails.id}`;
      const loan = loans.find((entry) => entry.id === assetDetails.id);
      const cashflowSeries =
        loan && baseMonth
          ? buildLoanCashflowBreakdown({
              loan,
              baseMonth,
              horizonMonths: projection.months.length,
            }).series
          : [];
      return {
        title: loansText("title"),
        selectedMonth,
        cashflowSeries,
        liabilityValue: withSeriesValue(liabilitiesByKey[liabilityKey]),
      };
    }

    if (assetDetails.type === "smartInvest") {
      return {
        title: timelineText("smartInvestTitle"),
        selectedMonth,
        cashflowSeries: buildAssetCashflowSeries((key) =>
          key.startsWith("investment:smart-invest-")
        ),
        assetValue:
          smartInvestBreakdown?.totalValueSeries[monthIndexValue]?.value ?? 0,
        allocationRows: smartInvestBreakdown?.currentBucketValues ?? [],
      };
    }

    return null;
  }, [
    assetDetails,
    assetDetailsMonth,
    baseMonth,
    buildAssetCashflowSeries,
    carsText,
    homesText,
    insurancesText,
    investmentsText,
    loans,
    loansText,
    projection,
    sellEntries,
    smartInvestBreakdown,
    timelineText,
  ]);

  const openCashflowModal = (
    title: string,
    entries: PositionCashflowEntry[],
    series: CashflowPreviewPoint[]
  ) => {
    setCashflowModal({
      opened: true,
      title,
      entries,
      series,
    });
  };

  const openCalculatorModal = (
    title: string,
    amortizationRows?: AmortizationRow[],
    valueRows?: ValueRow[],
    contributionRows?: ContributionRow[],
    assetValueRows?: ValueTableRow[],
    bucketValueSeries?: SmartInvestProjectionBreakdown["bucketSeries"],
    bucketCurrentRows?: SmartInvestProjectionBreakdown["currentBucketValues"]
  ) => {
    setCalculatorModal({
      opened: true,
      title,
      amortizationRows,
      valueRows,
      contributionRows,
      assetValueRows,
      bucketValueSeries,
      bucketCurrentRows,
    });
  };

  const handleViewCashflow = () => {
    if (!assetDetails || !projection) return;

    const horizonMonths = projection.months.length;

    if (assetDetails.type === "home" && assetDetails.id) {
      const home = homes.find((h) => h.id === assetDetails.id);
      if (!home) return;
      const breakdown = buildHomeCashflowBreakdown({
        home,
        baseMonth,
        horizonMonths,
      });
      openCashflowModal(
        homesText("title"),
        breakdown.entries,
        breakdown.series
      );
    } else if (assetDetails.type === "car" && assetDetails.id) {
      const car = cars.find((c) => c.id === assetDetails.id);
      if (!car) return;
      const breakdown = buildCarCashflowBreakdown({
        car,
        baseMonth,
        horizonMonths,
      });
      openCashflowModal(
        carsText("title"),
        breakdown.entries,
        breakdown.series
      );
    } else if (assetDetails.type === "investment" && assetDetails.id) {
      const investment = investments.find((i) => i.id === assetDetails.id);
      if (!investment) return;
      const breakdown = buildInvestmentCashflowBreakdown({
        investment,
        baseMonth,
        horizonMonths,
      });
      openCashflowModal(
        investmentsText("title"),
        breakdown.entries,
        breakdown.series
      );
    } else if (assetDetails.type === "insurance" && assetDetails.id) {
      const insurance = insurances.find((i) => i.id === assetDetails.id);
      if (!insurance) return;
      const breakdown = buildInsuranceCashflowBreakdown({
        insurance,
        baseMonth,
        horizonMonths,
      });
      openCashflowModal(
        insurancesText("title"),
        breakdown.entries,
        breakdown.series
      );
    } else if (assetDetails.type === "loan" && assetDetails.id) {
      const loan = loans.find((entry) => entry.id === assetDetails.id);
      if (!loan) return;
      const breakdown = buildLoanCashflowBreakdown({
        loan,
        baseMonth,
        horizonMonths,
      });
      openCashflowModal(
        loansText("title"),
        breakdown.entries,
        breakdown.series
      );
    } else if (assetDetails.type === "smartInvest") {
      if (!smartInvestBreakdown) return;
      const entries = smartInvestBreakdown.cashflowSeries.map(
        (item: { month: string; amount: number }) => ({
          month: item.month,
          amount: item.amount,
          label: "smartInvest",
          sourceId: "smart-invest",
        })
      );
      openCashflowModal(
        timelineText("smartInvestTitle"),
        entries,
        smartInvestBreakdown.cashflowSeries.map(
          (item: { month: string; amount: number }) => ({
            month: item.month,
            amount: item.amount,
          })
        )
      );
    }
  };

  const handleViewCalculations = () => {
    if (!assetDetails || !projection) return;

    const horizonMonths = projection.months.length;

    if (assetDetails.type === "home" && assetDetails.id) {
      const home = homes.find((h) => h.id === assetDetails.id);
      if (!home) return;

      const amortizationRows: AmortizationRow[] = [];
      const valueRows: ValueRow[] = [];

      // Build amortization for existing or new purchase
      if (home.mode === "existing" && home.existing) {
        amortizationRows.push(
          ...buildAmortizationSchedule({
            principal: home.existing.mortgageBalance ?? 0,
            annualRateDecimal: (home.existing.annualRatePct ?? 0) / 100,
            termMonths: home.existing.remainingTermMonths ?? 0,
            startMonth: home.existing.asOfMonth ?? baseMonth ?? "",
          })
        );
      } else if (home.mode !== "existing" && home.mortgageTermYears && home.mortgageTermYears > 0) {
        const purchasePrice = home.purchasePrice ?? 0;
        const downPayment = home.downPayment ?? 0;
        const principal = purchasePrice - downPayment;
        amortizationRows.push(
          ...buildAmortizationSchedule({
            principal,
            annualRateDecimal: (home.mortgageRatePct ?? 0) / 100,
            termMonths: Math.round((home.mortgageTermYears ?? 0) * 12),
            startMonth: home.purchaseMonth ?? baseMonth ?? "",
          })
        );
      }

      // Build value schedule
      if (home.annualAppreciationPct !== undefined) {
        valueRows.push(
          ...buildValueSchedule({
            baseValue: home.purchasePrice ?? 0,
            annualAppreciationDecimal: (home.annualAppreciationPct ?? 0) / 100,
            startMonth: home.purchaseMonth ?? baseMonth ?? "",
            months: horizonMonths,
          })
        );
      }

      openCalculatorModal(
        homesText("title"),
        amortizationRows.length > 0 ? amortizationRows : undefined,
        valueRows.length > 0 ? valueRows : undefined
      );
    } else if (assetDetails.type === "car" && assetDetails.id) {
      const car = cars.find((c) => c.id === assetDetails.id);
      if (!car) return;

      const amortizationRows: AmortizationRow[] = [];
      const valueRows: ValueRow[] = [];

      // Build amortization for car loan
      if (car.loan) {
        amortizationRows.push(
          ...buildAmortizationSchedule({
            principal: car.loan.principal ?? 0,
            annualRateDecimal: (car.loan.annualInterestRatePct ?? 0) / 100,
            termMonths: Math.round((car.loan.termYears ?? 0) * 12),
            startMonth: car.purchaseMonth ?? baseMonth ?? "",
          })
        );
      }

      // Build value schedule (depreciation)
      const depreciationRatePct = resolveCarDepreciationRatePct(car);
      if (depreciationRatePct !== undefined) {
        valueRows.push(
          ...buildValueSchedule({
            baseValue: car.purchasePrice ?? 0,
            annualAppreciationDecimal: -depreciationRatePct / 100,
            startMonth: car.purchaseMonth ?? baseMonth ?? "",
            months: horizonMonths,
          })
        );
      }

      openCalculatorModal(
        carsText("title"),
        amortizationRows.length > 0 ? amortizationRows : undefined,
        valueRows.length > 0 ? valueRows : undefined
      );
    } else if (assetDetails.type === "investment" && assetDetails.id) {
      const investment = investments.find((i) => i.id === assetDetails.id);
      if (!investment) return;

      const assetValueRows = buildInvestmentValueTable({
        investment,
        baseMonth: baseMonth ?? "",
        horizonMonths,
      });

      const contributionRows = investment.monthlyContribution
        ? buildContributionSchedule({
            startMonth: investment.startMonth ?? baseMonth ?? "",
            monthlyContribution: investment.monthlyContribution,
            months: horizonMonths,
            annualGrowthDecimal: (investment.expectedAnnualReturnPct ?? 0) / 100,
          })
        : [];

      openCalculatorModal(
        investmentsText("title"),
        undefined,
        undefined,
        contributionRows.length > 0 ? contributionRows : undefined,
        assetValueRows.length > 0 ? assetValueRows : undefined
      );
    } else if (assetDetails.type === "loan" && assetDetails.id) {
      const loan = loans.find((entry) => entry.id === assetDetails.id);
      if (!loan) return;

      const amortizationRows = buildAmortizationSchedule({
        principal: loan.principal ?? 0,
        annualRateDecimal: (loan.annualInterestRatePct ?? 0) / 100,
        termMonths: Math.round((loan.termYears ?? 0) * 12),
        startMonth: loan.startMonth ?? baseMonth ?? "",
      });

      openCalculatorModal(
        loansText("title"),
        amortizationRows.length > 0 ? amortizationRows : undefined
      );
    } else if (assetDetails.type === "smartInvest") {
      if (!smartInvestBreakdown) return;

      openCalculatorModal(
        timelineText("smartInvestTitle"),
        undefined,
        undefined,
        undefined,
        undefined,
        smartInvestBreakdown.bucketSeries,
        smartInvestBreakdown.currentBucketValues
      );
    }
  };

  const assetCashflowSeries = assetDetailsData?.cashflowSeries ?? [];
  const assetMonthIndex =
    assetDetailsMonth && assetCashflowSeries.length > 0
      ? assetCashflowSeries.findIndex((entry) => entry.month === assetDetailsMonth)
      : assetCashflowSeries.length - 1;
  const resolvedAssetMonthIndex = assetMonthIndex >= 0 ? assetMonthIndex : assetCashflowSeries.length - 1;
  const assetCashflowWindowStart = Math.max(resolvedAssetMonthIndex - 11, 0);
  const assetCashflowWindow = assetCashflowSeries.slice(
    assetCashflowWindowStart,
    resolvedAssetMonthIndex + 1
  );
  const selectedAssetCashflow =
    assetCashflowSeries[resolvedAssetMonthIndex]?.amount ?? 0;
  const homeDrawerDraft = editingHome ?? creatingHome;
  const carDrawerDraft = editingCar ?? creatingCar;
  const investmentDrawerDraft = editingInvestment ?? creatingInvestment;
  const insuranceDrawerDraft = editingInsurance ?? creatingInsurance;
  const loanDrawerDraft = editingLoan ?? creatingLoan;


  return (
    <Stack
      gap="xl"
      style={
        isMobile
          ? { paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }
          : undefined
      }
    >
      <TwoPaneLayout
        left={
          <Stack gap="xl">
            <Group justify="space-between" align="center" wrap="nowrap">
              <Stack gap={2}>
                <Title order={isMobile ? 3 : 2}>{t("title")}</Title>
                {!isMobile && (
                  <Text size="sm" c="dimmed">
                    {t("subtitle")}
                  </Text>
                )}
              </Stack>
              <Button
                onClick={() =>
                   openCreationDrawer()
                }
              >
                {t("addCta")}
              </Button>
            </Group>
            {showPlaceholderBanner && (
              <Card withBorder radius="md" padding="md">
                <Group justify="space-between" align="flex-start" wrap="wrap">
                  <Stack gap={2}>
                    <Text fw={600}>{t("placeholdersBannerTitle")}</Text>
                    <Text size="sm" c="dimmed">
                      {t("placeholdersBannerBody")}
                    </Text>
                    {initialShowOnboardingSkipped && (
                      <Text size="sm" c="dimmed">
                        {t("placeholdersBannerSkipped")}
                      </Text>
                    )}
                  </Stack>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => setDismissedPlaceholderBanner(true)}
                  >
                    {t("placeholdersBannerDismiss")}
                  </Button>
                </Group>
              </Card>
            )}
            <Tabs value={activeTab} onChange={(value) => setActiveTab(value as MoneyTab)}>
              {isMobile ? (
                <ScrollArea scrollbarSize={4} offsetScrollbars>
                  <Tabs.List style={{ flexWrap: "nowrap" }}>
                    <Tabs.Tab value="income" style={{ minHeight: 44 }}>
                      {t("incomeTitle")}
                    </Tabs.Tab>
                    <Tabs.Tab value="expenses" style={{ minHeight: 44 }}>
                      {t("expensesTitle")}
                    </Tabs.Tab>
                    <Tabs.Tab value="assets" style={{ minHeight: 44 }}>
                      {t("assetsTitle")}
                    </Tabs.Tab>
                    <Tabs.Tab value="liabilities" style={{ minHeight: 44 }}>
                      {t("liabilitiesTitle")}
                    </Tabs.Tab>
                    <Tabs.Tab value="inputs" style={{ minHeight: 44 }}>
                      {t("inputsTitle")}
                    </Tabs.Tab>
                  </Tabs.List>
                </ScrollArea>
              ) : (
                <Tabs.List>
                  <Tabs.Tab value="income">{t("incomeTitle")}</Tabs.Tab>
                  <Tabs.Tab value="expenses">{t("expensesTitle")}</Tabs.Tab>
                  <Tabs.Tab value="assets">{t("assetsTitle")}</Tabs.Tab>
                  <Tabs.Tab value="liabilities">{t("liabilitiesTitle")}</Tabs.Tab>
                  <Tabs.Tab value="inputs">{t("inputsTitle")}</Tabs.Tab>
                </Tabs.List>
              )}

        <Tabs.Panel value="income" pt="md">
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm" c="dimmed">
                {t("incomeDescription")}
              </Text>
              {!isMobile && (
                <Button size="xs" variant="light" onClick={() => handleAddCashflowEvent("income")}>
                  {t("eventCardAddEvent")}
                </Button>
              )}
            </Group>
            {ledgerActionError && (
              <Text size="sm" c="red">
                {ledgerActionError}
              </Text>
            )}
            {ledgerActionSuccess && (
              <Notification color="teal" onClose={() => setLedgerActionSuccess(null)}>
                {ledgerActionSuccess}
              </Notification>
            )}
            {derivedIncomeItems.length > 0 && (
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  {t("derivedIncomeSectionTitle")}
                </Text>
                {derivedIncomeItems.map((item) => (
                  <Card key={item.id} withBorder radius="md" padding="sm">
                    <Stack gap={6}>
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Text fw={600}>{t("derivedIncomeLabel")}</Text>
                        <Text fw={600}>
                          {item.amount !== null
                            ? formatCurrency(
                                item.amount,
                                scenario?.baseCurrency ?? "USD",
                                locale
                              )
                            : t("amountUnset")}
                        </Text>
                      </Group>
                      <Group gap="xs" align="center" wrap="wrap">
                        <Text size="xs" c="dimmed">
                          {t("derivedIncomeSourceLabel")}
                        </Text>
                        <Badge
                          variant="light"
                          component="button"
                          type="button"
                          onClick={() => openMortgageDetails(item.sourceEventId, "cashflow")}
                          style={{ cursor: "pointer" }}
                        >
                          {item.sourceLabel}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {t("derivedIncomeLockedHint")}
                        </Text>
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            )}
            <IncomeSummarySection
              locale={locale}
              currency={scenario?.baseCurrency ?? "USD"}
              members={members}
              selectedMemberId={incomeMemberFilter}
              selectedStatus={incomeStatusFilter}
              onMemberChange={setIncomeMemberFilter}
              onStatusChange={setIncomeStatusFilter}
              baselineMonthlyTotal={incomeSummary.baselineMonthlyTotal}
              nonMonthlyIncomeTotal={incomeSummary.nonMonthlyIncomeTotal}
              sourceCount={incomeSummary.sourceCount}
              memberCount={incomeSummary.memberCount}
              projectedDelta12m={incomeSummary.projectedDelta12m}
              expiringCount={incomeSummary.expiringCount}
              topSources={incomeSummary.topSources}
            />
            {renderBundleSliceSection(
              bundleSlicesByType.income,
              "bundleSliceIncomeSummary"
            )}
            <IncomeEventList
              events={visibleIncomeEvents}
              ledgerRowsByEventId={ledgerRowsByEventId}
              baseCurrency={scenario?.baseCurrency ?? "USD"}
              locale={locale}
              incomeGrowthPct={incomeGrowthPct}
              memberLookupRecord={memberLookupRecord}
              sortBy={incomeSortBy}
              onSortByChange={setIncomeSortBy}
              onEditEvent={openEventDrawer}
              onDuplicateEvent={handleDuplicateV2Event}
              onDeleteEvent={handleDeleteV2Event}
              onAdjustEvent={handleAdjustEvent}
              onCreateSalaryAdjustment={handleCreateSalaryAdjustment}
              anchorMonth={selectedDashboardMonth ?? scenario?.assumptions.baseMonth ?? null}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="expenses" pt="md">
          <Stack gap="md">
            <Card withBorder radius="md" padding="md" display={"none"}>
              <Text size="sm">{t("expenseGuidance")}</Text>
            </Card>
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm" c="dimmed">
                {t("expensesDescription")}
              </Text>
              {!isMobile && (
                <Button size="xs" variant="light" onClick={() => handleAddCashflowEvent("expense")}>
                  {t("eventCardAddEvent")}
                </Button>
              )}
            </Group>
            {ledgerActionError && (
              <Text size="sm" c="red">
                {ledgerActionError}
              </Text>
            )}
            <ExpenseSummarySection
              locale={locale}
              currency={scenario?.baseCurrency ?? "USD"}
              baselineMonthlyTotal={expenseSummary.baselineMonthlyTotal}
              sourceCount={expenseSummary.sourceCount}
              memberCount={expenseSummary.memberCount}
              projectedDelta12m={expenseSummary.projectedDelta12m}
              expiringCount={expenseSummary.expiringCount}
              topSources={expenseSummary.topSources}
            />
            {renderBundleSliceSection(
              bundleSlicesByType.expenses,
              "bundleSliceExpenseSummary"
            )}
            <EventCardList
              events={standaloneExpenseEvents}
              ledgerRowsByEventId={ledgerRowsByEventId}
              baseCurrency={scenario?.baseCurrency ?? "USD"}
              locale={locale}
              incomeGrowthPct={incomeGrowthPct}
              onEditEvent={openEventDrawer}
              onDuplicateEvent={handleDuplicateV2Event}
              onDeleteEvent={handleDeleteV2Event}
              onAdjustEvent={handleAdjustEvent}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="assets" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("assetsDescription")}
            </Text>
            <div id="cash" ref={cashCardRef}>
              <CashBalanceCard
                value={initialCashValue}
                baseMonth={baseMonth}
                currency={scenario?.baseCurrency ?? "USD"}
                amountInputRef={cashInputRef}
                onChangeAmount={handleCashAmountChange}
                onChangeBaseMonth={handleCashBaseMonthChange}
              />
            </div>
            {assetHoldingCostNotice && (
              <Notification
                color="blue"
                onClose={() => setAssetHoldingCostNotice(false)}
              >
                {t("assetHoldingCostHint")}
              </Notification>
            )}
            {renderBundleSliceSection(
              bundleSlicesByType.assets,
              "bundleSliceAssetSummary"
            )}
            <ScenarioAssetManager
              items={standaloneAssetItems}
              baseCurrency={scenario?.baseCurrency ?? "USD"}
              locale={locale}
              sourceEventsByAssetId={assetSourcesById}
              onUpsert={handleUpsertAssetItem}
              onDelete={handleRemoveAssetItem}
              onEditEvent={openEventDrawer}
              onOpenMortgageDetails={openMortgageDetails}
              onAddItem={() =>
                openCreationDrawer({
                  intent: "item",
                  itemCategory: "assets",
                  templateCategory: "assets",
                })
              }
              openEditId={openAssetEditId}
              onOpenEditHandled={() => setOpenAssetEditId(null)}
              showAddButton={false}
              emptyStateLabel={
                nonCashAssets.length === 0
                  ? hasInitialCashSetup
                    ? t("assetManagerEmptyOptional")
                    : t("assetManagerEmpty")
                  : undefined
              }
              emptyStateAction={
                !hasInitialCashSetup && nonCashAssets.length === 0
                  ? { label: t("assetManagerEmptyCta"), onClick: focusCashCard }
                  : null
              }
            />
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text fw={600}>{timelineText("smartInvestTitle")}</Text>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => setAssetDetails({ type: "smartInvest" })}
                    disabled={!projection}
                  >
                    {common("actionDetails")}
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => openDrawer("smartInvest")}
                    disabled={!scenarioIdValue}
                  >
                    {common("actionEdit")}
                  </Button>
                </Group>
              </Group>
              <Card withBorder radius="md" padding="sm">
                <Stack gap={4}>
                  <Text size="sm" c="dimmed">
                    {timelineText("smartInvestSubtitle")}
                  </Text>
                  <Text size="sm">
                    {t("assetDetailsTotalValue", {
                      value: formatCurrency(
                        smartInvestBreakdown?.totalValueSeries.at(-1)?.value ?? 0,
                        scenario?.baseCurrency ?? "USD",
                        locale
                      ),
                    })}
                  </Text>
                </Stack>
              </Card>
            </Stack>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="liabilities" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("liabilitiesDescription")}
            </Text>
            {renderBundleSliceSection(
              bundleSlicesByType.liabilities,
              "bundleSliceLiabilitySummary"
            )}
            <ScenarioLiabilityManager
              items={standaloneLiabilityItems}
              sourceEventsByLiabilityId={liabilitySourcesById}
              onUpsert={handleUpsertLiabilityItem}
              onDelete={handleRemoveLiabilityItem}
              onEditEvent={openEventDrawer}
              onOpenMortgageDetails={openMortgageDetails}
              onAddItem={() =>
                openCreationDrawer({
                  intent: "item",
                  itemCategory: "liabilities",
                  templateCategory: "loans",
                })
              }
              openEditId={openLiabilityEditId}
              onOpenEditHandled={() => setOpenLiabilityEditId(null)}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="inputs" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("inputsDescription")}
            </Text>
            {bundleEditNotice && (
              <Notification
                color="yellow"
                onClose={() => setBundleEditNotice(null)}
              >
                <Group justify="space-between" align="center" wrap="wrap">
                  <Text size="sm">{t("bundleEditMissingInput")}</Text>
                  <Button size="xs" variant="light" onClick={handleRebuildBundle}>
                    {t("bundleEditMissingAction")}
                  </Button>
                </Group>
              </Notification>
            )}
            <SegmentedControl
              value={inputsFilter}
              onChange={(value) =>
                setInputsFilter(value as "all" | "assets" | "events")
              }
              data={[
                { value: "all", label: t("inputsFilterAll") },
                // { value: "rules", label: t("inputsFilterRules") },
                { value: "assets", label: t("inputsFilterAssets") },
                { value: "events", label: t("inputsFilterEvents") },
              ]}
            />
            {inputsItems.length === 0 && visibleBundleCards.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t("inputsEmpty")}
              </Text>
            ) : (
              <Stack gap="sm">
                {visibleBundleCards.map((bundle) => (
                  <Card
                    key={`bundle-${bundle.id}`}
                    withBorder
                    radius="md"
                    padding="md"
                    onClick={() => handleViewBundle(bundle.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start" wrap="wrap">
                        <Stack gap={2}>
                          <Text fw={600}>{bundle.title}</Text>
                          <Text size="sm" c="dimmed">
                            {t("bundleSummaryOneOff", {
                              amount:
                                bundle.oneOffTotal > 0
                                  ? formatCurrency(
                                      bundle.oneOffTotal,
                                      scenario?.baseCurrency ?? "USD",
                                      locale
                                    )
                                  : t("amountUnset"),
                            })}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {t("bundleSummaryMonthlyIncome", {
                              amount: bundle.hasMonthlyImpact
                                ? formatCurrency(
                                    bundle.monthlyIncome,
                                    scenario?.baseCurrency ?? "USD",
                                    locale
                                  )
                                : t("amountUnset"),
                            })}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {t("bundleSummaryMonthlyExpense", {
                              amount: bundle.hasMonthlyImpact
                                ? formatCurrency(
                                    bundle.monthlyExpense,
                                    scenario?.baseCurrency ?? "USD",
                                    locale
                                  )
                                : t("amountUnset"),
                            })}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {t("bundleSummaryMonthlyNet", {
                              amount: bundle.hasMonthlyImpact
                                ? formatCurrency(
                                    bundle.monthlyNet,
                                    scenario?.baseCurrency ?? "USD",
                                    locale
                                  )
                                : t("amountUnset"),
                            })}
                          </Text>
                          {bundle.hasStartMonthOneOffImpact && (
                            <Text size="sm" c="dimmed">
                              {t("bundleSummaryStartMonthNet", {
                                amount: formatCurrency(
                                  bundle.monthlySummary.startMonthNet,
                                  scenario?.baseCurrency ?? "USD",
                                  locale
                                ),
                                month: bundle.monthlySummary.month ?? "--",
                              })}
                            </Text>
                          )}
                          {bundle.assets.map((asset) => (
                            <Text size="sm" c="dimmed" key={asset.id}>
                              {t("bundleSummaryAssetItem", {
                                name: asset.label ?? t("assetUntitled"),
                                amount:
                                  typeof asset.currentValue === "number"
                                    ? formatCurrency(
                                        asset.currentValue,
                                        scenario?.baseCurrency ?? "USD",
                                        locale
                                      )
                                    : t("amountUnset"),
                              })}
                            </Text>
                          ))}
                          {bundle.liabilities.map((liability) => (
                            <Text size="sm" c="dimmed" key={liability.id}>
                              {t("bundleSummaryLiabilityItem", {
                                name: liability.label ?? t("liabilityUntitled"),
                                amount:
                                  typeof liability.principalOutstanding === "number"
                                    ? formatCurrency(
                                        liability.principalOutstanding,
                                        scenario?.baseCurrency ?? "USD",
                                        locale
                                      )
                                    : t("amountUnset"),
                              })}
                            </Text>
                          ))}
                        </Stack>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleViewBundle(bundle.id);
                            }}
                          >
                            {t("bundleCardView")}
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleEditBundle(bundle.id);
                            }}
                          >
                            {t("bundleEdit")}
                          </Button>
                        </Group>
                      </Group>
                    </Stack>
                  </Card>
                ))}

                {inputsItems.length > 0 && (
                  <Stack gap="sm">
                    {inputsItems.map((item) => (
                      <Card
                        key={`${item.kind}-${item.id}`}
                        withBorder
                        radius="md"
                        padding="sm"
                      >
                        <Group justify="space-between" align="flex-start" wrap="wrap">
                          <Stack gap={2}>
                            <Text fw={600}>{item.label}</Text>
                            {item.description && (
                              <Text size="xs" c="dimmed">
                                {item.description}
                              </Text>
                            )}
                          </Stack>
                          <Group gap="xs">
                            <Button size="xs" variant="light" onClick={item.onEdit}>
                              {common("actionEdit")}
                            </Button>
                            <Button
                              size="xs"
                              variant="subtle"
                              color="red"
                              onClick={item.onDelete}
                            >
                              {common("actionDelete")}
                            </Button>
                          </Group>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        </Tabs.Panel>
            </Tabs>
          </Stack>
        }
        right={
          <MoneyMonthSnapshotPanel
            title={t("statusPreviewTitle")}
            currency={scenario?.baseCurrency ?? "USD"}
            months={projectionMonths}
            currentMonthKey={currentMonthKey}
            selectedMonthKey={selectedDashboardMonth}
            snapshot={selectedMonthSnapshot}
            currentSnapshot={currentMonthSnapshot}
            loading={!projection}
            labels={{
              modeCurrent: t("statusModeCurrent"),
              modeSelect: t("statusModeSelect"),
              inputMonth: t("statusInputMonth"),
              inputDate: t("statusInputDate"),
              monthLabel: t("statusMonthLabel"),
              dateLabel: t("statusDateLabel"),
              dateSnapHint: t("statusDateSnapHint"),
              selectedMonthHint: safeTRaw(
                "statusSelectedMonthHint",
                "提示：狀態預覽以月份為單位計算，選擇月份可查看該月期末狀態（目前顯示 {month}）。"
              ),
              empty: t("statusEmpty"),
              viewMonthlyDetails: t("statusViewMonthlyDetails"),
              cashEom: t("statusCashEom"),
              netWorth: t("statusNetWorth"),
              netCashflow: t("statusNetCashflow"),
              inflow: t("statusInflow"),
              outflow: t("statusOutflow"),
              assetsTotal: t("statusAssetsTotal"),
              liabilitiesTotal: t("statusLiabilitiesTotal"),
              loading: t("statusLoading"),
            }}
            onSelectMonth={handleSnapshotMonthChange}
            onOpenMonthlyDetails={() => {
              openModal("monthlyBreakdown", {
                month: selectedDashboardMonth,
              });
            }}
          />
        }
      />

      {isMobile && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: "calc(72px + env(safe-area-inset-bottom) + 16px)",
            zIndex: 200,
          }}
        >
          <ActionIcon
            size={56}
            radius="xl"
            variant="filled"
            color="indigo"
            onClick={handleFabAdd}
            aria-label={t("eventCardAddEvent")}
          >
            +
          </ActionIcon>
        </div>
      )}

      <Drawer
        opened={Boolean(assetDetails)}
        onClose={() => setAssetDetails(null)}
        position="right"
        size="md"
        title={assetDetailsData?.title ?? t("assetDetailsTitle")}
      >
        <Stack gap="md">
          {assetDetailsData ? (
            <>
              <Select
                label={t("assetDetailsMonthLabel")}
                value={assetDetailsMonth ?? assetDetailsData.selectedMonth ?? null}
                data={projectionMonths.map((month) => ({ value: month, label: month }))}
                onChange={(value) => setAssetDetailsMonth(value ?? null)}
              />
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="light"
                  onClick={handleViewCashflow}
                  disabled={!projection}
                >
                  {t("assetDetailsViewCashflow")}
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  onClick={handleViewCalculations}
                  disabled={!projection}
                >
                  {t("assetDetailsViewCalculations")}
                </Button>
              </Group>
              <Card withBorder radius="md" padding="sm">
                <Stack gap="xs">
                  <Text fw={600}>{t("assetDetailsCashflowTitle")}</Text>
                  <Text size="sm" c="dimmed">
                    {t("assetDetailsCashflowMonth", {
                      month: assetDetailsData.selectedMonth ?? "--",
                      value: formatCurrency(
                        selectedAssetCashflow,
                        scenario?.baseCurrency ?? "USD",
                        locale
                      ),
                    })}
                  </Text>
                  {assetCashflowWindow.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      {t("assetDetailsCashflowEmpty")}
                    </Text>
                  ) : (
                    <Stack gap={4}>
                      {assetCashflowWindow.map((entry) => (
                        <Group key={entry.month} justify="space-between">
                          <Text size="sm">{entry.month}</Text>
                          <Text size="sm">
                            {formatCurrency(
                              entry.amount ?? 0,
                              scenario?.baseCurrency ?? "USD",
                              locale
                            )}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Card>
              <Card withBorder radius="md" padding="sm">
                <Stack gap="xs">
                  <Text fw={600}>{t("assetDetailsValueTitle")}</Text>
                  <Group justify="space-between">
                    <Text size="sm">{t("assetDetailsTotalValueLabel")}</Text>
                    <Text size="sm">
                      {formatCurrency(
                        assetDetailsData.assetValue ?? 0,
                        scenario?.baseCurrency ?? "USD",
                        locale
                      )}
                    </Text>
                  </Group>
                  {typeof assetDetailsData.liabilityValue === "number" && (
                    <Group justify="space-between">
                      <Text size="sm">{t("assetDetailsLiabilitiesLabel")}</Text>
                      <Text size="sm">
                        {formatCurrency(
                          assetDetailsData.liabilityValue ?? 0,
                          scenario?.baseCurrency ?? "USD",
                          locale
                        )}
                      </Text>
                    </Group>
                  )}
                  {assetDetailsData.allocationRows && (
                    <Stack gap={4}>
                      <Text size="sm" fw={500}>
                        {t("assetDetailsAllocationTitle")}
                      </Text>
                      {assetDetailsData.allocationRows.length === 0 ? (
                        <Text size="sm" c="dimmed">
                          {t("assetDetailsAllocationEmpty")}
                        </Text>
                      ) : (
                        assetDetailsData.allocationRows.map((row) => (
                          <Group key={row.bucketId} justify="space-between">
                            <Text size="sm">{row.bucketName}</Text>
                            <Text size="sm">
                              {formatCurrency(
                                row.value ?? 0,
                                scenario?.baseCurrency ?? "USD",
                                locale
                              )}
                            </Text>
                          </Group>
                        ))
                      )}
                    </Stack>
                  )}
                </Stack>
              </Card>
            </>
          ) : (
            <Text size="sm" c="dimmed">
              {t("assetDetailsEmpty")}
            </Text>
          )}
        </Stack>
      </Drawer>

      <MortgageDetailDrawer
        opened={Boolean(mortgageDetail)}
        onClose={() => setMortgageDetail(null)}
        onEdit={
          mortgageDetailEvent
            ? () => {
                openV2EventDrawer("edit", "housing", mortgageDetailEvent.id);
                setMortgageDetail(null);
              }
            : undefined
        }
        event={mortgageDetailEvent}
        asset={mortgageDetailAsset}
        liability={mortgageDetailLiability}
        baseCurrency={scenario?.baseCurrency ?? "USD"}
        locale={locale}
        defaultTab={mortgageDetail?.tab ?? "overview"}
        currentMonth={currentProjectionMonth}
      />

      <AddFlowDrawer
        opened={templatePickerOpen}
        mode="money"
        defaultCategory={templatePickerCategory}
        defaultIntent={templatePickerIntent}
        defaultItemCategory={templatePickerItemCategory}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={handleTemplateSelect}
      />

      <BundleWizardDrawer
        opened={bundleWizardOpen}
        template={bundleTemplate}
        mode={bundleWizardMode}
        bundleInstanceId={bundleWizardInstanceId}
        initialWizardInput={bundleWizardInitialInput}
        scenarioId={scenarioIdValue}
        baseMonth={baseMonth}
        baseCurrency={scenario?.baseCurrency ?? "USD"}
        scenarioEvents={scenario?.events ?? []}
        onClose={() => {
          setBundleWizardOpen(false);
          setBundleTemplate(null);
          setBundleWizardMode("create");
          setBundleWizardInstanceId(null);
          setBundleWizardInitialInput(null);
        }}
        onOpenEventDrawer={handleOpenBundleEvent}
        onApplyEvents={handleApplyBundleEvents}
      />

      <Drawer
        opened={Boolean(activeBundleCard)}
        onClose={() => setBundleViewId(null)}
        position="right"
        size="md"
        title={activeBundleCard?.title ?? t("bundleTitleFallback")}
      >
        {activeBundleCard ? (
          <Stack gap="md">
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                {t("bundleDetailSummaryTitle")}
              </Text>
              <Text size="sm" c="dimmed">
                {t("bundleSummaryOneOff", {
                  amount:
                    activeBundleCard.oneOffTotal > 0
                      ? formatCurrency(
                          activeBundleCard.oneOffTotal,
                          scenario?.baseCurrency ?? "USD",
                          locale
                        )
                      : t("amountUnset"),
                })}
              </Text>
              <Text size="sm" c="dimmed">
                {t("bundleSummaryMonthlyIncome", {
                  amount: activeBundleCard.hasMonthlyImpact
                    ? formatCurrency(
                        activeBundleCard.monthlyIncome,
                        scenario?.baseCurrency ?? "USD",
                        locale
                      )
                    : t("amountUnset"),
                })}
              </Text>
              <Text size="sm" c="dimmed">
                {t("bundleSummaryMonthlyExpense", {
                  amount: activeBundleCard.hasMonthlyImpact
                    ? formatCurrency(
                        activeBundleCard.monthlyExpense,
                        scenario?.baseCurrency ?? "USD",
                        locale
                      )
                    : t("amountUnset"),
                })}
              </Text>
              <Text size="sm" c="dimmed">
                {t("bundleSummaryMonthlyNet", {
                  amount: activeBundleCard.hasMonthlyImpact
                    ? formatCurrency(
                        activeBundleCard.monthlyNet,
                        scenario?.baseCurrency ?? "USD",
                        locale
                      )
                    : t("amountUnset"),
                })}
              </Text>
              {activeBundleCard.hasStartMonthOneOffImpact && (
                <Text size="sm" c="dimmed">
                  {t("bundleSummaryStartMonthNet", {
                    amount: formatCurrency(
                      activeBundleCard.monthlySummary.startMonthNet,
                      scenario?.baseCurrency ?? "USD",
                      locale
                    ),
                    month: activeBundleCard.monthlySummary.month ?? "--",
                  })}
                </Text>
              )}
              {activeBundleCard.assets.map((asset) => (
                <Text size="sm" c="dimmed" key={asset.id}>
                  {t("bundleSummaryAssetItem", {
                    name: asset.label ?? t("assetUntitled"),
                    amount:
                      typeof asset.currentValue === "number"
                        ? formatCurrency(
                            asset.currentValue,
                            scenario?.baseCurrency ?? "USD",
                            locale
                          )
                        : t("amountUnset"),
                  })}
                </Text>
              ))}
              {activeBundleCard.liabilities.map((liability) => (
                <Text size="sm" c="dimmed" key={liability.id}>
                  {t("bundleSummaryLiabilityItem", {
                    name: liability.label ?? t("liabilityUntitled"),
                    amount:
                      typeof liability.principalOutstanding === "number"
                        ? formatCurrency(
                            liability.principalOutstanding,
                            scenario?.baseCurrency ?? "USD",
                            locale
                          )
                        : t("amountUnset"),
                  })}
                </Text>
              ))}
            </Stack>

            <Stack gap="xs">
              <Text size="sm" fw={600}>
                {t("bundleDetailCashflowTitle")}
              </Text>
              {bundleDetailOneOffIncomeItems.length > 0 ||
              bundleDetailOneOffExpenseItems.length > 0 ? (
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    {t("bundleDetailOneOffSection", {
                      month: activeBundleSummary?.month ?? "--",
                    })}
                  </Text>
                  {bundleDetailOneOffIncomeItems.length > 0 && (
                    <Stack gap={4}>
                      <Text size="xs" c="dimmed">
                        {t("bundleDetailIncome")}
                      </Text>
                      {bundleDetailOneOffIncomeItems.map((item) => (
                        <Group key={item.id} justify="space-between" wrap="nowrap">
                          <Text size="sm">{item.label}</Text>
                          <Text size="sm" fw={500}>
                            {formatCurrency(
                              item.amount,
                              scenario?.baseCurrency ?? "USD",
                              locale
                            )}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  )}
                  {bundleDetailOneOffExpenseItems.length > 0 && (
                    <Stack gap={4}>
                      <Text size="xs" c="dimmed">
                        {t("bundleDetailExpenses")}
                      </Text>
                      {bundleDetailOneOffExpenseItems.map((item) => (
                        <Group key={item.id} justify="space-between" wrap="nowrap">
                          <Text size="sm">{item.label}</Text>
                          <Text size="sm" fw={500}>
                            {formatCurrency(
                              item.amount,
                              scenario?.baseCurrency ?? "USD",
                              locale
                            )}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  )}
                </Stack>
              ) : null}

              {bundleDetailIncomeItems.length > 0 ||
              bundleDetailExpenseItems.length > 0 ? (
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    {t("bundleDetailRecurringSection")}
                  </Text>
                  {bundleDetailIncomeItems.length > 0 && (
                    <Stack gap={4}>
                      <Text size="xs" c="dimmed">
                        {t("bundleDetailIncome")}
                      </Text>
                      {bundleDetailIncomeItems.map((item) => (
                        <Group key={item.id} justify="space-between" wrap="nowrap">
                          <Text size="sm">{item.label}</Text>
                          <Text size="sm" fw={500}>
                            {formatCurrency(
                              item.amount,
                              scenario?.baseCurrency ?? "USD",
                              locale
                            )}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  )}
                  {bundleDetailExpenseItems.length > 0 && (
                    <Stack gap={4}>
                      <Text size="xs" c="dimmed">
                        {t("bundleDetailExpenses")}
                      </Text>
                      {bundleDetailExpenseItems.map((item) => (
                        <Group key={item.id} justify="space-between" wrap="nowrap">
                          <Text size="sm">{item.label}</Text>
                          <Text size="sm" fw={500}>
                            {formatCurrency(
                              item.amount,
                              scenario?.baseCurrency ?? "USD",
                              locale
                            )}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  )}
                </Stack>
              ) : null}

              {bundleDetailIncomeItems.length === 0 &&
                bundleDetailExpenseItems.length === 0 &&
                bundleDetailOneOffIncomeItems.length === 0 &&
                bundleDetailOneOffExpenseItems.length === 0 && (
                  <Text size="sm" c="dimmed">
                    {t("bundleDetailEmpty")}
                  </Text>
                )}
            </Stack>

            {activeBundleMortgageSummary && (
              <Stack gap="xs">
                <Text size="sm" fw={600}>
                  {t("bundleMortgageSummaryTitle")}
                </Text>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{t("bundleMortgageSummaryLoanAmount")}</Text>
                  <Text size="sm" fw={500}>
                    {typeof activeBundleMortgageSummary.loanAmount === "number"
                      ? formatCurrency(
                          activeBundleMortgageSummary.loanAmount,
                          scenario?.baseCurrency ?? "USD",
                          locale
                        )
                      : t("amountUnset")}
                  </Text>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{t("bundleMortgageSummaryRate")}</Text>
                  <Text size="sm" fw={500}>
                    {typeof activeBundleMortgageSummary.ratePct === "number"
                      ? `${formatGrowthPct(activeBundleMortgageSummary.ratePct)}%`
                      : t("amountUnset")}
                  </Text>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{t("bundleMortgageSummaryTerm")}</Text>
                  <Text size="sm" fw={500}>
                    {typeof activeBundleMortgageSummary.termYears === "number"
                      ? new Intl.NumberFormat(locale).format(
                          activeBundleMortgageSummary.termYears
                        )
                      : t("amountUnset")}
                  </Text>
                </Group>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{t("bundleMortgageSummaryPayment")}</Text>
                  <Text size="sm" fw={500}>
                    {typeof activeBundleMortgageSummary.monthlyPayment === "number"
                      ? formatCurrency(
                          activeBundleMortgageSummary.monthlyPayment,
                          scenario?.baseCurrency ?? "USD",
                          locale
                        )
                      : t("amountUnset")}
                  </Text>
                </Group>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    openMortgageDetails(activeBundleMortgageSummary.eventId, "liability")
                  }
                >
                  {t("bundleMortgageSummaryViewDetails")}
                </Button>
              </Stack>
            )}

            <Group justify="flex-end">
              <Button
                variant="subtle"
                onClick={() => handleEditBundle(activeBundleCard.id)}
              >
                {t("bundleEdit")}
              </Button>
            </Group>

            <Divider />

            <Stack gap="xs">
              <Text size="sm" fw={600} c="red">
                {t("bundleDangerZoneTitle")}
              </Text>
              <Button
                color="red"
                variant="light"
                onClick={() => handleDeleteBundle(activeBundleCard.id)}
              >
                {t("bundleDeleteAction")}
              </Button>
            </Stack>
          </Stack>
        ) : null}
      </Drawer>

      {scenario && scenarioIdValue && (
        <>
          {scenarioIsV2 && (
            <>
              <CashflowEventDrawer
                opened={
                  v2EventDrawerOpen &&
                  (v2EventDrawerType === "cashflow" || v2EventDrawerType === "adjustment")
                }
                mode={v2EventDrawerMode}
                baseCurrency={scenario.baseCurrency}
                scenarioStartMonth={scenario.assumptions.baseMonth ?? null}
                scenarioHorizonMonths={scenario.assumptions.horizonMonths ?? null}
                incomeGrowthPct={incomeGrowthPct}
                inflationPct={scenario.assumptions.inflationRate ?? null}
                rentGrowthPct={scenario.assumptions.rentAnnualGrowthPct ?? null}
                members={members}
                event={
                  v2EventDrawerMode === "create"
                    ? null
                    : editingV2DrawerEvent
                }
                defaultKind={v2EventDefaultKind}
                initialCashflowDraft={templateCashflowDraft ?? undefined}
                onClose={closeV2EventDrawer}
                onSave={handleSaveV2Event}
                salaryAdjustmentContext={(() => {
                  const sourceEvent =
                    editingV2DrawerEvent && editingV2DrawerEvent.type === "cashflow"
                      ? editingV2DrawerEvent
                      : null;
                  const parentId = sourceEvent
                    ? getSalaryAdjustmentParentEventId(sourceEvent)
                    : getSalaryAdjustmentParentEventId({
                        id: "draft",
                        type: "cashflow",
                        kind: templateCashflowDraft?.kind ?? "income",
                        cadence: templateCashflowDraft?.cadence ?? "monthly",
                        amount: 0,
                        tags: templateCashflowDraft?.tags,
                      });
                  if (!parentId) {
                    return null;
                  }
                  const parent = v2ScenarioEvents.find((event) => event.id === parentId);
                  if (!parent || parent.type !== "cashflow") {
                    return null;
                  }
                  return {
                    parentLabel: parent.label ?? "基準薪金",
                    parentStartMonth: parent.startMonth ?? null,
                    parentEndMonth: parent.endMonth ?? null,
                  };
                })()}
              />
              <HousingEventDrawer
                opened={v2EventDrawerOpen && v2EventDrawerType === "housing"}
                mode={v2EventDrawerMode}
                baseCurrency={scenario.baseCurrency}
                event={v2EventDrawerMode === "edit" ? editingHousingEvent : null}
                initialDraft={templateHousingDraft ?? undefined}
                onClose={closeV2EventDrawer}
                onSave={handleSaveHousingEvent}
              />
              <LoanEventDrawer
                opened={v2EventDrawerOpen && v2EventDrawerType === "loan"}
                mode={v2EventDrawerMode}
                baseCurrency={scenario.baseCurrency}
                event={v2EventDrawerMode === "edit" ? editingLoanEvent : null}
                initialDraft={templateLoanDraft ?? undefined}
                onClose={closeV2EventDrawer}
                onSave={handleSaveLoanEvent}
              />
              <InsuranceEventDrawer
                opened={v2EventDrawerOpen && v2EventDrawerType === "insurance"}
                mode={v2EventDrawerMode}
                baseCurrency={scenario.baseCurrency}
                event={v2EventDrawerMode === "edit" ? editingInsuranceEvent : null}
                initialDraft={templateInsuranceDraft ?? undefined}
                onClose={closeV2EventDrawer}
                onSave={handleSaveInsuranceEvent}
              />
            </>
          )}
          <Drawer
            opened={Boolean(homeDrawerDraft)}
            onClose={() => {
              setEditingHomeId(null);
              setCreatingHome(null);
            }}
            position="right"
            size="md"
            title={homesText("title")}
          >
            {homeDrawerDraft && (
              <HomeDetailsForm
                home={homeDrawerDraft}
                isSold={isPastSellMonth(homeDrawerDraft.sellMonth)}
                onCancel={() => {
                  setEditingHomeId(null);
                  setCreatingHome(null);
                }}
                onSave={(updated) => {
                  if (editingHome) {
                    updateHomePosition(scenarioIdValue, updated);
                  } else {
                    addHomePosition(scenarioIdValue, updated);
                  }
                  setEditingHomeId(null);
                  setCreatingHome(null);
                }}
              />
            )}
          </Drawer>

          <Drawer
            opened={Boolean(carDrawerDraft)}
            onClose={() => {
              setEditingCarId(null);
              setCreatingCar(null);
            }}
            position="right"
            size="md"
            title={carsText("title")}
          >
            {carDrawerDraft && (
              <CarDetailsForm
                car={carDrawerDraft}
                isSold={isPastSellMonth(carDrawerDraft.sellMonth)}
                onCancel={() => {
                  setEditingCarId(null);
                  setCreatingCar(null);
                }}
                onSave={(updated) => {
                  if (editingCar) {
                    updateCarPosition(scenarioIdValue, updated);
                  } else {
                    addCarPosition(scenarioIdValue, updated);
                  }
                  setEditingCarId(null);
                  setCreatingCar(null);
                }}
              />
            )}
          </Drawer>

          <Drawer
            opened={Boolean(investmentDrawerDraft)}
            onClose={() => {
              setEditingInvestmentId(null);
              setCreatingInvestment(null);
            }}
            position="right"
            size="md"
            title={investmentsText("title")}
          >
            {investmentDrawerDraft && (
              <InvestmentDetailsForm
                investment={investmentDrawerDraft}
                onCancel={() => {
                  setEditingInvestmentId(null);
                  setCreatingInvestment(null);
                }}
                onSave={(updated) => {
                  if (editingInvestment) {
                    updateInvestmentPosition(scenarioIdValue, updated);
                  } else {
                    addInvestmentPosition(scenarioIdValue, updated);
                  }
                  setEditingInvestmentId(null);
                  setCreatingInvestment(null);
                }}
              />
            )}
          </Drawer>

          <Drawer
            opened={Boolean(insuranceDrawerDraft)}
            onClose={() => {
              setEditingInsuranceId(null);
              setCreatingInsurance(null);
            }}
            position="right"
            size="md"
            title={insurancesText("title")}
          >
            {insuranceDrawerDraft && (
              <InsuranceDetailsForm
                insurance={insuranceDrawerDraft}
                onCancel={() => {
                  setEditingInsuranceId(null);
                  setCreatingInsurance(null);
                }}
                onSave={(updated) => {
                  if (editingInsurance) {
                    updateInsurancePosition(scenarioIdValue, updated);
                  } else {
                    addInsurancePosition(scenarioIdValue, updated);
                  }
                  setEditingInsuranceId(null);
                  setCreatingInsurance(null);
                }}
              />
            )}
          </Drawer>

          <Drawer
            opened={Boolean(loanDrawerDraft)}
            onClose={() => {
              setEditingLoanId(null);
              setCreatingLoan(null);
            }}
            position="right"
            size="md"
            title={loansText("title")}
          >
            {loanDrawerDraft && (
              <LoanDetailsForm
                loan={loanDrawerDraft}
                onCancel={() => {
                  setEditingLoanId(null);
                  setCreatingLoan(null);
                }}
                onSave={(updated) => {
                  if (editingLoan) {
                    updateLoanPosition(scenarioIdValue, updated);
                  } else {
                    addLoanPosition(scenarioIdValue, updated);
                  }
                  setEditingLoanId(null);
                  setCreatingLoan(null);
                }}
              />
            )}
          </Drawer>

          <Drawer
            opened={smartInvestDrawerOpen}
            onClose={closeDrawer}
            position="right"
            size="md"
            title={timelineText("smartInvestTitle")}
          >
            <SmartInvestForm
              policy={smartInvestPolicy}
              onChange={(nextPolicy) => updateSmartInvest(scenarioIdValue, nextPolicy)}
            />
          </Drawer>

          <PositionCashflowModal
            opened={cashflowModal.opened}
            onClose={() =>
              setCashflowModal({ ...cashflowModal, opened: false })
            }
            title={cashflowModal.title}
            currency={scenario?.baseCurrency ?? "USD"}
            entries={cashflowModal.entries}
            series={cashflowModal.series}
          />

          <PositionCalculatorModal
            opened={calculatorModal.opened}
            onClose={() =>
              setCalculatorModal({ ...calculatorModal, opened: false })
            }
            title={calculatorModal.title}
            currency={scenario?.baseCurrency ?? "USD"}
            amortizationRows={calculatorModal.amortizationRows}
            valueRows={calculatorModal.valueRows}
            contributionRows={calculatorModal.contributionRows}
            assetValueRows={calculatorModal.assetValueRows}
            bucketValueSeries={calculatorModal.bucketValueSeries}
            bucketCurrentRows={calculatorModal.bucketCurrentRows}
          />

          <Modal
            opened={Boolean(adjustmentDraft)}
            onClose={() => setAdjustmentDraft(null)}
            title={t("ledgerAdjustTitle")}
            centered
          >
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                {t("ledgerAdjustHint", {
                  month: adjustmentDraft?.month ?? "--",
                })}
              </Text>
              <TextInput
                type="month"
                label={t("ledgerEventStart")}
                value={adjustmentDraft?.month ?? ""}
                onChange={(event) =>
                  setAdjustmentDraft((current) =>
                    current
                      ? {
                          ...current,
                          month: event.currentTarget.value,
                          error: undefined,
                        }
                      : null
                  )
                }
              />
              <NumberInput
                label={t("ledgerAdjustAmount")}
                value={adjustmentDraft?.amount ?? ""}
                onChange={(value) =>
                  setAdjustmentDraft((current) =>
                    current
                      ? {
                          ...current,
                          amount:
                            value === "" || value === undefined
                              ? ""
                              : String(value),
                          error: undefined,
                        }
                      : null
                  )
                }
                error={adjustmentDraft?.error}
                allowNegative
              />
              <Group justify="flex-end" gap="sm">
                <Button
                  variant="subtle"
                  onClick={() => setAdjustmentDraft(null)}
                >
                  {common("actionCancel")}
                </Button>
                <Button onClick={handleConfirmAdjustment}>
                  {t("ledgerAdjustConfirm")}
                </Button>
              </Group>
            </Stack>
          </Modal>

          <Modal
            opened={Boolean(deleteConfirmation)}
            onClose={() => setDeleteConfirmation(null)}
            title={common("actionDelete")}
            centered
          >
            <Stack gap="md">
              <Text>
                {deleteConfirmation?.type === "bundle" ||
                deleteConfirmation?.type === "bundleItem"
                  ? t("deleteBundleConfirmation", {
                      label: deleteConfirmation?.label ?? "",
                    })
                  : t("deleteConfirmation", {
                      label: deleteConfirmation?.label ?? "",
                    })}
              </Text>
              {deleteConfirmation?.type === "bundleItem" && (
                <Text size="sm" c="dimmed">
                  {t("deleteBundleItemHint", {
                    bundle: deleteConfirmation.bundleTitle,
                  })}
                </Text>
              )}
              {deleteConfirmation?.impact ? (
                <Stack gap="sm">
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t("deleteImpactAssetsTitle")}
                    </Text>
                    {deleteConfirmation.impact.impactedAssets.length > 0 ? (
                      deleteConfirmation.impact.impactedAssets.map((asset) => (
                        <Text size="sm" key={asset.id}>
                          • {asset.label ?? t("assetUntitled")}
                        </Text>
                      ))
                    ) : (
                      <Text size="sm" c="dimmed">
                        {t("deleteImpactNone")}
                      </Text>
                    )}
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t("deleteImpactLiabilitiesTitle")}
                    </Text>
                    {deleteConfirmation.impact.impactedLiabilities.length > 0 ? (
                      deleteConfirmation.impact.impactedLiabilities.map((liability) => (
                        <Text size="sm" key={liability.id}>
                          • {liability.label ?? t("liabilityUntitled")}
                        </Text>
                      ))
                    ) : (
                      <Text size="sm" c="dimmed">
                        {t("deleteImpactNone")}
                      </Text>
                    )}
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t("deleteImpactCashflowsTitle")}
                    </Text>
                    {deleteConfirmation.impact.ledger.topRows.length > 0 ? (
                      deleteConfirmation.impact.ledger.topRows.map((row, index) => (
                        <Group key={`${row.sourceEventId}-${index}`} justify="space-between">
                          <Text size="sm">
                            {row.label ?? t("ledgerRowFallbackLabel")} · {row.month}
                          </Text>
                          <Text size="sm" fw={500}>
                            {formatCurrency(
                              row.amount,
                              scenario?.baseCurrency ?? "USD",
                              locale
                            )}
                          </Text>
                        </Group>
                      ))
                    ) : (
                      <Text size="sm" c="dimmed">
                        {t("deleteImpactNone")}
                      </Text>
                    )}
                  </Stack>
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  {t("deleteImpactUnavailable")}
                </Text>
              )}
              <Group justify="flex-end" gap="sm">
                <Button
                  variant="subtle"
                  onClick={() => setDeleteConfirmation(null)}
                >
                  {common("actionCancel")}
                </Button>
                <Button
                  color="red"
                  onClick={handleConfirmDelete}
                >
                  {deleteConfirmation?.type === "bundle" ||
                  deleteConfirmation?.type === "bundleItem"
                    ? t("bundleDeleteAction")
                    : common("actionDelete")}
                </Button>
              </Group>
            </Stack>
          </Modal>
        </>
      )}
        <MonthlyBreakdownModalHost
          months={months}
          ledgerByMonth={ledgerByMonth}
          summaryByMonth={summaryByMonth}
          positionCashflowsByMonth={positionCashflowsByMonth}
          projectionNetCashflowByMonth={projectionNetCashflowByMonth}
          projectionNetCashflowMode={projectionNetCashflowMode}
          netWorthByMonth={netWorthByMonth}
          netWorthBreakdownByMonth={netWorthBreakdownByMonth}
          currency={scenario?.baseCurrency ?? "USD"}
          memberLookup={memberLookupRecord}
          scenarioId={scenario?.id}
          baseMonth={scenario?.assumptions.baseMonth}
          horizonMonths={scenario?.assumptions.horizonMonths}
          members={members}
          eventViews={scenarioEventViews}
          isScenarioV2={scenarioIsV2}
        />
    </Stack>
  );
}
