"use client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { getEventGroup, monthIndex } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "../../../src/i18n/navigation";
import AddFlowDrawer from "../../../features/add/AddFlowDrawer";
import TimelineEventDrawer from "../../../components/timeline/TimelineEventDrawer";
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
  listEventTypesForGroup,
} from "../../../components/timeline/utils";
import {
  getScenarioById,
  isScenarioV2,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { formatCurrency } from "../../../lib/i18n";
import { buildScenarioEventViews, buildTimelineEventFromDefinition } from "../../../src/domain/events/utils";
import { getEventTypeDisplay } from "../../../components/timeline/utils";
import type { ScenarioEventView } from "../../../components/timeline/types";
import { monthsBetween } from "../../../src/domain/members/age";
import { isValidMonthStr } from "../../../src/utils/month";
import { compareMonthKey } from "../../../src/utils/monthKey";
import { useProjectionWithLedger } from "../../../src/engine/useProjectionWithLedger";
import { buildSmartInvestProjectionBreakdown, type SmartInvestProjectionBreakdown } from "../../../src/domain/smartInvest/projection";
import { buildDefaultSmartInvestPolicy } from "../../../src/domain/smartInvest/defaultPolicy";
import { compileSellLifecycle } from "../../../src/domain/positions/compileSellLifecycle";
import MonthlyBreakdownModalHost from "../../../components/MonthlyBreakdownModalHost";
import RightPaneDashboard from "../../../components/RightPaneDashboard";
import TwoPaneLayout from "../../../components/TwoPaneLayout";
import MoneyFlowManager from "../../../features/moneyFlow/MoneyFlowManager";
import MoneyLedgerView from "../../../features/moneyFlow/MoneyLedgerView";
import MoneyLegacyBanner from "../../../features/moneyFlow/MoneyLegacyBanner";
import CashflowEventDrawer, {
  type ScenarioEventDraft,
} from "../../../features/moneyFlow/CashflowEventDrawer";
import HousingEventDrawer, {
  type HousingEventDraft,
} from "../../../features/moneyFlow/HousingEventDrawer";
import LoanEventDrawer, {
  type LoanEventDraft,
} from "../../../features/moneyFlow/LoanEventDrawer";
import InsuranceEventDrawer, {
  type InsuranceEventDraft,
} from "../../../features/moneyFlow/InsuranceEventDrawer";
import AssetManager from "../../../features/assets/AssetManager";
import LiabilityManager from "../../../features/liabilities/LiabilityManager";
import EventManager from "../../../features/milestoneEvents/EventManager";
import EventWizard from "../../../features/milestoneEvents/EventWizard";
import type {
  BudgetCategory,
  CarPositionDraft,
  HomePositionDraft,
  InsurancePositionDraft,
  InvestmentPositionDraft,
  LoanPositionDraft,
} from "../../../src/store/scenarioStore";
import type { MilestoneEvent, MilestoneEventDraft } from "../../../src/domain/milestoneEvents/types";
import { buildMilestoneScenarioSnapshot } from "../../../src/domain/milestoneEvents/snapshot";
import { useUiStore } from "../../../src/store/uiStore";
import { ONBOARDING_PLACEHOLDER_TAG } from "../../../src/domain/onboarding/mapOnboardingDraftToStoreItems";
import { compileScenarioV2ToLedger } from "../../../src/engine/scenarioV2Compiler";
import {
  buildMoneyCategoryLabelMap,
  buildMoneyCategoryOptions,
  buildMoneyItems,
  removeMoneyItem,
  upsertMoneyItem,
} from "../../../features/moneyFlow/moneyFlowAdapter";
import {
  buildDerivedMoneyItemsForAsset,
  buildDerivedMoneyItemsForLiability,
  findDerivedMoneyItemsForAsset,
  findDerivedMoneyItemsForLiability,
} from "../../../features/moneyFlow/derivedMoneyItems";
import { applyAssetItemChange, toAssetItems } from "../../../features/assets/assetAdapter";
import {
  applyLiabilityItemChange,
  toLiabilityItems,
} from "../../../features/liabilities/liabilityAdapter";
import type { AssetItem } from "../../../features/assets/types";
import type { LiabilityItem } from "../../../features/liabilities/types";
import type { ScenarioEvent } from "../../../src/domain/scenarioV2/events";
import type { LedgerRow } from "../../../src/engine/scenarioV2Compiler";

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

type MoneyTab = "income" | "expenses" | "assets" | "liabilities" | "timeline" | "inputs";

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

const tabOrder: MoneyTab[] = [
  "income",
  "expenses",
  "assets",
  "liabilities",
  "timeline",
  "inputs",
];

type MoneyAddAction =
  | "event"
  | "oneOffExpense"
  | "home"
  | "investment"
  | "insurance"
  | "car"
  | "loan";

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
  const timelineText = useTranslations("timeline");
  const homesText = useTranslations("homes");
  const investmentsText = useTranslations("investments");
  const insurancesText = useTranslations("insurances");
  const loansText = useTranslations("loans");
  const carsText = useTranslations("cars");
  const budgetText = useTranslations("budgetRules");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const updateScenarioEventRef = useScenarioStore((state) => state.updateScenarioEventRef);
  const updateEventDefinition = useScenarioStore((state) => state.updateEventDefinition);
  const addEventToScenarios = useScenarioStore((state) => state.addEventToScenarios);
  const removeScenarioEventRef = useScenarioStore((state) => state.removeScenarioEventRef);
  const createBudgetRule = useScenarioStore((state) => state.createBudgetRule);
  const updateBudgetRule = useScenarioStore((state) => state.updateBudgetRule);
  const setScenarioPositions = useScenarioStore((state) => state.setScenarioPositions);
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
  const removeLoanPosition = useScenarioStore((state) => state.removeLoanPosition);
  const updateSmartInvest = useScenarioStore((state) => state.updateSmartInvest);
  const removeBudgetRule = useScenarioStore((state) => state.removeBudgetRule);
  const addEvent = useScenarioStore((state) => state.addEvent);
  const updateEvent = useScenarioStore((state) => state.updateEvent);
  const removeEvent = useScenarioStore((state) => state.removeEvent);
  const duplicateEvent = useScenarioStore((state) => state.duplicateEvent);
  const upsertScenarioAssets = useScenarioStore((state) => state.upsertScenarioAssets);
  const upsertScenarioLiabilities = useScenarioStore((state) => state.upsertScenarioLiabilities);
  const applyMilestoneEvent = useScenarioStore((state) => state.applyMilestoneEvent);
  const removeMilestoneEvent = useScenarioStore((state) => state.removeMilestoneEvent);
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
  const hasPlaceholderEvents = useMemo(
    () =>
      scenarioEventViews.some((view) =>
        view.definition.title.includes(ONBOARDING_PLACEHOLDER_TAG)
      ),
    [scenarioEventViews]
  );
  const [dismissedPlaceholderBanner, setDismissedPlaceholderBanner] = useState(false);
  const showPlaceholderBanner =
    !dismissedPlaceholderBanner &&
    (hasPlaceholderEvents || initialShowOnboardingBanner || initialShowOnboardingSkipped);
  const scenarioIdValue = scenario?.id;
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
  const cashSeries = useMemo(() => projection?.cashBalance ?? [], [projection]);
  const netWorthSeries = useMemo(() => projection?.netWorth ?? [], [projection]);
  const netCashflowSeries = useMemo(
    () =>
      projectionMonths.map((month) =>
        (ledgerByMonth[month] ?? []).reduce((total, item) => total + item.amount, 0)
      ),
    [ledgerByMonth, projectionMonths]
  );
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
  const [addFlowOpen, setAddFlowOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScenarioEventView | null>(null);
  const [v2EventDrawerOpen, setV2EventDrawerOpen] = useState(false);
  const [v2EventDrawerMode, setV2EventDrawerMode] = useState<"create" | "edit">(
    "create"
  );
  const [v2EventDrawerType, setV2EventDrawerType] = useState<
    ScenarioEvent["type"] | null
  >(null);
  const [editingV2EventId, setEditingV2EventId] = useState<string | null>(null);
  const [v2EventTypePickerOpen, setV2EventTypePickerOpen] = useState(false);
  const [v2EventDefaultKind, setV2EventDefaultKind] = useState<
    "income" | "expense"
  >("income");
  const [ledgerActionError, setLedgerActionError] = useState<string | null>(null);
  const [adjustmentDraft, setAdjustmentDraft] = useState<{
    row: LedgerRow;
    amount: string;
    error?: string;
  } | null>(null);
  const [milestoneWizardOpen, setMilestoneWizardOpen] = useState(false);
  const [editingMilestoneEvent, setEditingMilestoneEvent] = useState<MilestoneEvent | null>(null);
  const [openOneOffExpense, setOpenOneOffExpense] = useState(false);
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
  const selectedDashboardIndex =
    selectedDashboardMonth && projectionMonths.includes(selectedDashboardMonth)
      ? projectionMonths.indexOf(selectedDashboardMonth)
      : 0;
  const cashBalanceValue = projection
    ? projection.cashBalance[selectedDashboardIndex] ?? null
    : null;
  const netWorthValue = projection
    ? projection.netWorth[selectedDashboardIndex] ?? null
    : null;
  const netCashflowValue = useMemo(() => {
    if (!selectedDashboardMonth) {
      return null;
    }
    const items = ledgerByMonth[selectedDashboardMonth] ?? [];
    return items.reduce((total, item) => total + item.amount, 0);
  }, [ledgerByMonth, selectedDashboardMonth]);
  const [assetDetails, setAssetDetails] = useState<{
    type: "home" | "investment" | "insurance" | "car" | "loan" | "smartInvest";
    id?: string;
  } | null>(null);
  const [assetDetailsMonth, setAssetDetailsMonth] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: "event" | "eventV2" | "asset" | "loan";
    id: string;
    label: string;
  } | null>(null);
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
  const hasHandledInitialAdd = useRef(false);
  const hasHandledInitialEdit = useRef(false);

  const resolvedTab = tabOrder.includes(initialTab as MoneyTab)
    ? (initialTab as MoneyTab)
    : "income";
  const [activeTab, setActiveTab] = useState<MoneyTab>(resolvedTab);
  const [highlightOnly, setHighlightOnly] = useState(false);
  const [memberFilter, setMemberFilter] = useState<string | null>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>("all");
  const [inputsFilter, setInputsFilter] = useState<
    "all" | "rules" | "assets" | "events"
  >("all");
  const [openAssetEditId, setOpenAssetEditId] = useState<string | null>(null);
  const [openLiabilityEditId, setOpenLiabilityEditId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

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

  const memberLookup = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members]
  );

  const eventRows = useMemo(() => {
    if (!scenario) {
      return [];
    }
    return buildScenarioEventViews(scenario, eventLibrary)
      .filter((view) => !view.definition.generatedByEventId)
      .map((view) => {
        const event = buildTimelineEventFromDefinition(
          view.definition,
          view.ref,
          {
            baseCurrency: scenario.baseCurrency,
            fallbackMonth: scenario.assumptions.baseMonth ?? null,
          }
        );
        return { view, event };
      });
  }, [eventLibrary, scenario]);
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
  const incomeEventTypes = useMemo(() => listEventTypesForGroup("income"), []);
  const expenseEventTypes = useMemo(() => listEventTypesForGroup("expense"), []);
  const moneyCategoryLabelMap = useMemo(
    () =>
      buildMoneyCategoryLabelMap(
        [...incomeEventTypes, ...expenseEventTypes],
        Object.keys(budgetCategoryLabels) as BudgetCategory[],
        {
          getEventLabel: (type) => getEventTypeDisplay(timelineText, type),
          getBudgetLabel: (category) =>
            budgetCategoryLabels[category as BudgetCategory] ?? category,
        }
      ),
    [budgetCategoryLabels, expenseEventTypes, incomeEventTypes, timelineText]
  );
  const moneyCategoryOptions = useMemo(
    () =>
      buildMoneyCategoryOptions({
        incomeEventTypes,
        expenseEventTypes,
        budgetCategories: Object.keys(budgetCategoryLabels) as BudgetCategory[],
        labels: {
          getEventLabel: (type) => getEventTypeDisplay(timelineText, type),
          getBudgetLabel: (category) =>
            budgetCategoryLabels[category as BudgetCategory] ?? category,
        },
      }),
    [budgetCategoryLabels, expenseEventTypes, incomeEventTypes, timelineText]
  );
  const assetDerivedLabels = useMemo(
    () => ({
      ongoingCostLabels: {
        managementFee: t("assetOngoingManagementFee"),
        groundRent: t("assetOngoingGroundRent"),
        insurance: t("assetOngoingInsurance"),
        maintenance: t("assetOngoingMaintenance"),
        inspection: t("assetOngoingInspection"),
      },
      rentalIncomeLabel: t("assetRentalIncomeLabel"),
    }),
    [t]
  );
  const liabilityPaymentLabel = useMemo(() => t("liabilityPaymentLabel"), [t]);
  const moneyItems = useMemo(
    () =>
      scenario && !scenarioIsV2
        ? buildMoneyItems({
            scenario,
            eventLibrary,
            budgetRules,
          })
        : [],
    [budgetRules, eventLibrary, scenario, scenarioIsV2]
  );
  const v2LedgerRows = useMemo<LedgerRow[]>(() => {
    if (!scenario || !scenarioIsV2) {
      return [];
    }
    return compileScenarioV2ToLedger(scenario);
  }, [scenario, scenarioIsV2]);
  const sortedLedgerRows = useMemo(() => {
    return [...v2LedgerRows].sort((a, b) => {
      const monthSort = compareMonthKey(b.month, a.month);
      if (monthSort !== 0) {
        return monthSort;
      }
      return (a.label ?? "").localeCompare(b.label ?? "");
    });
  }, [v2LedgerRows]);
  const incomeLedgerRows = useMemo(
    () =>
      sortedLedgerRows.filter(
        (row) => row.kind === "income" || (!row.kind && row.amount > 0)
      ),
    [sortedLedgerRows]
  );
  const expenseLedgerRows = useMemo(
    () =>
      sortedLedgerRows.filter(
        (row) => row.kind === "expense" || (!row.kind && row.amount < 0)
      ),
    [sortedLedgerRows]
  );
  const milestoneEvents = scenario?.milestoneEvents ?? [];
  const milestoneSnapshot = useMemo(
    () =>
      scenario
        ? buildMilestoneScenarioSnapshot({
            scenario,
            eventLibrary,
            budgetRules,
          })
        : null,
    [budgetRules, eventLibrary, scenario]
  );
  const v2ScenarioEvents = useMemo(() => scenario?.events ?? [], [scenario?.events]);
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

  const parentGroupOptions = useMemo(
    () =>
      eventLibrary
        .filter((definition) => definition.kind === "group")
        .map((definition) => ({
          value: definition.id,
          label: definition.title,
        })),
    [eventLibrary]
  );

  const timelineEvents = useMemo(() => {
    return eventRows.filter(({ event }) => {
      if (highlightOnly && !event.highlighted) {
        return false;
      }
      if (memberFilter && memberFilter !== "all") {
        if (event.memberId !== memberFilter) {
          return false;
        }
      }
      if (categoryFilter && categoryFilter !== "all") {
        if (event.type !== categoryFilter) {
          return false;
        }
      }
      return true;
    });
  }, [categoryFilter, eventRows, highlightOnly, memberFilter]);
  const hasBudgetRules = budgetRules.length > 0;
  const timelineHref = scenarioIdValue
    ? buildScenarioUrl("/money", scenarioIdValue)
    : "/money";
  const timelineTabHref = `${timelineHref}${timelineHref.includes("?") ? "&" : "?"}tab=timeline`;

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
  const currentProjectionMonth = baseMonth ?? null;
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
  ]);

  const inputEventItems = useMemo(
    () =>
      eventRows.map((row) => ({
        id: row.view.definition.id,
        kind: "event" as const,
        label: row.event.name || getEventTypeDisplay(timelineText, row.event.type),
        description: t("inputsEventMeta", {
          month: row.event.startMonth,
          amount:
            row.event.monthlyAmount || row.event.oneTimeAmount
              ? formatCurrency(
                  row.event.monthlyAmount || row.event.oneTimeAmount,
                  scenario?.baseCurrency ?? "USD",
                  locale
                )
              : t("amountUnset"),
        }),
        onEdit: () => setEditingEvent(row.view),
        onDelete: () => {
          if (scenarioIdValue) {
            removeScenarioEventRef(scenarioIdValue, row.view.definition.id);
          }
        },
      })),
    [
      eventRows,
      locale,
      removeScenarioEventRef,
      scenario?.baseCurrency,
      scenarioIdValue,
      t,
      timelineText,
    ]
  );

  const resolveMoneyCategoryLabel = useMemo(
    () => (category: string) => moneyCategoryLabelMap.get(category) ?? category,
    [moneyCategoryLabelMap]
  );
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

  const openV2EventTypePicker = useCallback(
    (defaultKind: "income" | "expense") => {
      setLedgerActionError(null);
      setV2EventDefaultKind(defaultKind);
      setV2EventTypePickerOpen(true);
    },
    []
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
        tags: ["adjustment"],
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
    const payload = {
      type: "cashflow" as const,
      label: draft.label.trim() || undefined,
      kind: draft.kind,
      cadence: draft.cadence,
      amount,
      startMonth: draft.cadence === "oneOff" ? undefined : draft.startMonth || undefined,
      endMonth: draft.cadence === "oneOff" ? undefined : draft.endMonth || undefined,
      occurrenceMonth: draft.cadence === "oneOff" ? draft.occurrenceMonth : undefined,
      everyNMonths:
        draft.cadence === "everyNMonths" ? Number(draft.everyNMonths) : undefined,
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

  const handleSaveHousingEvent = (draft: HousingEventDraft) => {
    if (!scenarioIdValue) {
      return;
    }
    setLedgerActionError(null);
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
        draft.kind === "mortgage" && !draft.mortgagePayment ? true : undefined,
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
    }

    if (payload.kind === "mortgage" && payload.propertyAssetId && payload.mortgageLiabilityId) {
      upsertScenarioAssets(scenarioIdValue, [
        {
          id: payload.propertyAssetId,
          kind: "home",
          label: payload.label,
        },
      ]);
      upsertScenarioLiabilities(scenarioIdValue, [
        {
          id: payload.mortgageLiabilityId,
          kind: "mortgage",
          label: payload.label,
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
  const handleEditV2Event = (eventId: string) => {
    if (!scenarioIsV2) {
      return;
    }
    const match = v2ScenarioEvents.find((event) => event.id === eventId);
    if (!match) {
      setLedgerActionError(t("ledgerEventMissing"));
      return;
    }
    openV2EventDrawer("edit", match.type, eventId);
  };
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
  const handleDeleteV2Event = (eventId: string) => {
    if (!scenarioIsV2) {
      return;
    }
    const match = v2ScenarioEvents.find((event) => event.id === eventId);
    if (!match) {
      setLedgerActionError(t("ledgerEventMissing"));
      return;
    }
    setDeleteConfirmation({
      type: "eventV2",
      id: eventId,
      label: match.label ?? t("ledgerRowFallbackLabel"),
    });
  };
  const handleAdjustEvent = (row: LedgerRow) => {
    setLedgerActionError(null);
    setAdjustmentDraft({
      row,
      amount: "",
    });
  };
  const assetItems = useMemo(
    () => (scenario ? toAssetItems(scenario) : []),
    [scenario]
  );
  const liabilityItems = useMemo(
    () => (scenario ? toLiabilityItems(scenario) : []),
    [scenario]
  );
  const handleUpsertMoneyItem = (item: Parameters<typeof upsertMoneyItem>[0]["item"]) => {
    if (!scenario || !scenarioIdValue || scenarioIsV2) {
      return;
    }
    upsertMoneyItem({
      item,
      scenarioId: scenarioIdValue,
      baseCurrency: scenario.baseCurrency,
      eventLibrary,
      budgetRules,
      actions: {
        createBudgetRule,
        updateBudgetRule,
        addEventToScenarios,
        updateEventDefinition,
      },
      resolveCategoryLabel: resolveMoneyCategoryLabel,
    });
  };
  const handleRemoveMoneyItem = (item: Parameters<typeof removeMoneyItem>[0]["item"]) => {
    if (!scenarioIdValue || scenarioIsV2) {
      return;
    }
    removeMoneyItem({
      item,
      scenarioId: scenarioIdValue,
      actions: {
        removeScenarioEventRef,
        removeBudgetRule,
      },
    });
  };
  const handleDetachMoneyItem = (item: Parameters<typeof removeMoneyItem>[0]["item"]) => {
    if (
      !scenarioIdValue ||
      scenarioIsV2 ||
      (item.source !== "eventGenerated" && item.source !== "derived")
    ) {
      return;
    }
    if (item.sourceType === "budgetRule" && item.sourceId) {
      updateBudgetRule(item.sourceId, {
        source: "manual",
        generatedByEventId: undefined,
        generatedBy: undefined,
        linkedAssetId: undefined,
        linkedLiabilityId: undefined,
      });
      return;
    }
    if (item.sourceId) {
      updateEventDefinition(item.sourceId, {
        generatedByEventId: undefined,
        source: "manual",
        generatedBy: undefined,
        linkedAssetId: undefined,
        linkedLiabilityId: undefined,
      });
    }
  };
  const handleEditMoneySource = (item: Parameters<typeof removeMoneyItem>[0]["item"]) => {
    if (scenarioIsV2) {
      return;
    }
    const generatedBy = item.generatedBy;
    if (generatedBy?.type === "assetCost" || generatedBy?.type === "assetRental") {
      setActiveTab("assets");
      setOpenAssetEditId(generatedBy.assetId);
      return;
    }
    if (generatedBy?.type === "loanPayment") {
      setActiveTab("liabilities");
      setOpenLiabilityEditId(generatedBy.liabilityId);
      return;
    }
    if (item.linkedAssetId) {
      setActiveTab("assets");
      setOpenAssetEditId(item.linkedAssetId);
    }
    if (item.linkedLiabilityId) {
      setActiveTab("liabilities");
      setOpenLiabilityEditId(item.linkedLiabilityId);
    }
  };
  const syncDerivedMoneyItemsForAsset = (asset: AssetItem) => {
    if (!scenario || !scenarioIdValue || scenarioIsV2) {
      return;
    }
    const derivedItems = buildDerivedMoneyItemsForAsset({
      asset,
      baseCurrency: scenario.baseCurrency,
      labels: assetDerivedLabels,
    });
    const existingDerivedItems = findDerivedMoneyItemsForAsset(moneyItems, asset.id);
    existingDerivedItems.forEach((entry) => handleRemoveMoneyItem(entry));
    derivedItems.forEach((entry) =>
      upsertMoneyItem({
        item: entry,
        scenarioId: scenarioIdValue,
        baseCurrency: scenario.baseCurrency,
        eventLibrary,
        budgetRules,
        actions: {
          createBudgetRule,
          updateBudgetRule,
          addEventToScenarios,
          updateEventDefinition,
        },
        resolveCategoryLabel: resolveMoneyCategoryLabel,
      })
    );
  };
  const syncDerivedMoneyItemsForLiability = (liability: LiabilityItem) => {
    if (!scenario || !scenarioIdValue || scenarioIsV2) {
      return;
    }
    const derivedItems = buildDerivedMoneyItemsForLiability({
      liability,
      baseCurrency: scenario.baseCurrency,
      label: liabilityPaymentLabel,
    });
    const existingDerivedItems = findDerivedMoneyItemsForLiability(moneyItems, liability.id);
    existingDerivedItems.forEach((entry) => handleRemoveMoneyItem(entry));
    derivedItems.forEach((entry) =>
      upsertMoneyItem({
        item: entry,
        scenarioId: scenarioIdValue,
        baseCurrency: scenario.baseCurrency,
        eventLibrary,
        budgetRules,
        actions: {
          createBudgetRule,
          updateBudgetRule,
          addEventToScenarios,
          updateEventDefinition,
        },
        resolveCategoryLabel: resolveMoneyCategoryLabel,
      })
    );
  };
  const handleUpsertAssetItem = (item: Parameters<typeof applyAssetItemChange>[1]["item"]) => {
    if (!scenario || !scenarioIdValue) {
      return;
    }
    const nextPositions = applyAssetItemChange(scenario, { type: "upsert", item });
    setScenarioPositions(scenarioIdValue, nextPositions);
    if (scenarioIsV2) {
      return;
    }
    const nextScenario = { ...scenario, positions: nextPositions };
    const nextAsset = toAssetItems(nextScenario).find((entry) => entry.id === item.id);
    if (nextAsset) {
      syncDerivedMoneyItemsForAsset(nextAsset);
    }
  };
  const handleRemoveAssetItem = (item: AssetItem) => {
    if (!scenario || !scenarioIdValue) {
      return;
    }
    const nextPositions = applyAssetItemChange(scenario, { type: "remove", item });
    setScenarioPositions(scenarioIdValue, nextPositions);
    if (scenarioIsV2) {
      return;
    }
    const derivedItems = findDerivedMoneyItemsForAsset(moneyItems, item.id);
    derivedItems.forEach((entry) => handleRemoveMoneyItem(entry));
  };
  const handleUpsertLiabilityItem = (
    item: Parameters<typeof applyLiabilityItemChange>[1]["item"]
  ) => {
    if (!scenario || !scenarioIdValue) {
      return;
    }
    const nextPositions = applyLiabilityItemChange(scenario, { type: "upsert", item });
    setScenarioPositions(scenarioIdValue, nextPositions);
    if (scenarioIsV2) {
      return;
    }
    const nextScenario = { ...scenario, positions: nextPositions };
    const nextLiability = toLiabilityItems(nextScenario).find(
      (entry) => entry.id === item.id
    );
    if (nextLiability) {
      syncDerivedMoneyItemsForLiability(nextLiability);
    }
  };
  const handleRemoveLiabilityItem = (item: LiabilityItem) => {
    if (!scenario || !scenarioIdValue) {
      return;
    }
    const nextPositions = applyLiabilityItemChange(scenario, { type: "remove", item });
    setScenarioPositions(scenarioIdValue, nextPositions);
    if (scenarioIsV2) {
      return;
    }
    const derivedItems = findDerivedMoneyItemsForLiability(moneyItems, item.id);
    derivedItems.forEach((entry) => handleRemoveMoneyItem(entry));
  };
  const handleViewAssetItem = (item: AssetItem) => {
    switch (item.assetType) {
      case "property":
        setAssetDetails({ type: "home", id: item.id });
        break;
      case "investment":
        setAssetDetails({ type: "investment", id: item.id });
        break;
      case "insurance":
        setAssetDetails({ type: "insurance", id: item.id });
        break;
      case "car":
        setAssetDetails({ type: "car", id: item.id });
        break;
      default:
        break;
    }
  };
  const handleViewLiabilityItem = (item: LiabilityItem) => {
    setAssetDetails({ type: "loan", id: item.id });
  };
  const handleEditMilestoneEvent = (event: MilestoneEvent) => {
    setEditingMilestoneEvent(event);
    setMilestoneWizardOpen(true);
  };
  const handleEditMilestoneEventById = (eventId: string) => {
    const match = milestoneEvents.find((event) => event.id === eventId);
    if (!match) {
      return;
    }
    handleEditMilestoneEvent(match);
  };
  const handleCreateMilestoneEvent = () => {
    setEditingMilestoneEvent(null);
    setMilestoneWizardOpen(true);
  };
  const handleApplyMilestoneEvent = (draft: MilestoneEventDraft) => {
    if (!scenarioIdValue) {
      return;
    }
    const result = applyMilestoneEvent(scenarioIdValue, draft);
    if (Object.keys(result.fieldErrors).length === 0) {
      setMilestoneWizardOpen(false);
      setEditingMilestoneEvent(null);
    }
  };
  const handleRemoveMilestoneEvent = (eventId: string) => {
    if (!scenarioIdValue) {
      return;
    }
    removeMilestoneEvent(scenarioIdValue, eventId);
  };
  const handleDetachAssetItem = (item: AssetItem) => {
    if (!scenario || !scenarioIdValue || item.source !== "eventGenerated") {
      return;
    }
    const positions = scenario.positions ?? {};
    if (item.assetType === "property") {
      const nextHomes = (positions.homes ?? []).map((home) =>
        home.id === item.id
          ? { ...home, source: "manual" as const, generatedByEventId: undefined }
          : home
      );
      setScenarioPositions(scenarioIdValue, { ...positions, homes: nextHomes });
      return;
    }
    if (item.assetType === "investment") {
      const nextInvestments = (positions.investments ?? []).map((investment) =>
        investment.id === item.id
          ? { ...investment, source: "manual" as const, generatedByEventId: undefined }
          : investment
      );
      setScenarioPositions(scenarioIdValue, { ...positions, investments: nextInvestments });
      return;
    }
    if (item.assetType === "insurance") {
      const nextInsurances = (positions.insurances ?? []).map((insurance) =>
        insurance.id === item.id
          ? { ...insurance, source: "manual" as const, generatedByEventId: undefined }
          : insurance
      );
      setScenarioPositions(scenarioIdValue, { ...positions, insurances: nextInsurances });
      return;
    }
    const nextCars = (positions.cars ?? []).map((car) =>
      car.id === item.id
        ? { ...car, source: "manual" as const, generatedByEventId: undefined }
        : car
    );
    setScenarioPositions(scenarioIdValue, { ...positions, cars: nextCars });
  };
  const handleDetachLiabilityItem = (item: LiabilityItem) => {
    if (!scenario || !scenarioIdValue || item.source !== "eventGenerated") {
      return;
    }
    const positions = scenario.positions ?? {};
    const nextLoans = (positions.loans ?? []).map((loan) =>
      loan.id === item.id
        ? { ...loan, source: "manual" as const, generatedByEventId: undefined }
        : loan
    );
    setScenarioPositions(scenarioIdValue, { ...positions, loans: nextLoans });
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
  const isPastSellMonth = (sellMonth?: string) => {
    if (!sellMonth || !currentProjectionMonth) {
      return false;
    }
    if (!isValidMonthStr(sellMonth) || !isValidMonthStr(currentProjectionMonth)) {
      return false;
    }
    return monthIndex(currentProjectionMonth, sellMonth) < 0;
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
      hasHandledInitialAdd.current = true;
      return;
    }
    if (action === "oneOffExpense") {
      setActiveTab("expenses");
      setOpenOneOffExpense(true);
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
  }, [baseMonth, initialAdd, scenarioIdValue, setActiveTab]);

  useEffect(() => {
    if (hasHandledInitialEdit.current) {
      return;
    }
    if (!scenarioIdValue) {
      return;
    }
    if (initialEditEventId) {
      if (scenarioIsV2) {
        const match = v2ScenarioEvents.find((event) => event.id === initialEditEventId);
        if (match) {
          setActiveTab("income");
          openV2EventDrawer("edit", match.type, match.id);
          hasHandledInitialEdit.current = true;
          return;
        }
      } else {
        const match = eventRows.find((row) => row.view.definition.id === initialEditEventId);
        if (match) {
          setActiveTab("timeline");
          setEditingEvent(match.view);
          hasHandledInitialEdit.current = true;
          return;
        }
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
    eventRows,
    initialEditEventId,
    initialEditHomeId,
    initialEditSmartInvest,
    openDrawer,
    openV2EventDrawer,
    scenarioIdValue,
    scenarioIsV2,
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

    const { type, id } = deleteConfirmation;
    
    switch (type) {
      case "event":
        removeScenarioEventRef(scenarioIdValue, id);
        break;
      case "eventV2":
        removeEvent(id, scenarioIdValue);
        break;
      case "asset":
        // Determine asset type from the homes, cars, investments, insurances lists
        if (homes.some((h) => h.id === id)) {
          removeHomePosition(scenarioIdValue, id);
        } else if (cars.some((c) => c.id === id)) {
          removeCarPosition(scenarioIdValue, id);
        } else if (investments.some((i) => i.id === id)) {
          removeInvestmentPosition(scenarioIdValue, id);
        } else if (insurances.some((i) => i.id === id)) {
          removeInsurancePosition(scenarioIdValue, id);
        }
        break;
      case "loan":
        removeLoanPosition(scenarioIdValue, id);
        break;
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
    const { row } = adjustmentDraft;
    const result = addEvent(
      {
        type: "adjustment",
        kind: "cash",
        month: row.month,
        amount: amountValue,
        label: `[Adjustment] ${row.label ?? t("ledgerRowFallbackLabel")}`,
        memberId: row.memberId,
        tags: ["adjustment"],
      },
      scenarioIdValue
    );
    if (!result.ok) {
      setLedgerActionError(t("ledgerEventCreateFailed"));
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
      if (car.annualDepreciationRatePct !== undefined) {
        valueRows.push(
          ...buildValueSchedule({
            baseValue: car.purchasePrice ?? 0,
            annualAppreciationDecimal: -(car.annualDepreciationRatePct ?? 0) / 100,
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

  const renderEventList = (
    rows: typeof eventRows,
    options: {
      showHighlightToggle?: boolean;
      showOverlapHint?: boolean;
      showEditButton?: boolean;
    } = {}
  ) => {
    if (rows.length === 0) {
      return (
        <Text size="sm" c="dimmed">
          {t("emptyEvents")}
        </Text>
      );
    }

    return (
      <Stack gap="sm">
        {rows.map(({ view, event }) => {
          const memberLabel =
            (event.memberId ? memberLookup.get(event.memberId) : null) ??
            timelineText("memberHousehold");
          const displayLabel = event.name || getEventTypeDisplay(timelineText, event.type);
          const amountValue = event.monthlyAmount || event.oneTimeAmount;
          const amountLabel =
            amountValue && amountValue !== 0
              ? formatCurrency(amountValue, event.currency, locale)
              : t("amountUnset");
          const overlapBadge =
            options.showOverlapHint && hasBudgetRules && getEventGroup(event.type) === "expense";
          return (
            <Card key={event.id} withBorder radius="md" padding="sm">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Group>
                  {options.showHighlightToggle && scenarioIdValue && (
                    <Button
                      size="xs"
                      variant={view.ref.highlighted ? "light" : "subtle"}
                      color={view.ref.highlighted ? "yellow" : "gray"}
                      onClick={() =>
                        updateScenarioEventRef(scenarioIdValue, view.ref.refId, {
                          highlighted: !view.ref.highlighted,
                        })
                      }
                      aria-label={timelineText("highlightToggle")}
                    >
                      {view.ref.highlighted ? "★" : "☆"}
                    </Button>
                  )}
                  <Stack gap={2}>
                    <Text fw={600}>{displayLabel}</Text>
                    <Text size="xs" c="dimmed">
                      {event.endMonth == event.startMonth ?
                        t("eventMetaSingleMonth", { member: memberLabel, startMonth: event.startMonth })
                        : t("eventMeta", { member: memberLabel, startMonth: event.startMonth, endMonth: event.endMonth })
                      }
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("eventAmount", { amount: amountLabel })}
                    </Text>
                    {overlapBadge && (
                      <Badge color="yellow" variant="light">
                        {t("overlapWarning")}
                      </Badge>
                    )}
                  </Stack>
                </Group>
                
                <Group gap="xs">
                  {options.showEditButton && (
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => setEditingEvent(view)}
                    >
                      {common("actionEdit")}
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => {
                      const displayLabel = event.name || getEventTypeDisplay(timelineText, event.type);
                      setDeleteConfirmation({
                        type: "event",
                        id: view.definition.id,
                        label: displayLabel,
                      });
                    }}
                  >
                    {common("actionDelete")}
                  </Button>
                </Group>
              </Group>
            </Card>
          );
        })}
      </Stack>
    );
  };

  return (
    <Stack gap="xl">
      <TwoPaneLayout
        left={
          <Stack gap="xl">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Stack gap={4}>
                <Title order={2}>{t("title")}</Title>
                <Text size="sm" c="dimmed">
                  {t("subtitle")}
                </Text>
              </Stack>
              <Button onClick={() => setAddFlowOpen(true)}>{t("addButton")}</Button>
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
            <Card withBorder radius="md" padding="md">
              <Stack gap="xs">
                <Text fw={600}>{t("orderTitle")}</Text>
                <Text size="sm" c="dimmed">
                  {t("orderHint")}
                </Text>
              </Stack>
            </Card>
            <MoneyLegacyBanner schemaVersion={scenario?.meta?.schemaVersion} />

            <Tabs value={activeTab} onChange={(value) => setActiveTab(value as MoneyTab)}>
              <Tabs.List>
                <Tabs.Tab value="income">{t("incomeTitle")}</Tabs.Tab>
                <Tabs.Tab value="expenses">{t("expensesTitle")}</Tabs.Tab>
                <Tabs.Tab value="assets">{t("assetsTitle")}</Tabs.Tab>
                <Tabs.Tab value="liabilities">{t("liabilitiesTitle")}</Tabs.Tab>
                <Tabs.Tab value="timeline">{t("timelineTitle")}</Tabs.Tab>
                <Tabs.Tab value="inputs">{t("inputsTitle")}</Tabs.Tab>
              </Tabs.List>

        <Tabs.Panel value="income" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("incomeDescription")}
            </Text>
            {scenarioIsV2 ? (
              <MoneyLedgerView
                rows={incomeLedgerRows}
                baseCurrency={scenario?.baseCurrency ?? "USD"}
                locale={locale}
                members={members}
                onAddEvent={() => openV2EventTypePicker("income")}
                onEditEvent={handleEditV2Event}
                onDuplicateEvent={handleDuplicateV2Event}
                onDeleteEvent={handleDeleteV2Event}
                onAdjustEvent={handleAdjustEvent}
                errorMessage={ledgerActionError}
              />
            ) : (
              <MoneyFlowManager
                items={moneyItems}
                baseCurrency={scenario?.baseCurrency ?? "USD"}
                locale={locale}
                members={members}
                categoryLabels={moneyCategoryLabelMap}
                categoryOptions={moneyCategoryOptions}
                defaultFilters={{ kind: "income" }}
                defaultNewItem={{ kind: "income", cadence: "recurring" }}
                onUpsert={handleUpsertMoneyItem}
                onDelete={handleRemoveMoneyItem}
                onEditEvent={handleEditMilestoneEventById}
                onDetach={handleDetachMoneyItem}
                onEditSource={handleEditMoneySource}
              />
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="expenses" pt="md">
          <Stack gap="md">
            <Card withBorder radius="md" padding="md">
              <Text size="sm">{t("expenseGuidance")}</Text>
            </Card>
            <Text size="sm" c="dimmed">
              {t("expensesDescription")}
            </Text>
            {scenarioIsV2 ? (
              <MoneyLedgerView
                rows={expenseLedgerRows}
                baseCurrency={scenario?.baseCurrency ?? "USD"}
                locale={locale}
                members={members}
                onAddEvent={() => openV2EventTypePicker("expense")}
                onEditEvent={handleEditV2Event}
                onDuplicateEvent={handleDuplicateV2Event}
                onDeleteEvent={handleDeleteV2Event}
                onAdjustEvent={handleAdjustEvent}
                errorMessage={ledgerActionError}
              />
            ) : (
              <MoneyFlowManager
                items={moneyItems}
                baseCurrency={scenario?.baseCurrency ?? "USD"}
                locale={locale}
                members={members}
                categoryLabels={moneyCategoryLabelMap}
                categoryOptions={moneyCategoryOptions}
                defaultFilters={{ kind: "expense" }}
                defaultNewItem={{
                  kind: "expense",
                  cadence: openOneOffExpense ? "oneOff" : "recurring",
                }}
                onUpsert={handleUpsertMoneyItem}
                onDelete={handleRemoveMoneyItem}
                onEditEvent={handleEditMilestoneEventById}
                onDetach={handleDetachMoneyItem}
                onEditSource={handleEditMoneySource}
                openNewItem={openOneOffExpense}
                onOpenNewItemHandled={() => setOpenOneOffExpense(false)}
              />
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="assets" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("assetsDescription")}
            </Text>
            <AssetManager
              items={assetItems}
              baseCurrency={scenario?.baseCurrency ?? "USD"}
              locale={locale}
              members={members}
              moneyItems={moneyItems}
              onUpsert={handleUpsertAssetItem}
              onDelete={handleRemoveAssetItem}
              onView={handleViewAssetItem}
              onEditEvent={handleEditMilestoneEventById}
              onDetach={handleDetachAssetItem}
              openEditId={openAssetEditId}
              onOpenEditHandled={() => setOpenAssetEditId(null)}
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
            <LiabilityManager
              items={liabilityItems}
              baseCurrency={scenario?.baseCurrency ?? "USD"}
              locale={locale}
              moneyItems={moneyItems}
              onUpsert={handleUpsertLiabilityItem}
              onDelete={handleRemoveLiabilityItem}
              onView={handleViewLiabilityItem}
              onEditEvent={handleEditMilestoneEventById}
              onDetach={handleDetachLiabilityItem}
              openEditId={openLiabilityEditId}
              onOpenEditHandled={() => setOpenLiabilityEditId(null)}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="timeline" pt="md">
          <Stack gap="md">
            <EventManager
              events={milestoneEvents}
              onCreate={handleCreateMilestoneEvent}
              onEdit={handleEditMilestoneEvent}
              onDelete={handleRemoveMilestoneEvent}
            />
            <Card withBorder radius="md" padding="md">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text size="sm" c="dimmed">
                  {t("timelineDescription")}
                </Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => {
                    setActiveTab("expenses");
                    setOpenOneOffExpense(true);
                  }}
                >
                  {t("timelineOneOffCta")}
                </Button>
              </Group>
            </Card>
            <Divider />
            <Stack gap="md">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text size="sm" fw={600}>
                  {t("legacyEventsTitle")}
                </Text>
                <Switch
                  label={t("highlightFilter")}
                  checked={highlightOnly}
                  onChange={(event) => setHighlightOnly(event.currentTarget.checked)}
                />
              </Group>
              <Group wrap="wrap">
                <Select
                  value={memberFilter}
                  onChange={setMemberFilter}
                  data={[
                    { value: "all", label: t("filterAllMembers") },
                    ...members.map((member) => ({
                      value: member.id,
                      label: member.name,
                    })),
                  ]}
                  placeholder={t("filterMemberPlaceholder")}
                />
                <Select
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  data={[
                    { value: "all", label: t("filterAllCategories") },
                    ...Array.from(new Set(eventRows.map((row) => row.event.type))).map((type) => ({
                      value: type,
                      label: getEventTypeDisplay(timelineText, type),
                    })),
                  ]}
                  placeholder={t("filterCategoryPlaceholder")}
                />
              </Group>
              <Card withBorder radius="md" padding="md">
                <Text size="sm">{t("timelineWarning")}</Text>
              </Card>
              {renderEventList(timelineEvents, {
                showHighlightToggle: true,
                showOverlapHint: true,
                showEditButton: true,
              })}
              <Button component={Link} href={timelineTabHref} size="xs" variant="light">
                {common("openTimeline")}
              </Button>
            </Stack>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="inputs" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("inputsDescription")}
            </Text>
            <SegmentedControl
              value={inputsFilter}
              onChange={(value) =>
                setInputsFilter(value as "all" | "rules" | "assets" | "events")
              }
              data={[
                { value: "all", label: t("inputsFilterAll") },
                { value: "rules", label: t("inputsFilterRules") },
                { value: "assets", label: t("inputsFilterAssets") },
                { value: "events", label: t("inputsFilterEvents") },
              ]}
            />
            {inputsItems.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t("inputsEmpty")}
              </Text>
            ) : (
              <Stack gap="sm">
                {inputsItems.map((item) => (
                  <Card key={`${item.kind}-${item.id}`} withBorder radius="md" padding="sm">
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
                        <Button size="xs" variant="subtle" color="red" onClick={item.onDelete}>
                          {common("actionDelete")}
                        </Button>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Tabs.Panel>
            </Tabs>
          </Stack>
        }
        right={
          <RightPaneDashboard
            months={projectionMonths}
            selectedRange={normalizedRange}
            currency={scenario?.baseCurrency ?? "USD"}
            cashBalance={cashBalanceValue}
            netWorth={netWorthValue}
            netCashflow={netCashflowValue}
            cashSeries={cashSeries}
            netWorthSeries={netWorthSeries}
            netCashflowSeries={netCashflowSeries}
            showCharts={false}
            onRangeChange={(range) => {
              setBreakdownMonthRange(range);
              setBreakdownMonth(range.toMonth ?? null);
            }}
            onOpenBreakdown={(focus) => {
              if (!selectedDashboardMonth) {
                return;
              }
              openModal("monthlyBreakdown", {
                month: selectedDashboardMonth,
                focus,
              });
            }}
          />
        }
      />

      <AddFlowDrawer
        opened={addFlowOpen}
        onClose={() => setAddFlowOpen(false)}
        scenarioId={scenarioIdValue ?? null}
      />

      {milestoneSnapshot && (
        <EventWizard
          opened={milestoneWizardOpen}
          onClose={() => {
            setMilestoneWizardOpen(false);
            setEditingMilestoneEvent(null);
          }}
          baseCurrency={scenario?.baseCurrency ?? "USD"}
          members={members}
          incomeCategories={moneyCategoryOptions.incomeOptions}
          expenseCategories={moneyCategoryOptions.expenseOptions}
          budgetCategories={moneyCategoryOptions.budgetOptions}
          snapshot={milestoneSnapshot}
          initialEvent={editingMilestoneEvent}
          onApply={handleApplyMilestoneEvent}
        />
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

      {scenario && scenarioIdValue && (
        <>
          {scenarioIsV2 && (
            <>
              <Drawer
                opened={v2EventTypePickerOpen}
                onClose={() => setV2EventTypePickerOpen(false)}
                position="right"
                size="sm"
                title={t("ledgerAddEvent")}
              >
                <Stack gap="sm">
                  <Button
                    variant="light"
                    onClick={() => {
                      setV2EventTypePickerOpen(false);
                      openV2EventDrawer("create", "cashflow");
                    }}
                  >
                    {t("ledgerEventCashflowType")}
                  </Button>
                  <Button
                    variant="light"
                    onClick={() => {
                      setV2EventTypePickerOpen(false);
                      openV2EventDrawer("create", "housing");
                    }}
                  >
                    {t("housingDrawerTitle")}
                  </Button>
                  <Button
                    variant="light"
                    onClick={() => {
                      setV2EventTypePickerOpen(false);
                      openV2EventDrawer("create", "loan");
                    }}
                  >
                    {t("loanDrawerTitle")}
                  </Button>
                  <Button
                    variant="light"
                    onClick={() => {
                      setV2EventTypePickerOpen(false);
                      openV2EventDrawer("create", "insurance");
                    }}
                  >
                    {t("insuranceDrawerTitle")}
                  </Button>
                </Stack>
              </Drawer>
              <CashflowEventDrawer
                opened={
                  v2EventDrawerOpen &&
                  (v2EventDrawerType === "cashflow" || v2EventDrawerType === "adjustment")
                }
                mode={v2EventDrawerMode}
                baseCurrency={scenario.baseCurrency}
                members={members}
                event={
                  v2EventDrawerMode === "create"
                    ? null
                    : editingV2DrawerEvent
                }
                defaultKind={v2EventDefaultKind}
                onClose={() => {
                  setV2EventDrawerOpen(false);
                  setEditingV2EventId(null);
                  setV2EventDrawerType(null);
                }}
                onSave={handleSaveV2Event}
              />
              <HousingEventDrawer
                opened={v2EventDrawerOpen && v2EventDrawerType === "housing"}
                mode={v2EventDrawerMode}
                baseCurrency={scenario.baseCurrency}
                event={v2EventDrawerMode === "edit" ? editingHousingEvent : null}
                onClose={() => {
                  setV2EventDrawerOpen(false);
                  setEditingV2EventId(null);
                  setV2EventDrawerType(null);
                }}
                onSave={handleSaveHousingEvent}
              />
              <LoanEventDrawer
                opened={v2EventDrawerOpen && v2EventDrawerType === "loan"}
                mode={v2EventDrawerMode}
                baseCurrency={scenario.baseCurrency}
                event={v2EventDrawerMode === "edit" ? editingLoanEvent : null}
                onClose={() => {
                  setV2EventDrawerOpen(false);
                  setEditingV2EventId(null);
                  setV2EventDrawerType(null);
                }}
                onSave={handleSaveLoanEvent}
              />
              <InsuranceEventDrawer
                opened={v2EventDrawerOpen && v2EventDrawerType === "insurance"}
                mode={v2EventDrawerMode}
                baseCurrency={scenario.baseCurrency}
                event={v2EventDrawerMode === "edit" ? editingInsuranceEvent : null}
                onClose={() => {
                  setV2EventDrawerOpen(false);
                  setEditingV2EventId(null);
                  setV2EventDrawerType(null);
                }}
                onSave={handleSaveInsuranceEvent}
              />
            </>
          )}
          <TimelineEventDrawer
            mode="edit"
            opened={Boolean(editingEvent)}
            onClose={() => setEditingEvent(null)}
            baseCurrency={scenario.baseCurrency}
            baseMonth={baseMonth}
            assumptions={{
              baseMonth,
              horizonMonths: scenario.assumptions.horizonMonths ?? 0,
            }}
            members={members}
            parentGroupOptions={parentGroupOptions}
            editingEvent={editingEvent}
            onUpdateDefinition={updateEventDefinition}
            onUpdateEventRef={(refId, patch) =>
              updateScenarioEventRef(scenarioIdValue, refId, patch)
            }
          />

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
                  month: adjustmentDraft?.row.month ?? "--",
                })}
              </Text>
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
                {t("deleteConfirmation", { label: deleteConfirmation?.label ?? "" })}
              </Text>
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
                  {common("actionDelete")}
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
        />
    </Stack>
  );
}
