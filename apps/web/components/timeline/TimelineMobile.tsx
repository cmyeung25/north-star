"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Notification,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  Title,
  UnstyledButton,
  Tooltip,
} from "@mantine/core";
import { Fragment, useEffect, useMemo, useState } from "react";
import { monthIndex, type EventGroup } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import HomeDetailsForm from "./HomeDetailsForm";
import CarDetailsForm from "./CarDetailsForm";
import InvestmentDetailsForm from "./InvestmentDetailsForm";
import LoanDetailsForm from "./LoanDetailsForm";
import InsuranceDetailsForm from "./InsuranceDetailsForm";
import PositionDetailList from "./PositionDetailList";
import TimelineEventDrawer from "./TimelineEventDrawer";
import MergeDuplicatesModal from "./MergeDuplicatesModal";
import PositionCashflowModal from "./PositionCashflowModal";
import PositionCalculatorModal from "./PositionCalculatorModal";
import CopyToScenariosModal from "./CopyToScenariosModal";
import SmartInvestForm from "../SmartInvestForm";
import type {
  EventDefinition,
  ScenarioEventRef,
  ScenarioEventView,
} from "./types";
import {
  buildEventTreeRows,
  createCarPositionFromTemplate,
  createDefinitionCopy,
  createHomePositionFromTemplate,
  createInsurancePositionFromTemplate,
  createInvestmentPositionFromTemplate,
  createLoanPositionFromTemplate,
  getEventFilterOptions,
  getEventGroupLabel,
  getEventImpactHint,
  getEventTypeDisplay,
  formatCurrency,
  formatDateRange,
  formatCarSummary,
  formatHomeSummary,
  formatInsuranceSummary,
  formatInvestmentSummary,
  formatLoanSummary,
  iconMap,
} from "./utils";
import type {
  CarPositionDraft,
  HomePositionDraft,
  InsurancePositionDraft,
  InvestmentPositionDraft,
  LoanPositionDraft,
  Scenario,
  ScenarioAssumptions,
  ScenarioMember,
} from "../../src/store/scenarioStore";
import type { SmartInvestPolicy } from "../../src/domain/smartInvest/types";
import type { ProjectionResult } from "@north-star/engine";
import type { AdapterWarning } from "../../src/engine/adapter";
import {
  buildCarCashflowBreakdown,
  buildHomeCashflowBreakdown,
  buildInsuranceCashflowBreakdown,
  buildInvestmentCashflowBreakdown,
  buildLoanCashflowBreakdown,
} from "../../src/domain/positions/cashflowBreakdown";
import {
  buildAmortizationSchedule,
  buildContributionSchedule,
  computeMonthlyPayment,
  buildValueSchedule,
} from "../../src/domain/positions/calculations";
import { buildInvestmentValueTable } from "../../src/domain/positions/investmentValueTable";
import { buildInsuranceValueTable } from "../../src/domain/positions/insuranceValueTable";
import {
  buildSmartInvestProjectionBreakdown,
  type SmartInvestProjectionBreakdown,
} from "../../src/domain/smartInvest/projection";
import { buildDefaultSmartInvestPolicy } from "../../src/domain/smartInvest/defaultPolicy";
import { Link } from "../../src/i18n/navigation";
import type { DuplicateCluster } from "../../src/domain/events/mergeDuplicates";
import { isValidMonthStr } from "../../src/utils/month";

const floatingButtonStyle = {
  position: "fixed" as const,
  right: 20,
  bottom: 92,
  zIndex: 10,
};

interface TimelineMobileProps {
  eventViews: ScenarioEventView[];
  eventLibrary: EventDefinition[];
  scenarios: Scenario[];
  homePositions: HomePositionDraft[];
  carPositions: CarPositionDraft[];
  investmentPositions: InvestmentPositionDraft[];
  insurancePositions: InsurancePositionDraft[];
  loanPositions: LoanPositionDraft[];
  members: ScenarioMember[];
  baseCurrency: string;
  baseMonth?: string | null;
  assumptions: ScenarioAssumptions;
  scenarioId: string;
  projection?: ProjectionResult | null;
  projectionWarnings?: AdapterWarning[];
  onAddDefinition: (definition: EventDefinition, scenarioIds: string[]) => void;
  onUpdateDefinition: (id: string, patch: Partial<EventDefinition>) => void;
  onUpdateEventRef: (refId: string, patch: Partial<ScenarioEventRef>) => void;
  onRemoveEventRef: (refId: string) => void;
  onHomePositionAdd: (home: HomePositionDraft) => void;
  onHomePositionUpdate: (home: HomePositionDraft) => void;
  onHomePositionRemove: (homeId: string) => void;
  onCarPositionAdd: (car: CarPositionDraft) => void;
  onCarPositionUpdate: (car: CarPositionDraft) => void;
  onCarPositionRemove: (carId: string) => void;
  onInvestmentPositionAdd: (investment: InvestmentPositionDraft) => void;
  onInvestmentPositionUpdate: (investment: InvestmentPositionDraft) => void;
  onInvestmentPositionRemove: (investmentId: string) => void;
  onInsurancePositionAdd: (insurance: InsurancePositionDraft) => void;
  onInsurancePositionUpdate: (insurance: InsurancePositionDraft) => void;
  onInsurancePositionRemove: (insuranceId: string) => void;
  onLoanPositionAdd: (loan: LoanPositionDraft) => void;
  onLoanPositionUpdate: (loan: LoanPositionDraft) => void;
  onLoanPositionRemove: (loanId: string) => void;
  onUpdateSmartInvest: (policy: SmartInvestPolicy) => void;
  onCopyPositionToScenarios: (
    type: "home" | "car" | "investment" | "insurance" | "loan",
    positionId: string,
    scenarioIds: string[]
  ) => void;
  onCopySmartInvestToScenarios: (scenarioIds: string[]) => void;
  onMergeDuplicates: (cluster: DuplicateCluster, baseDefinitionId: string) => void;
}

type CashflowModalState = {
  title: string;
  entries: ReturnType<typeof buildHomeCashflowBreakdown>["entries"];
  series: ReturnType<typeof buildHomeCashflowBreakdown>["series"];
};

type CalculatorModalState = {
  title: string;
  amortizationRows?: ReturnType<typeof buildAmortizationSchedule>;
  valueRows?: ReturnType<typeof buildValueSchedule>;
  contributionRows?: ReturnType<typeof buildContributionSchedule>;
  assetValueRows?: ReturnType<typeof buildInvestmentValueTable>;
  bucketValueSeries?: SmartInvestProjectionBreakdown["bucketSeries"];
  bucketCurrentRows?: SmartInvestProjectionBreakdown["currentBucketValues"];
};

