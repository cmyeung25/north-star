"use client";

import {
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { getEventGroup, monthIndex } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  formatLoanSummary,
} from "../../../components/timeline/utils";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { formatCurrency } from "../../../lib/i18n";
import { buildScenarioEventViews, buildTimelineEventFromDefinition } from "../../../src/domain/events/utils";
import { getEventTypeDisplay } from "../../../components/timeline/utils";
import type { ScenarioEventView } from "../../../components/timeline/types";
import { isValidMonthStr } from "../../../src/utils/month";
import { useProjectionWithLedger } from "../../../src/engine/useProjectionWithLedger";
import { buildSmartInvestProjectionBreakdown, type SmartInvestProjectionBreakdown } from "../../../src/domain/smartInvest/projection";
import { buildDefaultSmartInvestPolicy } from "../../../src/domain/smartInvest/defaultPolicy";
import { compileSellLifecycle } from "../../../src/domain/positions/compileSellLifecycle";
import type {
  CarPositionDraft,
  HomePositionDraft,
  InsurancePositionDraft,
  InvestmentPositionDraft,
  LoanPositionDraft,
} from "../../../src/store/scenarioStore";
import type { EventGroup } from "@north-star/engine";

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
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const resolvedScenarioId = useMemo(
    () => resolveScenarioIdFromQuery(scenarioId ?? null, activeScenarioId, scenarios),
    [activeScenarioId, scenarioId, scenarios]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const scenarioIdValue = scenario?.id;
  const { projection } = useProjectionWithLedger(
    scenario,
    eventLibrary,
    {
      members,
      budgetRules,
    }
  );
  const projectionMonths = projection?.months ?? [];
  const latestProjectionMonth = projectionMonths.at(-1) ?? null;
  const [addFlowOpen, setAddFlowOpen] = useState(false);
  const [addEventGroup, setAddEventGroup] = useState<EventGroup | null>(null);
  const [addEventDrawerOpen, setAddEventDrawerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScenarioEventView | null>(null);
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
  const [smartInvestDrawerOpen, setSmartInvestDrawerOpen] = useState(false);
  const [assetDetails, setAssetDetails] = useState<{
    type: "home" | "investment" | "insurance" | "car" | "loan" | "smartInvest";
    id?: string;
  } | null>(null);
  const [assetDetailsMonth, setAssetDetailsMonth] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: "event" | "asset" | "loan";
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

  useEffect(() => {
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

  const openEventDrawer = (group?: EventGroup) => {
    setAddEventGroup(group ?? null);
    setAddEventDrawerOpen(true);
  };

  const memberLookup = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members]
  );

  const eventRows = useMemo(() => {
    if (!scenario) {
      return [];
    }
    return buildScenarioEventViews(scenario, eventLibrary).map((view) => {
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

  const incomeEvents = eventRows.filter(
    (row) => getEventGroup(row.event.type) === "income"
  );
  const expenseEvents = eventRows.filter(
    (row) => getEventGroup(row.event.type) === "expense"
  );

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
  const budgetHref = scenarioIdValue
    ? `/people?scenarioId=${scenarioIdValue}&tab=budget`
    : "/people?tab=budget";

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
    const categoryLabels: Record<string, string> = {
      health: budgetText("categoryHealth"),
      baseline: budgetText("categoryBaseline"),
      childcare: budgetText("categoryChildcare"),
      education: budgetText("categoryEducation"),
      eldercare: budgetText("categoryEldercare"),
      petcare: budgetText("categoryPetcare"),
    };

    return budgetRules.map((rule) => ({
        id: rule.id,
        kind: "rule" as const,
        label: rule.name,
        description: t("inputsRuleMeta", {
          category: categoryLabels[rule.category] ?? rule.category,
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
    budgetText,
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
      setAddEventGroup(null);
      setAddEventDrawerOpen(true);
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
      const match = eventRows.find((row) => row.view.definition.id === initialEditEventId);
      if (match) {
        setActiveTab("timeline");
        setEditingEvent(match.view);
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
      setSmartInvestDrawerOpen(true);
      hasHandledInitialEdit.current = true;
    }
  }, [
    eventRows,
    initialEditEventId,
    initialEditHomeId,
    initialEditSmartInvest,
    scenarioIdValue,
    setActiveTab,
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
                      {t("eventMeta", { member: memberLabel, month: event.startMonth })}
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
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={4}>
          <Title order={2}>{t("title")}</Title>
          <Text size="sm" c="dimmed">
            {t("subtitle")}
          </Text>
        </Stack>
        <Button onClick={() => setAddFlowOpen(true)}>{t("addButton")}</Button>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Text fw={600}>{t("orderTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("orderHint")}
          </Text>
        </Stack>
      </Card>

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
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm" c="dimmed">
                {t("incomeListLabel")}
              </Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => openEventDrawer("income")}
                disabled={!scenarioIdValue}
              >
                {t("addIncomeEvent")}
              </Button>
            </Group>
            {renderEventList(incomeEvents, { showEditButton: true })}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="expenses" pt="md">
          <Stack gap="md">
            <Card withBorder radius="md" padding="md">
              <Text size="sm">{t("expenseGuidance")}</Text>
            </Card>
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm" c="dimmed">
                {t("expensesDescription")}
              </Text>
              <Group gap="xs">
                <Button component={Link} href={budgetHref} size="xs" variant="light">
                  {t("expensesBudgetCta")}
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => openEventDrawer("expense")}
                  disabled={!scenarioIdValue}
                >
                  {t("addExpenseEvent")}
                </Button>
              </Group>
            </Group>
            {renderEventList(expenseEvents, {
              showOverlapHint: true,
              showEditButton: true,
            })}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="assets" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("assetsDescription")}
            </Text>
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text fw={600}>{homesText("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    setCreatingHome(createHomePositionFromTemplate({ baseMonth }))
                  }
                  disabled={!scenarioIdValue}
                >
                  {homesText("addHome")}
                </Button>
              </Group>
              {homes.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {homesText("empty")}
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {homes.map((home) => (
                    <Card key={home.id} withBorder radius="md" padding="sm">
                      <Stack gap={4}>
                        <Text fw={600}>{homesText("title")}</Text>
                        <Text size="sm" c="dimmed">
                          {formatHomeSummary(homesText, home, scenario?.baseCurrency ?? "USD", locale)}
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="subtle"
                            onClick={() => setAssetDetails({ type: "home", id: home.id })}
                          >
                            {common("actionDetails")}
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            onClick={() => setEditingHomeId(home.id)}
                          >
                            {common("actionEdit")}
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => {
                              setDeleteConfirmation({
                                type: "asset",
                                id: home.id,
                                label: homesText("title"),
                              });
                            }}
                          >
                            {common("actionDelete")}
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text fw={600}>{investmentsText("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    setCreatingInvestment(createInvestmentPositionFromTemplate({ baseMonth }))
                  }
                  disabled={!scenarioIdValue}
                >
                  {investmentsText("addInvestment")}
                </Button>
              </Group>
              {investments.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {investmentsText("empty")}
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {investments.map((investment) => (
                    <Card key={investment.id} withBorder radius="md" padding="sm">
                      <Stack gap={4}>
                        <Text fw={600}>{investmentsText("title")}</Text>
                        <Text size="sm" c="dimmed">
                          {formatInvestmentSummary(
                            investmentsText,
                            investment,
                            scenario?.baseCurrency ?? "USD",
                            locale
                          )}
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="subtle"
                            onClick={() =>
                              setAssetDetails({ type: "investment", id: investment.id })
                            }
                          >
                            {common("actionDetails")}
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            onClick={() => setEditingInvestmentId(investment.id)}
                          >
                            {common("actionEdit")}
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => {
                              setDeleteConfirmation({
                                type: "asset",
                                id: investment.id ?? "",
                                label: investmentsText("title"),
                              });
                            }}
                          >
                            {common("actionDelete")}
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
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
                    onClick={() => setSmartInvestDrawerOpen(true)}
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
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text fw={600}>{insurancesText("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    setCreatingInsurance(createInsurancePositionFromTemplate({ baseMonth }))
                  }
                  disabled={!scenarioIdValue}
                >
                  {insurancesText("addInsurance")}
                </Button>
              </Group>
              {insurances.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {insurancesText("empty")}
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {insurances.map((insurance) => (
                    <Card key={insurance.id} withBorder radius="md" padding="sm">
                      <Stack gap={4}>
                        <Text fw={600}>{insurancesText("title")}</Text>
                        <Text size="sm" c="dimmed">
                          {formatInsuranceSummary(
                            insurancesText,
                            insurance,
                            scenario?.baseCurrency ?? "USD",
                            locale
                          )}
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="subtle"
                            onClick={() =>
                              setAssetDetails({ type: "insurance", id: insurance.id })
                            }
                          >
                            {common("actionDetails")}
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            onClick={() => setEditingInsuranceId(insurance.id)}
                          >
                            {common("actionEdit")}
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => {
                              setDeleteConfirmation({
                                type: "asset",
                                id: insurance.id ?? "",
                                label: insurancesText("title"),
                              });
                            }}
                          >
                            {common("actionDelete")}
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <Text fw={600}>{carsText("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    setCreatingCar(createCarPositionFromTemplate({ baseMonth }))
                  }
                  disabled={!scenarioIdValue}
                >
                  {carsText("addCar")}
                </Button>
              </Group>
              {cars.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {carsText("empty")}
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {cars.map((car) => (
                    <Card key={car.id} withBorder radius="md" padding="sm">
                      <Stack gap={4}>
                        <Text fw={600}>{carsText("title")}</Text>
                        <Text size="sm" c="dimmed">
                          {formatCarSummary(carsText, car, scenario?.baseCurrency ?? "USD", locale)}
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="subtle"
                            onClick={() => setAssetDetails({ type: "car", id: car.id })}
                          >
                            {common("actionDetails")}
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            onClick={() => setEditingCarId(car.id)}
                          >
                            {common("actionEdit")}
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={() => {
                              setDeleteConfirmation({
                                type: "asset",
                                id: car.id ?? "",
                                label: carsText("title"),
                              });
                            }}
                          >
                            {common("actionDelete")}
                          </Button>
                        </Group>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="liabilities" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("liabilitiesDescription")}
            </Text>
            <Group justify="space-between" align="center" wrap="wrap">
              <Text fw={600}>{loansText("title")}</Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => setCreatingLoan(createLoanPositionFromTemplate({ baseMonth }))}
                disabled={!scenarioIdValue}
              >
                {loansText("addLoan")}
              </Button>
            </Group>
            {loans.length === 0 ? (
              <Text size="sm" c="dimmed">
                {loansText("empty")}
              </Text>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {loans.map((loan) => (
                  <Card key={loan.id} withBorder radius="md" padding="sm">
                    <Stack gap={4}>
                      <Text fw={600}>{loansText("title")}</Text>
                      <Text size="sm" c="dimmed">
                        {formatLoanSummary(loansText, loan, scenario?.baseCurrency ?? "USD", locale)}
                      </Text>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => setAssetDetails({ type: "loan", id: loan.id })}
                        >
                          {common("actionDetails")}
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => setEditingLoanId(loan.id)}
                        >
                          {common("actionEdit")}
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => {
                            setDeleteConfirmation({
                              type: "loan",
                              id: loan.id ?? "",
                              label: loansText("title"),
                            });
                          }}
                        >
                          {common("actionDelete")}
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="timeline" pt="md">
          <Stack gap="md">
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm" c="dimmed">
                {t("timelineDescription")}
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

      <AddFlowDrawer
        opened={addFlowOpen}
        onClose={() => setAddFlowOpen(false)}
        scenarioId={scenarioIdValue ?? null}
      />

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
          <TimelineEventDrawer
            mode="create"
            opened={addEventDrawerOpen}
            onClose={() => {
              setAddEventDrawerOpen(false);
              setAddEventGroup(null);
            }}
            baseCurrency={scenario.baseCurrency}
            baseMonth={baseMonth}
            assumptions={{
              baseMonth,
              horizonMonths: scenario.assumptions.horizonMonths ?? 0,
            }}
            members={members}
            scenarioOptions={scenarios.map((entry) => ({
              value: entry.id,
              label: entry.name,
            }))}
            defaultScenarioId={scenarioIdValue}
            defaultMonth={baseMonth}
            defaultGroup={addEventGroup ?? undefined}
            parentGroupOptions={parentGroupOptions}
            onAddDefinition={(definition, scenarioIds) =>
              addEventToScenarios(definition, scenarioIds)
            }
            onAddHomePosition={() =>
              setCreatingHome(createHomePositionFromTemplate({ baseMonth }))
            }
          />

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
            onClose={() => setSmartInvestDrawerOpen(false)}
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
    </Stack>
  );
}