export default function TimelineMobile({
  eventViews,
  eventLibrary,
  scenarios,
  homePositions,
  carPositions,
  investmentPositions,
  insurancePositions,
  loanPositions,
  members,
  baseCurrency,
  baseMonth,
  assumptions,
  scenarioId,
  projection,
  projectionWarnings,
  onAddDefinition,
  onUpdateDefinition,
  onUpdateEventRef,
  onRemoveEventRef,
  onHomePositionAdd,
  onHomePositionUpdate,
  onHomePositionRemove,
  onCarPositionAdd,
  onCarPositionUpdate,
  onCarPositionRemove,
  onInvestmentPositionAdd,
  onInvestmentPositionUpdate,
  onInvestmentPositionRemove,
  onInsurancePositionAdd,
  onInsurancePositionUpdate,
  onInsurancePositionRemove,
  onLoanPositionAdd,
  onLoanPositionUpdate,
  onLoanPositionRemove,
  onUpdateSmartInvest,
  onCopyPositionToScenarios,
  onCopySmartInvestToScenarios,
  onMergeDuplicates,
}: TimelineMobileProps) {
  const t = useTranslations("timeline");
  const common = useTranslations("common");
  const assumptionsText = useTranslations("assumptions");
  const homes = useTranslations("homes");
  const cars = useTranslations("cars");
  const investments = useTranslations("investments");
  const insurances = useTranslations("insurances");
  const loans = useTranslations("loans");
  const locale = useLocale();
  const horizonMonths = assumptions.horizonMonths > 0 ? assumptions.horizonMonths : 360;
  const defaultSmartInvestPolicy = useMemo(
    () =>
      buildDefaultSmartInvestPolicy(
        assumptionsText("smartInvestDefaultAllocation")
      ),
    [assumptionsText]
  );
  const smartInvestPolicy = assumptions.smartInvest ?? defaultSmartInvestPolicy;
  const hasSmartInvestConfig = Boolean(assumptions.smartInvest);
  const smartInvestBreakdown = useMemo(
    () =>
      projection
        ? buildSmartInvestProjectionBreakdown(projection, smartInvestPolicy.allocation)
        : null,
    [projection, smartInvestPolicy.allocation]
  );
  const smartInvestSummaryItems = useMemo(() => {
    const reserveValue =
      smartInvestPolicy.reserve.mode === "fixed"
        ? formatCurrency(
            smartInvestPolicy.reserve.amount ?? 0,
            baseCurrency,
            locale
          )
        : t("smartInvestReserveMonths", {
            months: smartInvestPolicy.reserve.months ?? 0,
          });
    const contributionValue =
      smartInvestPolicy.contribution.mode === "percentOfIncome"
        ? t("smartInvestContributionIncome", {
            pct: smartInvestPolicy.contribution.pct ?? 0,
          })
        : smartInvestPolicy.contribution.mode === "percentOfSurplus"
          ? t("smartInvestContributionSurplus", {
              pct: smartInvestPolicy.contribution.pct ?? 0,
            })
          : smartInvestPolicy.contribution.mode === "excessCash"
            ? t("smartInvestContributionExcessSummary", {
                pct: smartInvestPolicy.contribution.investPct ?? 100,
                threshold: formatCurrency(
                  smartInvestPolicy.contribution.thresholdAmount ?? 0,
                  baseCurrency,
                  locale
                ),
              })
            : t("smartInvestContributionRebalance");
    const allocationValue = smartInvestPolicy.allocation
      .map((allocation) =>
        t("smartInvestAllocationItem", {
          name: allocation.name,
          pct: allocation.targetPct,
          returnPct: allocation.assumedAnnualReturnPct,
        })
      )
      .join(" · ");

    const totalValue = smartInvestBreakdown?.totalValueSeries.at(-1)?.value;

    return [
      ...(totalValue !== undefined
        ? [
            {
              label: t("smartInvestSummaryTotalValue"),
              value: formatCurrency(totalValue, baseCurrency, locale),
            },
          ]
        : []),
      { label: t("smartInvestSummaryReserve"), value: reserveValue },
      { label: t("smartInvestSummaryContribution"), value: contributionValue },
      { label: t("smartInvestSummaryAllocation"), value: allocationValue },
    ];
  }, [baseCurrency, locale, smartInvestBreakdown, smartInvestPolicy, t]);
  const projectionMonthIndex = 0;
  const assetValuesByKey = projection?.breakdown?.assets.assetsByKey ?? {};
  const liabilityValuesByKey = projection?.breakdown?.assets.liabilitiesByKey ?? {};
  const formatValue = (value: number | null | undefined) =>
    typeof value === "number"
      ? formatCurrency(value, baseCurrency, locale)
      : common("notAvailable");
  const getAssetValue = (key: string) => assetValuesByKey[key]?.[projectionMonthIndex];
  const getLiabilityValue = (key: string) =>
    liabilityValuesByKey[key]?.[projectionMonthIndex];
  const doubleCountLookup = useMemo(() => {
    const lookup = new Set<string>();
    (projectionWarnings ?? []).forEach((warning) => {
      if (warning.code !== "double-count") {
        return;
      }
      const positionId = warning.meta?.positionId;
      const type = warning.meta?.type;
      if (typeof positionId === "string" && typeof type === "string") {
        lookup.add(`${type}:${positionId}`);
      }
    });
    return lookup;
  }, [projectionWarnings]);
  const assetIndicators = useMemo(
    () => [
      { key: "home", label: homes("title"), icon: "🏠", visible: homePositions.length > 0 },
      { key: "car", label: cars("title"), icon: "🚗", visible: carPositions.length > 0 },
      {
        key: "loan",
        label: loans("title"),
        icon: "💳",
        visible: loanPositions.length > 0,
      },
      {
        key: "investment",
        label: investments("title"),
        icon: "📈",
        visible: investmentPositions.length > 0,
      },
      {
        key: "insurance",
        label: insurances("title"),
        icon: "🛡️",
        visible: insurancePositions.length > 0,
      },
      {
        key: "smartInvest",
        label: t("smartInvestTitle"),
        icon: "🤖",
        visible: hasSmartInvestConfig,
      },
    ],
    [
      carPositions.length,
      hasSmartInvestConfig,
      homePositions.length,
      insurancePositions.length,
      insurances,
      investmentPositions.length,
      investments,
      loans,
      loanPositions.length,
      cars,
      homes,
      t,
    ]
  );
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<"all" | EventGroup>("all");
  const [activeTab, setActiveTab] = useState<
    "events" | "positions" | "overview" | "allocation"
  >("events");
  const [pendingScrollMonth, setPendingScrollMonth] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<ScenarioEventView | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null);
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [creatingHome, setCreatingHome] = useState<HomePositionDraft | null>(null);
  const [creatingCar, setCreatingCar] = useState<CarPositionDraft | null>(null);
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(
    null
  );
  const [editingInsuranceId, setEditingInsuranceId] = useState<string | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [homeToastOpen, setHomeToastOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "event" | "home" | "car" | "investment" | "insurance" | "loan";
    id: string;
    label: string;
  } | null>(null);
  const [cashflowModal, setCashflowModal] = useState<CashflowModalState | null>(
    null
  );
  const [calculatorModal, setCalculatorModal] =
    useState<CalculatorModalState | null>(null);
  const [smartInvestDrawerOpen, setSmartInvestDrawerOpen] = useState(false);
  const [copyModal, setCopyModal] = useState<{
    title: string;
    onConfirm: (scenarioIds: string[]) => void;
  } | null>(null);

  const openCopyModal = (
    title: string,
    onConfirm: (scenarioIds: string[]) => void
  ) => {
    setCopyModal({ title, onConfirm });
  };

  const eventRows = useMemo(
    () => buildEventTreeRows(eventViews, activeGroup, collapsedGroups),
    [activeGroup, collapsedGroups, eventViews]
  );
  const hasEvents = eventViews.length > 0;
  const monthGroups = useMemo(() => {
    const groups: Array<{
      month: string;
      label: string;
      rows: typeof eventRows;
    }> = [];
    const map = new Map<string, typeof eventRows>();
    eventRows.forEach((row) => {
      const month = row.view.rule.startMonth ?? "unscheduled";
      const existing = map.get(month);
      if (existing) {
        existing.push(row);
        return;
      }
      const rows: typeof eventRows = [row];
      map.set(month, rows);
      groups.push({
        month,
        label: month === "unscheduled" ? t("monthUnscheduled") : month,
        rows,
      });
    });
    return groups;
  }, [eventRows, t]);

  const milestoneRows = useMemo(() => {
    const normalizeMonths = (values: Array<string | null | undefined>) =>
      Array.from(new Set(values.filter(Boolean) as string[])).sort();
    const homeMonths = normalizeMonths(
      homePositions.map((home) =>
        (home.mode ?? "new_purchase") === "existing"
          ? home.existing?.asOfMonth
          : home.purchaseMonth
      )
    );
    const carMonths = normalizeMonths(carPositions.map((car) => car.purchaseMonth));
    const childMonths = normalizeMonths(
      eventViews
        .filter(
          (view) => view.definition.kind === "cashflow" && view.definition.type === "baby"
        )
        .map((view) => view.rule.startMonth)
    );
    const retirementCandidates = normalizeMonths(
      eventViews
        .filter(
          (view) =>
            view.definition.kind === "cashflow" && view.definition.type === "salary"
        )
        .map((view) => view.rule.endMonth)
    );
    const retirementMonth = retirementCandidates[0];

    return [
      { label: t("overviewHome"), months: homeMonths },
      { label: t("overviewCar"), months: carMonths },
      { label: t("overviewChild"), months: childMonths },
      {
        label: t("overviewRetirement"),
        months: retirementMonth ? [retirementMonth] : [],
      },
    ].filter((row) => row.months.length > 0);
  }, [carPositions, eventViews, homePositions, t]);

  const memberLookup = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members]
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

  const handleToggle = (eventId: string, enabled: boolean) => {
    onUpdateEventRef(eventId, { enabled });
  };

  const handleDuplicate = (view: ScenarioEventView) => {
    const copy = createDefinitionCopy(
      view.definition,
      t("copyName", { name: view.definition.title })
    );
    onAddDefinition(copy, [scenarioId]);
  };

  const handleDelete = (eventId: string, name: string) => {
    setConfirmDelete({ type: "event", id: eventId, label: name });
  };

  const handleEditOpen = (view: ScenarioEventView) => {
    setEditingEvent(view);
  };

  const handleCreateComplete = (startMonth?: string | null) => {
    if (!startMonth) {
      return;
    }
    setActiveTab("events");
    setSelectedMonth(startMonth);
    setPendingScrollMonth(startMonth);
  };

  const overviewUrl = buildScenarioUrl("/overview", scenarioId);
  const editingHome =
    homePositions.find((home) => home.id === editingHomeId) ?? null;
  const editingCar = carPositions.find((car) => car.id === editingCarId) ?? null;
  const editingInvestment =
    investmentPositions.find((investment) => investment.id === editingInvestmentId) ??
    null;
  const editingInsurance =
    insurancePositions.find((insurance) => insurance.id === editingInsuranceId) ??
    null;
  const editingLoan = loanPositions.find((loan) => loan.id === editingLoanId) ?? null;
  const currentProjectionMonth = projection?.months?.[0] ?? baseMonth ?? null;
  const isPastSellMonth = (sellMonth?: string) => {
    if (!sellMonth || !currentProjectionMonth) {
      return false;
    }
    if (!isValidMonthStr(sellMonth) || !isValidMonthStr(currentProjectionMonth)) {
      return false;
    }
    return monthIndex(currentProjectionMonth, sellMonth) < 0;
  };
  const homeDrawerDraft = editingHome ?? creatingHome;
  const carDrawerDraft = editingCar ?? creatingCar;

  useEffect(() => {
    if (!pendingScrollMonth) {
      return;
    }
    const target = document.getElementById(`month-${pendingScrollMonth}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollMonth(null);
    }
  }, [monthGroups, pendingScrollMonth]);

  return (
    <Stack gap="lg" pb={120}>
      <Group justify="space-between">
        <div>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("subtitleMobile")}
          </Text>
          {process.env.NODE_ENV === "development" && (
            <Text c="dimmed" size="xs">
              {t("devHint")}
            </Text>
          )}
        </div>
        {activeTab === "events" && (
          <Button size="xs" variant="light" onClick={() => setMergeOpen(true)}>
            {t("mergeDuplicates")}
          </Button>
        )}
      </Group>

      <Tabs
        value={activeTab}
        onChange={(value) =>
          setActiveTab(value as "events" | "positions" | "overview" | "allocation")
        }
        keepMounted={false}
      >
        <Tabs.List>
          <Tabs.Tab value="events">{t("tabEvents")}</Tabs.Tab>
          <Tabs.Tab value="positions">{t("tabPositions")}</Tabs.Tab>
          <Tabs.Tab value="allocation">{t("tabAssetAllocation")}</Tabs.Tab>
          <Tabs.Tab value="overview">{t("tabOverview")}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="events" pt="md">
          <Stack gap="md">
            <SegmentedControl
              data={getEventFilterOptions(t)}
              value={activeGroup}
              onChange={(value) => setActiveGroup(value as "all" | EventGroup)}
            />

            {monthGroups.length === 0 ? (
              <Text c="dimmed" size="sm">
                {hasEvents ? t("emptyGroup") : t("emptyAll")}
              </Text>
            ) : (
              <Stack gap="md">
                {monthGroups.map(({ month, label, rows }) => {
                  const monthKey = month === "unscheduled" ? "unscheduled" : month;
                  return (
                    <Fragment key={monthKey}>
                      <UnstyledButton
                        id={`month-${monthKey}`}
                        data-month={monthKey}
                        onClick={() => {
                          if (month !== "unscheduled") {
                            setSelectedMonth(month);
                          }
                        }}
                      >
                        <Group justify="space-between">
                          <Text fw={600}>{label}</Text>
                          {selectedMonth === month ? (
                            <Badge variant="light">{t("monthSelected")}</Badge>
                          ) : null}
                        </Group>
                      </UnstyledButton>
                      {rows.map(({ view, depth, hasChildren }) => {
                        const rule = view.rule;
                        const isGroup = view.definition.kind === "group";
                        const eventCurrency = view.definition.currency ?? baseCurrency;
                        const monthlyAmount = rule.monthlyAmount ?? 0;
                        const oneTimeAmount = rule.oneTimeAmount ?? 0;
                        const collapsed = collapsedGroups[view.definition.id] ?? false;

                        return (
                          <Card
                            key={view.definition.id}
                            withBorder
                            shadow="sm"
                            radius="md"
                            padding="md"
                          >
                            <Stack gap="sm">
                              <Group justify="space-between" align="flex-start">
                                <Group gap="sm">
                                  <Text size="xl">
                                    {isGroup ? "📁" : iconMap[view.definition.type]}
                                  </Text>
                                  <div>
                                    <Badge variant="light" color="gray" size="sm">
                                      {isGroup
                                        ? t("groupLabel")
                                        : getEventGroupLabel(t, view.definition.type)}
                                    </Badge>
                                    <Text fw={600} style={{ paddingLeft: depth * 12 }}>
                                      {view.definition.title}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {isGroup
                                        ? t("groupNode")
                                        : getEventTypeDisplay(
                                            t,
                                            view.definition.type,
                                            view.definition.incomeSubtype
                                          )}
                                    </Text>
                                    {rule.startMonth ? (
                                      <Text size="sm" c="dimmed">
                                        {formatDateRange(
                                          t,
                                          rule.startMonth,
                                          rule.endMonth ?? null
                                        )}
                                      </Text>
                                    ) : (
                                      <Text size="sm" c="dimmed">
                                        {t("tablePlaceholder")}
                                      </Text>
                                    )}
                                    {!isGroup && (
                                      <Text size="xs" c="dimmed">
                                        {t("tableMember")}{" "}
                                        {memberLookup.get(view.definition.memberId ?? "") ??
                                          t("tableMemberNone")}
                                      </Text>
                                    )}
                                    {!isGroup && (
                                      <Text size="xs" c="dimmed">
                                        {getEventImpactHint(t, view.definition.type)}
                                      </Text>
                                    )}
                                  </div>
                                </Group>
                                <Switch
                                  checked={view.ref.enabled}
                                  onChange={(eventChange) =>
                                    handleToggle(
                                      view.definition.id,
                                      eventChange.currentTarget.checked
                                    )
                                  }
                                  label={t("tableEnabled")}
                                />
                              </Group>

                              <Group gap="xs">
                                {!isGroup && monthlyAmount !== 0 && (
                                  <Badge variant="light" color="indigo">
                                    {t("monthlyLabel")}{" "}
                                    {formatCurrency(
                                      monthlyAmount,
                                      eventCurrency,
                                      locale
                                    )}
                                  </Badge>
                                )}
                                {!isGroup && oneTimeAmount !== 0 && (
                                  <Badge variant="light" color="grape">
                                    {t("oneTimeLabel")}{" "}
                                    {formatCurrency(
                                      oneTimeAmount,
                                      eventCurrency,
                                      locale
                                    )}
                                  </Badge>
                                )}
                                {(isGroup ||
                                  (monthlyAmount === 0 && oneTimeAmount === 0)) && (
                                  <Badge variant="outline">{t("noAmounts")}</Badge>
                                )}
                              </Group>

                              <Group justify="space-between">
                                <Group gap="xs" wrap="nowrap">
                                  {isGroup && hasChildren && (
                                    <ActionIcon
                                      variant="subtle"
                                      onClick={() =>
                                        setCollapsedGroups((current) => ({
                                          ...current,
                                          [view.definition.id]: !collapsed,
                                        }))
                                      }
                                      aria-label={
                                        collapsed ? t("expandGroup") : t("collapseGroup")
                                      }
                                    >
                                      {collapsed ? "▸" : "▾"}
                                    </ActionIcon>
                                  )}
                                  <Button size="xs" onClick={() => handleEditOpen(view)}>
                                    {common("actionEdit")}
                                  </Button>
                                </Group>
                                <Group gap="xs">
                                  <ActionIcon
                                    variant="subtle"
                                    aria-label={t("duplicateAria", {
                                      name: view.definition.title,
                                    })}
                                    onClick={() => handleDuplicate(view)}
                                  >
                                    ⧉
                                  </ActionIcon>
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    aria-label={t("deleteAria", {
                                      name: view.definition.title,
                                    })}
                                    onClick={() =>
                                      handleDelete(view.definition.id, view.definition.title)
                                    }
                                  >
                                    🗑️
                                  </ActionIcon>
                                </Group>
                              </Group>
                            </Stack>
                          </Card>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="positions" pt="md">
          <Stack gap="md">
            {homeToastOpen && (
              <Notification color="teal" onClose={() => setHomeToastOpen(false)}>
                <Stack gap="xs">
                  <Text size="sm">{t("homeToast")}</Text>
                  <Button component={Link} href={overviewUrl} size="xs" variant="light">
                    {t("goToOverview")}
                  </Button>
                </Stack>
              </Notification>
            )}

            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{homes("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => {
                    setCreatingHome(createHomePositionFromTemplate({ baseMonth }));
                  }}
                >
                  {homes("addHome")}
                </Button>
              </Group>
              {homePositions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {homes("empty")}
                </Text>
              ) : (
                homePositions.map((home, index) => {
                  const homeSold = isPastSellMonth(home.sellMonth);
                  const sellBadgeLabel = home.sellMonth
                    ? homeSold
                      ? t("positionSold")
                      : t("positionSellIn", { month: home.sellMonth })
                    : null;

                  return (
                    <Card key={home.id} withBorder shadow="sm" radius="md" padding="md">
                    <Stack gap="sm">
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Group gap="xs" align="center">
                          <Text>🏠</Text>
                          <Text fw={600}>
                            {homes("homeLabel", { index: index + 1 })}
                          </Text>
                          {sellBadgeLabel && (
                            <Badge
                              size="sm"
                              color={homeSold ? "gray" : "blue"}
                              variant="light"
                            >
                              {sellBadgeLabel}
                            </Badge>
                          )}
                        </Group>
                        <Group gap="sm" wrap="wrap">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const breakdown = buildHomeCashflowBreakdown({
                                home,
                                baseMonth:
                                  baseMonth ??
                                  ((home.mode ?? "new_purchase") === "existing"
                                    ? home.existing?.asOfMonth
                                    : home.purchaseMonth) ??
                                  null,
                                horizonMonths,
                              });
                              setCashflowModal({
                                title: t("positionCashflowTitle", {
                                  label: homes("homeLabel", { index: index + 1 }),
                                }),
                                entries: breakdown.entries,
                                series: breakdown.series,
                              });
                            }}
                          >
                            {t("positionViewCashflow")}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const isExisting =
                                (home.mode ?? "new_purchase") === "existing" &&
                                Boolean(home.existing);
                              const startMonth = isExisting
                                ? home.existing?.asOfMonth ?? baseMonth ?? ""
                                : home.purchaseMonth ?? baseMonth ?? "";
                              const principal = isExisting
                                ? home.existing?.mortgageBalance ?? 0
                                : (home.purchasePrice ?? 0) - (home.downPayment ?? 0);
                              const annualRateDecimal = isExisting
                                ? (home.existing?.annualRatePct ?? 0) / 100
                                : (home.mortgageRatePct ?? 0) / 100;
                              const termMonths = isExisting
                                ? home.existing?.remainingTermMonths ?? 0
                                : Math.round((home.mortgageTermYears ?? 0) * 12);
                              const amortizationRows = startMonth
                                ? buildAmortizationSchedule({
                                    principal,
                                    annualRateDecimal,
                                    termMonths,
                                    startMonth,
                                  })
                                : [];
                              const valueRows = startMonth
                                ? buildValueSchedule({
                                    baseValue: isExisting
                                      ? home.existing?.marketValue ?? 0
                                      : home.purchasePrice ?? 0,
                                    annualAppreciationDecimal:
                                      (home.annualAppreciationPct ?? 0) / 100,
                                    startMonth,
                                    months: horizonMonths,
                                  })
                                : [];
                              setCalculatorModal({
                                title: t("positionCalculatorTitle", {
                                  label: homes("homeLabel", { index: index + 1 }),
                                }),
                                amortizationRows,
                                valueRows,
                              });
                            }}
                          >
                            {t("positionViewCalculations")}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => setEditingHomeId(home.id)}
                          >
                            {common("actionEdit")}
                          </Button>
                        </Group>
                      </Group>
                      <Text size="sm">
                        {formatHomeSummary(homes, home, baseCurrency, locale)}
                      </Text>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {homes("currentMarketValue")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatValue(getAssetValue(`home:${home.id}`))}
                          </Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {homes("mortgageBalance")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatValue(
                              getLiabilityValue(`home:${home.id}:mortgage`)
                            )}
                          </Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {(home.mode ?? "new_purchase") === "existing"
                              ? homes("existingAsOfMonth")
                              : homes("purchaseMonth")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {(home.mode ?? "new_purchase") === "existing"
                              ? home.existing?.asOfMonth ?? common("notAvailable")
                              : home.purchaseMonth ?? common("notAvailable")}
                          </Text>
                        </Stack>
                      </SimpleGrid>
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Text size="xs" c="dimmed">
                          {t("positionIncludedInProjection")}
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() =>
                              openCopyModal(
                                t("copyPositionTitle", {
                                  label: homes("homeLabel", { index: index + 1 }),
                                }),
                                (scenarioIds) =>
                                  onCopyPositionToScenarios(
                                    "home",
                                    home.id,
                                    scenarioIds
                                  )
                              )
                            }
                          >
                            {t("copyToOtherScenarios")}
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() =>
                              setConfirmDelete({
                                type: "home",
                                id: home.id,
                                label: homes("homeLabel", { index: index + 1 }),
                              })
                            }
                          >
                            {homes("removeHome")}
                          </Button>
                        </Group>
                      </Group>
                    </Stack>
                  </Card>
                );
                })
              )}
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{cars("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => setCreatingCar(createCarPositionFromTemplate({ baseMonth }))}
                >
                  {cars("addCar")}
                </Button>
              </Group>
              {carPositions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {cars("empty")}
                </Text>
              ) : (
                carPositions.map((car, index) => {
                  const carSold = isPastSellMonth(car.sellMonth);
                  const sellBadgeLabel = car.sellMonth
                    ? carSold
                      ? t("positionSold")
                      : t("positionSellIn", { month: car.sellMonth })
                    : null;

                  return (
                    <Card key={car.id} withBorder shadow="sm" radius="md" padding="md">
                    <Stack gap="sm">
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Group gap="xs" align="center">
                          <Text>🚗</Text>
                          <Text fw={600}>
                            {cars("carLabel", { index: index + 1 })}
                          </Text>
                          {sellBadgeLabel && (
                            <Badge
                              size="sm"
                              color={carSold ? "gray" : "blue"}
                              variant="light"
                            >
                              {sellBadgeLabel}
                            </Badge>
                          )}
                          {doubleCountLookup.has(`car:${car.id}`) && (
                            <Badge color="yellow" variant="light">
                              {t("positionOverlapWarning")}
                            </Badge>
                          )}
                        </Group>
                        <Group gap="sm" wrap="wrap">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const breakdown = buildCarCashflowBreakdown({
                                car,
                                baseMonth: baseMonth ?? car.purchaseMonth ?? null,
                                horizonMonths,
                              });
                              setCashflowModal({
                                title: t("positionCashflowTitle", {
                                  label: cars("carLabel", { index: index + 1 }),
                                }),
                                entries: breakdown.entries,
                                series: breakdown.series,
                              });
                            }}
                          >
                            {t("positionViewCashflow")}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const startMonth = car.purchaseMonth ?? baseMonth ?? "";
                              const amortizationRows =
                                car.loan && startMonth
                                  ? buildAmortizationSchedule({
                                      principal: car.loan.principal,
                                      annualRateDecimal:
                                        (car.loan.annualInterestRatePct ?? 0) / 100,
                                      termMonths: Math.round(
                                        (car.loan.termYears ?? 0) * 12
                                      ),
                                      startMonth,
                                    })
                                  : [];
                              setCalculatorModal({
                                title: t("positionCalculatorTitle", {
                                  label: cars("carLabel", { index: index + 1 }),
                                }),
                                amortizationRows,
                              });
                            }}
                          >
                            {t("positionViewCalculations")}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => setEditingCarId(car.id)}
                          >
                            {common("actionEdit")}
                          </Button>
                        </Group>
                      </Group>
                      <Text size="sm">
                        {formatCarSummary(cars, car, baseCurrency, locale)}
                      </Text>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {cars("marketValue")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatValue(getAssetValue(`car:${car.id}`))}
                          </Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {cars("loanBalance")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatValue(getLiabilityValue(`car:${car.id}:loan`))}
                          </Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {cars("purchaseMonth")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {car.purchaseMonth ?? common("notAvailable")}
                          </Text>
                        </Stack>
                      </SimpleGrid>
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Text size="xs" c="dimmed">
                          {t("positionIncludedInProjection")}
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() =>
                              openCopyModal(
                                t("copyPositionTitle", {
                                  label: cars("carLabel", { index: index + 1 }),
                                }),
                                (scenarioIds) =>
                                  onCopyPositionToScenarios(
                                    "car",
                                    car.id,
                                    scenarioIds
                                  )
                              )
                            }
                          >
                            {t("copyToOtherScenarios")}
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() =>
                              setConfirmDelete({
                                type: "car",
                                id: car.id,
                                label: cars("carLabel", { index: index + 1 }),
                              })
                            }
                          >
                            {cars("removeCar")}
                          </Button>
                        </Group>
                      </Group>
                    </Stack>
                  </Card>
                );
                })
              )}
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{investments("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    onInvestmentPositionAdd(
                      createInvestmentPositionFromTemplate({ baseMonth })
                    )
                  }
                >
                  {investments("addInvestment")}
                </Button>
              </Group>
              {investmentPositions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {investments("empty")}
                </Text>
              ) : (
                investmentPositions.map((investment, index) => (
                  <Card
                    key={investment.id}
                    withBorder
                    shadow="sm"
                    radius="md"
                    padding="md"
                  >
                    <Stack gap="sm">
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Group gap="xs" align="center">
                          <Text>📈</Text>
                          <Text fw={600}>
                            {investments("investmentLabel", { index: index + 1 })}
                          </Text>
                          {doubleCountLookup.has(`investment:${investment.id}`) && (
                            <Badge color="yellow" variant="light">
                              {t("positionOverlapWarning")}
                            </Badge>
                          )}
                        </Group>
                        <Group gap="sm" wrap="wrap">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const breakdown = buildInvestmentCashflowBreakdown({
                                investment,
                                baseMonth: baseMonth ?? investment.startMonth ?? null,
                                horizonMonths,
                              });
                              setCashflowModal({
                                title: t("positionCashflowTitle", {
                                  label: investments("investmentLabel", {
                                    index: index + 1,
                                  }),
                                }),
                                entries: breakdown.entries,
                                series: breakdown.series,
                              });
                            }}
                          >
                            {t("positionViewCashflow")}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const startMonth = investment.startMonth ?? baseMonth ?? "";
                              const contributionRows = startMonth
                                ? buildContributionSchedule({
                                    startMonth,
                                    monthlyContribution:
                                      investment.monthlyContribution ?? 0,
                                    months: horizonMonths,
                                  })
                                : [];
                              const assetValueRows = startMonth
                                ? buildInvestmentValueTable({
                                    investment,
                                    baseMonth: startMonth,
                                    horizonMonths,
                                  })
                                : [];
                              setCalculatorModal({
                                title: t("positionCalculatorTitle", {
                                  label: investments("investmentLabel", {
                                    index: index + 1,
                                  }),
                                }),
                                contributionRows,
                                assetValueRows,
                              });
                            }}
                          >
                            {t("positionViewCalculations")}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => setEditingInvestmentId(investment.id)}
                          >
                            {common("actionEdit")}
                          </Button>
                        </Group>
                      </Group>
                      <Text size="sm">
                        {formatInvestmentSummary(
                          investments,
                          investment,
                          baseCurrency,
                          locale
                        )}
                      </Text>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {investments("currentValue")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatValue(getAssetValue(`investment:${investment.id}`))}
                          </Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {investments("monthlyContribution")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatValue(investment.monthlyContribution ?? 0)}
                          </Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {investments("startMonth")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {investment.startMonth ?? common("notAvailable")}
                          </Text>
                        </Stack>
                      </SimpleGrid>
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Text size="xs" c="dimmed">
                          {t("positionIncludedInProjection")}
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() =>
                              openCopyModal(
                                t("copyPositionTitle", {
                                  label: investments("investmentLabel", {
                                    index: index + 1,
                                  }),
                                }),
                                (scenarioIds) =>
                                  onCopyPositionToScenarios(
                                    "investment",
                                    investment.id,
                                    scenarioIds
                                  )
                              )
                            }
                          >
                            {t("copyToOtherScenarios")}
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() =>
                              setConfirmDelete({
                                type: "investment",
                                id: investment.id,
                                label: investments("investmentLabel", { index: index + 1 }),
                              })
                            }
                          >
                            {investments("removeInvestment")}
                          </Button>
                        </Group>
                      </Group>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{insurances("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() =>
                    onInsurancePositionAdd(
                      createInsurancePositionFromTemplate({ baseMonth })
                    )
                  }
                >
                  {insurances("addInsurance")}
                </Button>
              </Group>
              {insurancePositions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {insurances("empty")}
                </Text>
              ) : (
                insurancePositions.map((insurance, index) => (
                  <Card
                    key={insurance.id}
                    withBorder
                    shadow="sm"
                    radius="md"
                    padding="md"
                  >
                    <Stack gap="sm">
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Group gap="xs" align="center">
                          <Text>🛡️</Text>
                          <Text fw={600}>
                            {insurance.name?.trim()
                              ? insurance.name
                              : insurances("insuranceLabel", { index: index + 1 })}
                          </Text>
                        </Group>
                        <Group gap="sm" wrap="wrap">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const breakdown = buildInsuranceCashflowBreakdown({
                                insurance,
                                baseMonth: baseMonth ?? insurance.startMonth ?? null,
                                horizonMonths,
                              });
                              setCashflowModal({
                                title: t("positionCashflowTitle", {
                                  label:
                                    insurance.name?.trim() ||
                                    insurances("insuranceLabel", { index: index + 1 }),
                                }),
                                entries: breakdown.entries,
                                series: breakdown.series,
                              });
                            }}
                          >
                            {t("positionViewCashflow")}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const startMonth = insurance.startMonth ?? baseMonth ?? "";
                              const assetValueRows =
                                insurance.kind === "savings" && startMonth
                                  ? buildInsuranceValueTable({
                                      insurance,
                                      baseMonth: startMonth,
                                      horizonMonths,
                                    })
                                  : [];
                              setCalculatorModal({
                                title: t("positionCalculatorTitle", {
                                  label:
                                    insurance.name?.trim() ||
                                    insurances("insuranceLabel", { index: index + 1 }),
                                }),
                                assetValueRows,
                              });
                            }}
                          >
                            {t("positionViewCalculations")}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => setEditingInsuranceId(insurance.id)}
                          >
                            {common("actionEdit")}
                          </Button>
                        </Group>
                      </Group>
                      <Text size="sm">
                        {formatInsuranceSummary(
                          insurances,
                          insurance,
                          baseCurrency,
                          locale
                        )}
                      </Text>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {insurances("currentValue")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatValue(getAssetValue(`insurance:${insurance.id}`))}
                          </Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {insurances("premiumMonthly")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatValue(insurance.premiumMonthly ?? 0)}
                          </Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {insurances("startMonth")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {insurance.startMonth ?? common("notAvailable")}
                          </Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {insurances("endMonth")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {insurance.endMonth ?? common("notAvailable")}
                          </Text>
                        </Stack>
                      </SimpleGrid>
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Text size="xs" c="dimmed">
                          {t("positionIncludedInProjection")}
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() =>
                              openCopyModal(
                                t("copyPositionTitle", {
                                  label:
                                    insurance.name?.trim() ||
                                    insurances("insuranceLabel", { index: index + 1 }),
                                }),
                                (scenarioIds) =>
                                  onCopyPositionToScenarios(
                                    "insurance",
                                    insurance.id,
                                    scenarioIds
                                  )
                              )
                            }
                          >
                            {t("copyToOtherScenarios")}
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() =>
                              setConfirmDelete({
                                type: "insurance",
                                id: insurance.id,
                                label:
                                  insurance.name?.trim() ||
                                  insurances("insuranceLabel", { index: index + 1 }),
                              })
                            }
                          >
                            {insurances("removeInsurance")}
                          </Button>
                        </Group>
                      </Group>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text fw={600}>{loans("title")}</Text>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => onLoanPositionAdd(createLoanPositionFromTemplate({ baseMonth }))}
                >
                  {loans("addLoan")}
                </Button>
              </Group>
              {loanPositions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {loans("empty")}
                </Text>
              ) : (
                loanPositions.map((loan, index) => (
                  <Card
                    key={loan.id}
                    withBorder
                    shadow="sm"
                    radius="md"
                    padding="md"
                  >
                    <Stack gap="sm">
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Group gap="xs" align="center">
                          <Text>💳</Text>
                          <Text fw={600}>{loans("loanLabel", { index: index + 1 })}</Text>
                          {doubleCountLookup.has(`loan:${loan.id}`) && (
                            <Badge color="yellow" variant="light">
                              {t("positionOverlapWarning")}
                            </Badge>
                          )}
                        </Group>
                        <Group gap="sm" wrap="wrap">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const breakdown = buildLoanCashflowBreakdown({
                                loan,
                                baseMonth: baseMonth ?? loan.startMonth ?? null,
                                horizonMonths,
                              });
                              setCashflowModal({
                                title: t("positionCashflowTitle", {
                                  label: loans("loanLabel", { index: index + 1 }),
                                }),
                                entries: breakdown.entries,
                                series: breakdown.series,
                              });
                            }}
                          >
                            {t("positionViewCashflow")}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => {
                              const startMonth = loan.startMonth ?? baseMonth ?? "";
                              const amortizationRows = startMonth
                                ? buildAmortizationSchedule({
                                    principal: loan.principal,
                                    annualRateDecimal:
                                      (loan.annualInterestRatePct ?? 0) / 100,
                                    termMonths: Math.round((loan.termYears ?? 0) * 12),
                                    startMonth,
                                  })
                                : [];
                              setCalculatorModal({
                                title: t("positionCalculatorTitle", {
                                  label: loans("loanLabel", { index: index + 1 }),
                                }),
                                amortizationRows,
                              });
                            }}
                          >
                            {t("positionViewCalculations")}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => setEditingLoanId(loan.id)}
                          >
                            {common("actionEdit")}
                          </Button>
                        </Group>
                      </Group>
                      <Text size="sm">
                        {formatLoanSummary(loans, loan, baseCurrency, locale)}
                      </Text>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {loans("principal")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatValue(getLiabilityValue(`loan:${loan.id}`))}
                          </Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {loans("monthlyPayment")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatValue(
                              loan.monthlyPayment ??
                                computeMonthlyPayment(
                                  loan.principal,
                                  (loan.annualInterestRatePct ?? 0) / 100,
                                  Math.round((loan.termYears ?? 0) * 12)
                                )
                            )}
                          </Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {loans("startMonth")}
                          </Text>
                          <Text size="sm" fw={600}>
                            {loan.startMonth ?? common("notAvailable")}
                          </Text>
                        </Stack>
                      </SimpleGrid>
                      <Group justify="space-between" align="center" wrap="wrap">
                        <Text size="xs" c="dimmed">
                          {t("positionIncludedInProjection")}
                        </Text>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() =>
                              openCopyModal(
                                t("copyPositionTitle", {
                                  label: loans("loanLabel", { index: index + 1 }),
                                }),
                                (scenarioIds) =>
                                  onCopyPositionToScenarios(
                                    "loan",
                                    loan.id,
                                    scenarioIds
                                  )
                              )
                            }
                          >
                            {t("copyToOtherScenarios")}
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="light"
                            onClick={() =>
                              setConfirmDelete({
                                type: "loan",
                                id: loan.id,
                                label: loans("loanLabel", { index: index + 1 }),
                              })
                            }
                          >
                            {loans("removeLoan")}
                          </Button>
                        </Group>
                      </Group>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="allocation" pt="md">
          <Stack gap="md">
            {assetIndicators.some((item) => item.visible) && (
              <Group gap="xs">
                {assetIndicators
                  .filter((item) => item.visible)
                  .map((item) => (
                    <Tooltip key={item.key} label={item.label} withArrow>
                      <Badge variant="light" size="lg">
                        <span style={{ marginRight: 6 }}>{item.icon}</span>
                        {item.label}
                      </Badge>
                    </Tooltip>
                  ))}
              </Group>
            )}
            {hasSmartInvestConfig ? (
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={600}>{t("smartInvestTitle")}</Text>
                </Group>
                <Card withBorder padding="md" radius="md">
                  <Stack gap="sm">
                    <div>
                      <Text fw={600}>{t("smartInvestTitle")}</Text>
                      <Text size="sm" c="dimmed">
                        {t("smartInvestSubtitle")}
                      </Text>
                      <PositionDetailList items={smartInvestSummaryItems} />
                      {!smartInvestPolicy.enabled && (
                        <Text size="xs" c="dimmed">
                          {t("smartInvestDisabledHint")}
                        </Text>
                      )}
                    </div>
                    <Group gap="sm">
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => {
                          if (!smartInvestBreakdown) {
                            return;
                          }
                          setCashflowModal({
                            title: t("positionCashflowTitle", {
                              label: t("smartInvestTitle"),
                            }),
                            entries: smartInvestBreakdown.cashflowEntries,
                            series: smartInvestBreakdown.cashflowSeries,
                          });
                        }}
                        disabled={!smartInvestBreakdown}
                      >
                        {t("positionViewCashflow")}
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => {
                          if (!smartInvestBreakdown) {
                            return;
                          }
                          setCalculatorModal({
                            title: t("positionCalculatorTitle", {
                              label: t("smartInvestTitle"),
                            }),
                            assetValueRows: smartInvestBreakdown.valueRows,
                            bucketValueSeries: smartInvestBreakdown.bucketSeries,
                            bucketCurrentRows: smartInvestBreakdown.currentBucketValues,
                          });
                        }}
                        disabled={!smartInvestBreakdown}
                      >
                        {t("smartInvestViewValue")}
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() =>
                          openCopyModal(
                            t("copyPositionTitle", { label: t("smartInvestTitle") }),
                            (scenarioIds) =>
                              onCopySmartInvestToScenarios(scenarioIds)
                          )
                        }
                      >
                        {t("copyToOtherScenarios")}
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => setSmartInvestDrawerOpen(true)}
                      >
                        {common("actionEdit")}
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              </Stack>
            ) : (
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={600}>{t("smartInvestTitle")}</Text>
                </Group>
                <Card withBorder padding="md" radius="md">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text size="sm" c="dimmed">
                      {t("smartInvestNotConfigured")}
                    </Text>
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => setSmartInvestDrawerOpen(true)}
                    >
                      {common("actionEdit")}
                    </Button>
                  </Group>
                </Card>
              </Stack>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            {milestoneRows.length === 0 ? (
              <Text c="dimmed" size="sm">
                {t("overviewEmpty")}
              </Text>
            ) : (
              <Stack gap="md">
                <Card withBorder radius="md">
                  <Stack gap="sm">
                    <Text fw={600}>{t("overviewTitle")}</Text>
                    {milestoneRows.map((row) => (
                      <Group key={row.label} justify="space-between">
                        <Text>{row.label}</Text>
                        <Text c="dimmed">{row.months.join(", ")}</Text>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              </Stack>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {activeTab === "events" && (
        <Button
          style={floatingButtonStyle}
          onClick={() => {
            setActiveTab("events");
            setAddEventOpen(true);
          }}
        >
          {t("addEvent")}
        </Button>
      )}

      <TimelineEventDrawer
        mode="create"
        opened={addEventOpen}
        onClose={() => setAddEventOpen(false)}
        baseCurrency={baseCurrency}
        baseMonth={baseMonth}
        assumptions={assumptions}
        members={members}
        scenarioOptions={scenarios.map((scenario) => ({
          value: scenario.id,
          label: scenario.name,
        }))}
        defaultScenarioId={scenarioId}
        defaultMonth={selectedMonth ?? baseMonth ?? null}
        parentGroupOptions={parentGroupOptions}
        onAddDefinition={(definition, scenarioIds) => onAddDefinition(definition, scenarioIds)}
        onAddHomePosition={() => {
          setCreatingHome(createHomePositionFromTemplate({ baseMonth }));
          setHomeToastOpen(true);
        }}
        onCreateComplete={handleCreateComplete}
      />

      <MergeDuplicatesModal
        opened={mergeOpen}
        onClose={() => setMergeOpen(false)}
        scenarios={scenarios}
        eventLibrary={eventLibrary}
        onMerge={onMergeDuplicates}
      />

      <TimelineEventDrawer
        mode="edit"
        opened={Boolean(editingEvent)}
        onClose={() => setEditingEvent(null)}
        baseCurrency={baseCurrency}
        baseMonth={baseMonth}
        assumptions={assumptions}
        members={members}
        parentGroupOptions={parentGroupOptions}
        editingEvent={editingEvent}
        onUpdateDefinition={onUpdateDefinition}
        onUpdateEventRef={onUpdateEventRef}
      />

      <Modal
        opened={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={common("actionDelete")}
        centered
      >
        <Stack gap="md">
          <Text>
            {common("confirmDelete", { name: confirmDelete?.label ?? "" })}
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setConfirmDelete(null)}>
              {common("actionCancel")}
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (!confirmDelete) {
                  return;
                }
                if (confirmDelete.type === "event") {
                  onRemoveEventRef(confirmDelete.id);
                } else if (confirmDelete.type === "home") {
                  onHomePositionRemove(confirmDelete.id);
                } else if (confirmDelete.type === "car") {
                  onCarPositionRemove(confirmDelete.id);
                } else if (confirmDelete.type === "investment") {
                  onInvestmentPositionRemove(confirmDelete.id);
                } else if (confirmDelete.type === "insurance") {
                  onInsurancePositionRemove(confirmDelete.id);
                } else if (confirmDelete.type === "loan") {
                  onLoanPositionRemove(confirmDelete.id);
                }
                setConfirmDelete(null);
              }}
            >
              {common("actionDelete")}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <PositionCashflowModal
        opened={Boolean(cashflowModal)}
        onClose={() => setCashflowModal(null)}
        title={cashflowModal?.title ?? ""}
        currency={baseCurrency}
        entries={cashflowModal?.entries ?? []}
        series={cashflowModal?.series ?? []}
      />

      <PositionCalculatorModal
        opened={Boolean(calculatorModal)}
        onClose={() => setCalculatorModal(null)}
        title={calculatorModal?.title ?? ""}
        currency={baseCurrency}
        amortizationRows={calculatorModal?.amortizationRows}
        valueRows={calculatorModal?.valueRows}
        contributionRows={calculatorModal?.contributionRows}
        assetValueRows={calculatorModal?.assetValueRows}
        bucketValueSeries={calculatorModal?.bucketValueSeries}
        bucketCurrentRows={calculatorModal?.bucketCurrentRows}
      />

      <CopyToScenariosModal
        opened={Boolean(copyModal)}
        onClose={() => setCopyModal(null)}
        scenarios={scenarios}
        currentScenarioId={scenarioId}
        title={copyModal?.title ?? ""}
        onConfirm={(scenarioIds) => {
          copyModal?.onConfirm(scenarioIds);
        }}
      />

      <Modal
        opened={Boolean(homeDrawerDraft)}
        onClose={() => {
          setEditingHomeId(null);
          setCreatingHome(null);
        }}
        title={homes("title")}
        fullScreen
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
                onHomePositionUpdate(updated);
              } else {
                onHomePositionAdd(updated);
                setHomeToastOpen(true);
              }
              setEditingHomeId(null);
              setCreatingHome(null);
            }}
          />
        )}
      </Modal>

      <Modal
        opened={Boolean(carDrawerDraft)}
        onClose={() => {
          setEditingCarId(null);
          setCreatingCar(null);
        }}
        title={cars("title")}
        fullScreen
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
                onCarPositionUpdate(updated);
              } else {
                onCarPositionAdd(updated);
              }
              setEditingCarId(null);
              setCreatingCar(null);
            }}
          />
        )}
      </Modal>

      <Modal
        opened={smartInvestDrawerOpen}
        onClose={() => setSmartInvestDrawerOpen(false)}
        title={t("smartInvestTitle")}
        fullScreen
      >
        <SmartInvestForm
          policy={smartInvestPolicy}
          onChange={(nextPolicy) => onUpdateSmartInvest(nextPolicy)}
        />
      </Modal>

      <Modal
        opened={Boolean(editingInvestment)}
        onClose={() => setEditingInvestmentId(null)}
        title={investments("title")}
        fullScreen
      >
        {editingInvestment && (
          <InvestmentDetailsForm
            investment={editingInvestment}
            onCancel={() => setEditingInvestmentId(null)}
            onSave={(updated) => {
              onInvestmentPositionUpdate(updated);
              setEditingInvestmentId(null);
            }}
          />
        )}
      </Modal>

      <Modal
        opened={Boolean(editingInsurance)}
        onClose={() => setEditingInsuranceId(null)}
        title={insurances("title")}
        fullScreen
      >
        {editingInsurance && (
          <InsuranceDetailsForm
            insurance={editingInsurance}
            onCancel={() => setEditingInsuranceId(null)}
            onSave={(updated) => {
              onInsurancePositionUpdate(updated);
              setEditingInsuranceId(null);
            }}
          />
        )}
      </Modal>

      <Modal
        opened={Boolean(editingLoan)}
        onClose={() => setEditingLoanId(null)}
        title={loans("title")}
        fullScreen
      >
        {editingLoan && (
          <LoanDetailsForm
            loan={editingLoan}
            onCancel={() => setEditingLoanId(null)}
            onSave={(updated) => {
              onLoanPositionUpdate(updated);
              setEditingLoanId(null);
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}
