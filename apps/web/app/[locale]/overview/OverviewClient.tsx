"use client";

import {
  Accordion,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Menu,
  MultiSelect,
  Notification,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type Locale } from "../../../src/i18n/routing";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import FullScreenChartModal, {
  type FullScreenChartType,
} from "../../../components/FullScreenChartModal";
import MonthField from "../../../components/MonthField";
import MonthlyBreakdownModalHost from "../../../components/MonthlyBreakdownModalHost";
import RunwayDetailModal from "../../../components/metrics/RunwayDetailModal";
import RiskDetailModal from "../../../components/metrics/RiskDetailModal";
import CashBalanceChart from "../../../features/overview/components/CashBalanceChart";
import KpiCard from "../../../features/overview/components/KpiCard";
import KpiCarousel from "../../../features/overview/components/KpiCarousel";
import NetCashflowChart from "../../../features/overview/components/NetCashflowChart";
import NetWorthChart from "../../../features/overview/components/NetWorthChart";
import ScenarioContextSelector from "../../../features/overview/components/ScenarioContextSelector";
import AutoSnapshotsCard from "../../../features/overview/components/AutoSnapshotsCard";
import type { TimeSeriesPoint, MilestoneMarker } from "../../../features/overview/types";
import { formatCurrency } from "../../../lib/i18n";
import { memberCasesPath, scenarioPeoplePath } from "../../../lib/routes/canonicalRoutes";
import { scenarioDashboardPath, scenarioMoneyPath, scenarioPlanLabPath } from "../../../lib/routes/appRoutes";
import {
  projectionToOverviewViewModel,
} from "../../../src/engine/adapter";
import { useProjectionWithLedger } from "../../../src/engine/useProjectionWithLedger";
import { useScenarioProjections } from "../../../src/engine/useScenarioProjections";
import { buildScenarioEventViews } from "../../../src/domain/events/utils";
import {
  buildRunwayNetCashflowSeries,
  computeRunwaySimulation,
} from "../../../src/domain/metrics/runway";
import { computeRiskAssessment } from "../../../src/domain/metrics/risk";
import {
  buildExportFilename,
  downloadTextFile,
  projectionToCSV,
} from "../../../src/export/projectionExport";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { Link } from "../../../src/i18n/navigation";
import { safeT } from "../../../src/i18n/safeT";
import { getMemberAgeYears } from "../../../src/domain/members/age";
import { appliesToScenario } from "../../../src/domain/applyScope";
import { useUiStore } from "../../../src/store/uiStore";
import { isInvestmentCashflow } from "../../../src/domain/ledger/cashflowFilters";
import { computeDashboardMetrics } from "../../../src/domain/dashboard/metrics";
import { getNextKeyEvent } from "../../../src/domain/dashboard/nextKeyEvent";
import { buildOverviewTimelineMarkers } from "../../../src/domain/timeline/buildOverviewTimelineMarkers";
import type { MilestoneEvent, MilestoneEventTemplateType } from "../../../src/domain/milestoneEvents/types";
import { normalizeMonthStrict } from "../../../src/utils/month";

type OverviewClientProps = {
  scenarioId?: string;
};

type MilestoneMarkerDraft = {
  id?: string;
  label: string;
  effectiveMonth: string;
  memberId: string;
  templateType: MilestoneEventTemplateType;
};

type MilestoneTemplateFilter = "all" | MilestoneEventTemplateType;
type MilestoneSource = "manual" | "system";
type MilestoneSourceFilter = "all" | MilestoneSource;
type MilestoneStatus = "upcoming" | "expired" | "completed";
type MilestoneStatusFilter = "all" | MilestoneStatus;

type MilestoneToastState = {
  color: "teal" | "red" | "orange";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type ManagedMilestoneItem = {
  id: string;
  label: string;
  month: string;
  memberId: string;
  memberName: string;
  templateType: MilestoneEventTemplateType;
  source: MilestoneSource;
  status: MilestoneStatus;
  diffMonths: number | null;
  isSystemDerived: boolean;
};

type PendingDeletedMilestone = {
  scenarioId: string;
  id: string;
  templateType: MilestoneEventTemplateType;
  memberId?: string;
  effectiveMonth: string;
  notes?: string;
};

const createMilestoneDraft = (
  baseMonth: string,
  memberId: string
): MilestoneMarkerDraft => ({
  label: "",
  effectiveMonth: baseMonth,
  memberId,
  templateType: "custom",
});

const MILESTONE_MANAGER_QUERY_VALUE = "manage";
const SYSTEM_MILESTONE_ID_PREFIX = "legacy-member-milestone:";

const isSystemMilestoneEvent = (event: Pick<MilestoneEvent, "id" | "templateType">) =>
  event.id.startsWith(SYSTEM_MILESTONE_ID_PREFIX) ||
  event.templateType === "member_retirement";

const monthToIndex = (month: string): number | null => {
  const normalized = normalizeMonthStrict(month);
  if (!normalized.ok) {
    return null;
  }
  const [year, monthNum] = normalized.month.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(monthNum)) {
    return null;
  }
  return year * 12 + (monthNum - 1);
};

const getMonthDiff = (targetMonth: string, baseMonth: string): number | null => {
  const targetIndex = monthToIndex(targetMonth);
  const baseIndex = monthToIndex(baseMonth);
  if (targetIndex === null || baseIndex === null) {
    return null;
  }
  return targetIndex - baseIndex;
};

const resolveMilestoneStatus = (
  targetMonth: string,
  baseMonth: string
): MilestoneStatus => {
  const diff = getMonthDiff(targetMonth, baseMonth);
  if (diff === null || diff >= 0) {
    return "upcoming";
  }
  if (diff >= -6) {
    return "expired";
  }
  return "completed";
};

const normalizeDraftForCompare = (draft: MilestoneMarkerDraft) => ({
  id: draft.id ?? "",
  label: draft.label.trim(),
  effectiveMonth: draft.effectiveMonth.trim(),
  memberId: draft.memberId,
  templateType: draft.templateType ?? "custom",
});

export default function OverviewClient({ scenarioId }: OverviewClientProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const locale = useLocale();
  const params = useParams<{ caseId?: string }>();
  const caseId = params.caseId ?? "";
  const t = useTranslations("overview");
  const tDashboard = useTranslations("overview.dashboard");
  const moneyT = useTranslations("money");
  const common = useTranslations("common");
  const exportT = useTranslations("export");
  const searchParams = useSearchParams();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const globalHorizonMonths = appSettings.globalHorizonMonths;
  const setViewModeSetting = useScenarioStore((state) => state.setViewMode);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const applyMilestoneEvent = useScenarioStore((state) => state.applyMilestoneEvent);
  const removeMilestoneEvent = useScenarioStore((state) => state.removeMilestoneEvent);
  const breakdownMonth = useUiStore((state) => state.breakdownMonth);
  const openBreakdown = useUiStore((state) => state.openBreakdown);
  const setBreakdownMonth = useUiStore((state) => state.setBreakdownMonth);
  const scenarioIdFromQuery = scenarioId ?? null;
  const compareScenarioIdsFromQuery = useMemo(() => {
    const param = searchParams.get("compareScenarioIds");
    if (!param) {
      return [];
    }
    return param
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }, [searchParams]);
  const milestoneManagerQuery = searchParams.get("milestones");
  const hasCompareQuery = compareScenarioIdsFromQuery.length > 0;
  const [viewMode, setViewMode] = useState<"single" | "compare">("single");
  const [compareScenarioIds, setCompareScenarioIds] = useState<string[]>([]);
  const [runwayDetailOpen, setRunwayDetailOpen] = useState(false);
  const [riskDetailOpen, setRiskDetailOpen] = useState(false);
  const [cashflowView, setCashflowView] = useState<"all" | "operational">("all");
  const [primaryChartTab, setPrimaryChartTab] = useState<"cash" | "netWorth" | "netCashflow">("cash");
  const [fullscreenChart, setFullscreenChart] = useState<{
    type: FullScreenChartType;
    data: TimeSeriesPoint[];
    markers: MilestoneMarker[],
  } | null>(null);
  const [milestoneDrawerOpened, setMilestoneDrawerOpened] = useState(false);
  const [milestoneDraft, setMilestoneDraft] = useState<MilestoneMarkerDraft>(() =>
    createMilestoneDraft("", "")
  );
  const [milestoneDraftBaseline, setMilestoneDraftBaseline] = useState<MilestoneMarkerDraft>(() =>
    createMilestoneDraft("", "")
  );
  const [milestoneSearchQuery, setMilestoneSearchQuery] = useState("");
  const [milestoneMemberFilter, setMilestoneMemberFilter] = useState("all");
  const [milestoneTemplateFilter, setMilestoneTemplateFilter] = useState<MilestoneTemplateFilter>("all");
  const [milestoneSourceFilter, setMilestoneSourceFilter] = useState<MilestoneSourceFilter>("all");
  const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<MilestoneStatusFilter>("all");
  const [milestoneMonthFrom, setMilestoneMonthFrom] = useState("");
  const [milestoneMonthTo, setMilestoneMonthTo] = useState("");
  const [milestoneToast, setMilestoneToast] = useState<MilestoneToastState | null>(null);
  const [pendingDeletedMilestone, setPendingDeletedMilestone] = useState<PendingDeletedMilestone | null>(null);
  const [milestoneQueryConsumed, setMilestoneQueryConsumed] = useState(false);
  const milestoneToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const milestoneUndoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (
      scenarioIdFromQuery &&
      scenarioIdFromQuery !== activeScenarioId &&
      scenarios.some((scenario) => scenario.id === scenarioIdFromQuery)
    ) {
      setActiveScenario(scenarioIdFromQuery);
    }
  }, [activeScenarioId, scenarioIdFromQuery, scenarios, setActiveScenario]);

  const resolvedScenarioId = useMemo(
    () => resolveScenarioIdFromQuery(scenarioIdFromQuery, activeScenarioId, scenarios),
    [activeScenarioId, scenarioIdFromQuery, scenarios]
  );

  const selectedScenario = getScenarioById(scenarios, resolvedScenarioId);
  const selectedScenarioId = selectedScenario?.id ?? "";
  const scenarioEventViews = useMemo(
    () => (selectedScenario ? buildScenarioEventViews(selectedScenario, eventLibrary) : []),
    [eventLibrary, selectedScenario]
  );
  const compareScenarioOptions = useMemo(
    () =>
      scenarios.map((scenarioOption) => ({
        value: scenarioOption.id,
        label: scenarioOption.name,
      })),
    [scenarios]
  );

  useEffect(() => {
    if (hasCompareQuery) {
      setViewMode("compare");
      setCompareScenarioIds(compareScenarioIdsFromQuery);
      return;
    }

    if (!selectedScenario || viewMode !== "compare") {
      return;
    }
    setCompareScenarioIds((current) => {
      if (current.length >= 2) {
        return current.slice(0, 5);
      }
      const fallback = scenarios
        .map((scenario) => scenario.id)
        .filter(Boolean)
        .slice(0, 2);
      return fallback.length > 0 ? fallback : current;
    });
  }, [compareScenarioIdsFromQuery, hasCompareQuery, scenarios, selectedScenario, viewMode]);
  const {
    projection,
    months,
    ledgerByMonth,
    summaryByMonth,
    positionCashflowsByMonth,
    projectionNetCashflowByMonth,
    projectionNetCashflowMode,
    netWorthBreakdownByMonth,
  } = useProjectionWithLedger(selectedScenario, eventLibrary, {
    members,
    budgetRules,
  });
  const compareProjections = useScenarioProjections(
    scenarios,
    eventLibrary,
    compareScenarioIds,
    { horizonMonths: globalHorizonMonths, members, budgetRules }
  );

  const overviewViewModel = useMemo(
    () => (projection ? projectionToOverviewViewModel(projection) : null),
    [projection]
  );

  const inflationPct = appSettings.annualInflationPct ?? 0;
  const displayMode = appSettings.viewMode;
  const deflator = useMemo(
    () => (index: number) => Math.pow(1 + inflationPct / 100, index / 12),
    [inflationPct]
  );
  const deflateSeries = useMemo(
    () => (series: TimeSeriesPoint[]) =>
      series.map((entry, index) => ({
        ...entry,
        value: entry.value / deflator(index),
      })),
    [deflator]
  );

  const cashSeries = useMemo(
    () => {
      const base = overviewViewModel?.cashSeries ?? [];
      return displayMode === "real" ? deflateSeries(base) : base;
    },
    [deflateSeries, displayMode, overviewViewModel]
  );
  const netWorthSeries = useMemo(
    () => {
      const base = overviewViewModel?.netWorthSeries ?? [];
      return displayMode === "real" ? deflateSeries(base) : base;
    },
    [deflateSeries, displayMode, overviewViewModel]
  );
  const netWorthByMonth = useMemo(
    () =>
      netWorthSeries.reduce<Record<string, number>>((acc, entry) => {
        acc[entry.month] = entry.value;
        return acc;
      }, {}),
    [netWorthSeries]
  );
  const scenarioMembers = useMemo(
    () =>
      selectedScenario
        ? members.filter((member) =>
            appliesToScenario(member.applyScope, selectedScenario.id)
          )
        : [],
    [members, selectedScenario]
  );
  const overviewTimelineMarkers = useMemo(
    () =>
      selectedScenario
        ? buildOverviewTimelineMarkers({
            scenarioId: selectedScenarioId,
            baseMonth: projection?.baseMonth ?? null,
            horizonMonths: globalHorizonMonths,
            members,
            milestoneEvents: selectedScenario.milestoneEvents,
            highlightedEvents: [],
          })
        : { markers: [], highlightedEvents: [] },
    [globalHorizonMonths, members, projection?.baseMonth, selectedScenario, selectedScenarioId]
  );
  const milestoneMarkers = overviewTimelineMarkers.markers;
  const monthIndexLookup = useMemo(
    () => new Map(months.map((month, index) => [month, index])),
    [months]
  );
  const memberLookup = useMemo(
    () =>
      Object.fromEntries(
        scenarioMembers.map((member) => [member.id, member.name])
      ),
    [scenarioMembers]
  );
  const netCashflowSeries = useMemo(() => {
    const base = months.map((month) => ({
      month,
      value: projectionNetCashflowByMonth?.[month] ?? 0,
    }));
    if (displayMode !== "real") {
      return base;
    }
    return base.map((entry, index) => ({
      ...entry,
      value: entry.value / deflator(index),
    }));
  }, [deflator, displayMode, months, projectionNetCashflowByMonth]);
  const operationalNetCashflowByMonth = useMemo(() => {
    const totals: Record<string, number> = {};
    months.forEach((month) => {
      totals[month] = 0;
    });
    Object.entries(ledgerByMonth).forEach(([month, items]) => {
      if (!(month in totals)) {
        totals[month] = 0;
      }
      items.forEach((item) => {
        if (!isInvestmentCashflow(item)) {
          totals[month] += item.amount;
        }
      });
    });
    return totals;
  }, [ledgerByMonth, months]);
  const operationalNetCashflowSeries = useMemo(() => {
    const base = months.map((month) => ({
      month,
      value: operationalNetCashflowByMonth[month] ?? 0,
    }));
    if (displayMode !== "real") {
      return base;
    }
    return base.map((entry, index) => ({
      ...entry,
      value: entry.value / deflator(index),
    }));
  }, [deflator, displayMode, months, operationalNetCashflowByMonth]);
  const displayedNetCashflowSeries =
    cashflowView === "operational" ? operationalNetCashflowSeries : netCashflowSeries;
  const snapshotTargets = useMemo(() => [0, 5, 10, 15, 20, 30], []);
  const autoSnapshots = useMemo(() => {
    if (!projection || !selectedScenario) {
      return [];
    }
    const baseMonth = projection.baseMonth;
    const formatAge = (value: number) =>
      Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);

    return snapshotTargets
      .map((years) => {
        if (years === 0) {
          const monthIndex = 0;
          const month = projection.months[monthIndex];
          if (!month) {
            return null;
          }
          const deflatorValue = displayMode === "real" ? deflator(monthIndex) : 1;
          const ageLabels = scenarioMembers.map((member) => {
            const ageYears = Math.max(0, getMemberAgeYears(member, month, baseMonth));
            return t("snapshotAgeLabel", {
              name: member.name,
              age: formatAge(ageYears),
            });
          });
          return {
            label: t("snapshotsNowLabel"),
            month,
            cash: (projection.cashBalance[monthIndex] ?? 0) / deflatorValue,
            assets: (projection.assets.total[monthIndex] ?? 0) / deflatorValue,
            liabilities: (projection.liabilities.total[monthIndex] ?? 0) / deflatorValue,
            netWorth: (projection.netWorth[monthIndex] ?? 0) / deflatorValue,
            ageLabels,
          };
        }
        const requiredMonths = years * 12;
        if (globalHorizonMonths < requiredMonths) {
          return null;
        }
        const monthIndex = Math.min(requiredMonths - 1, projection.months.length - 1);
        const month = projection.months[monthIndex];
        const deflatorValue = displayMode === "real" ? deflator(monthIndex) : 1;
        const ageLabels = scenarioMembers.map((member) => {
          const ageYears = Math.max(0, getMemberAgeYears(member, month, baseMonth));
          return t("snapshotAgeLabel", {
            name: member.name,
            age: formatAge(ageYears),
          });
        });
        return {
          label: t("snapshotsYearLabel", { years }),
          month,
          cash: (projection.cashBalance[monthIndex] ?? 0) / deflatorValue,
          assets: (projection.assets.total[monthIndex] ?? 0) / deflatorValue,
          liabilities: (projection.liabilities.total[monthIndex] ?? 0) / deflatorValue,
          netWorth: (projection.netWorth[monthIndex] ?? 0) / deflatorValue,
          ageLabels,
        };
      })
      .filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot));
  }, [
    deflator,
    displayMode,
    globalHorizonMonths,
    projection,
    scenarioMembers,
    selectedScenario,
    snapshotTargets,
    t,
  ]);
  const upcomingMilestones = useMemo(() => {
    if (milestoneMarkers.length === 0) {
      return [];
    }
    const baseMonth = projection?.baseMonth ?? months[0];
    const baseIndex = baseMonth
      ? monthIndexLookup.get(baseMonth) ?? 0
      : 0;
    return [...milestoneMarkers]
      .sort((a, b) => {
        const aIndex = monthIndexLookup.get(a.month) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = monthIndexLookup.get(b.month) ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      })
      .filter((marker) => {
        const markerIndex = monthIndexLookup.get(marker.month) ?? baseIndex;
        return markerIndex >= baseIndex;
      })
      .slice(0, 3);
  }, [milestoneMarkers, monthIndexLookup, months, projection?.baseMonth]);
  const markerMilestoneEvents = useMemo(
    () =>
      [...(selectedScenario?.milestoneEvents ?? [])]
        .filter((event) => event.mode === "marker")
        .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth)),
    [selectedScenario?.milestoneEvents]
  );
  const defaultMilestoneMonth = projection?.baseMonth ?? months[0] ?? "";
  const defaultMilestoneMemberId = scenarioMembers[0]?.id ?? "";

  const showMilestoneToast = (nextToast: MilestoneToastState) => {
    if (milestoneToastTimeoutRef.current) {
      clearTimeout(milestoneToastTimeoutRef.current);
    }
    setMilestoneToast(nextToast);
    milestoneToastTimeoutRef.current = setTimeout(() => {
      setMilestoneToast(null);
      milestoneToastTimeoutRef.current = null;
    }, 6000);
  };

  useEffect(
    () => () => {
      if (milestoneToastTimeoutRef.current) {
        clearTimeout(milestoneToastTimeoutRef.current);
      }
      if (milestoneUndoTimeoutRef.current) {
        clearTimeout(milestoneUndoTimeoutRef.current);
      }
    },
    []
  );

  const resolveMilestoneTemplateLabel = useCallback((templateType: MilestoneEventTemplateType) => {
    switch (templateType) {
      case "member_birth":
        return moneyT("milestoneManagerTemplateBirth");
      case "member_school_start":
        return moneyT("milestoneManagerTemplateSchoolStart");
      case "member_retirement":
        return moneyT("milestoneManagerTemplateRetirement");
      default:
        return moneyT("milestoneManagerTemplateCustom");
    }
  }, [moneyT]);

  const normalizedMilestoneFilterFrom = milestoneMonthFrom
    ? normalizeMonthStrict(milestoneMonthFrom)
    : null;
  const normalizedMilestoneFilterTo = milestoneMonthTo
    ? normalizeMonthStrict(milestoneMonthTo)
    : null;
  const milestoneMonthFromError =
    milestoneMonthFrom && !normalizedMilestoneFilterFrom?.ok
      ? moneyT("flowFormMonthRequired")
      : undefined;
  const milestoneMonthToError =
    milestoneMonthTo && !normalizedMilestoneFilterTo?.ok
      ? moneyT("flowFormMonthRequired")
      : undefined;
  const milestoneMonthRangeInvalid =
    normalizedMilestoneFilterFrom?.ok &&
    normalizedMilestoneFilterTo?.ok &&
    normalizedMilestoneFilterFrom.month > normalizedMilestoneFilterTo.month;

  const milestoneMarkerLookup = useMemo(
    () => new Map(milestoneMarkers.map((marker) => [marker.id, marker])),
    [milestoneMarkers]
  );

  const managedMilestoneItems = useMemo<ManagedMilestoneItem[]>(() => {
    const baseMonth = projection?.baseMonth ?? defaultMilestoneMonth;
    return markerMilestoneEvents.map((event) => {
      const templateType = event.templateType ?? "custom";
      const marker = milestoneMarkerLookup.get(event.id);
      const memberId = event.memberId ?? "";
      const memberName = memberId ? memberLookup[memberId] ?? "" : "";
      const source: MilestoneSource = isSystemMilestoneEvent(event) ? "system" : "manual";
      const status = resolveMilestoneStatus(event.effectiveMonth, baseMonth);
      const label =
        event.notes?.trim() ||
        marker?.label ||
        resolveMilestoneTemplateLabel(templateType);

      return {
        id: event.id,
        label,
        month: event.effectiveMonth,
        memberId,
        memberName,
        templateType,
        source,
        status,
        diffMonths: getMonthDiff(event.effectiveMonth, baseMonth),
        isSystemDerived: source === "system",
      };
    });
  }, [
    defaultMilestoneMonth,
    markerMilestoneEvents,
    memberLookup,
    milestoneMarkerLookup,
    projection?.baseMonth,
    resolveMilestoneTemplateLabel,
  ]);

  const filteredMilestoneItems = useMemo(() => {
    const keyword = milestoneSearchQuery.trim().toLowerCase();

    const list = managedMilestoneItems.filter((item) => {
      if (keyword) {
        const matched =
          item.label.toLowerCase().includes(keyword) ||
          item.memberName.toLowerCase().includes(keyword) ||
          item.month.includes(keyword);
        if (!matched) {
          return false;
        }
      }

      if (milestoneMemberFilter !== "all" && item.memberId !== milestoneMemberFilter) {
        return false;
      }

      if (milestoneTemplateFilter !== "all" && item.templateType !== milestoneTemplateFilter) {
        return false;
      }

      if (milestoneSourceFilter !== "all" && item.source !== milestoneSourceFilter) {
        return false;
      }

      if (milestoneStatusFilter !== "all" && item.status !== milestoneStatusFilter) {
        return false;
      }

      if (normalizedMilestoneFilterFrom?.ok && item.month < normalizedMilestoneFilterFrom.month) {
        return false;
      }

      if (normalizedMilestoneFilterTo?.ok && item.month > normalizedMilestoneFilterTo.month) {
        return false;
      }

      if (milestoneMonthRangeInvalid) {
        return false;
      }

      return true;
    });

    const groupWeight = (item: ManagedMilestoneItem) => {
      if (typeof item.diffMonths === "number" && item.diffMonths >= 0 && item.diffMonths <= 12) {
        return 0;
      }
      if (typeof item.diffMonths === "number" && item.diffMonths > 12) {
        return 1;
      }
      return 2;
    };

    return list.sort((a, b) => {
      const groupA = groupWeight(a);
      const groupB = groupWeight(b);
      if (groupA !== groupB) {
        return groupA - groupB;
      }

      if (typeof a.diffMonths === "number" && typeof b.diffMonths === "number") {
        if (groupA === 2) {
          return b.diffMonths - a.diffMonths;
        }
        return a.diffMonths - b.diffMonths;
      }

      const monthCompare = a.month.localeCompare(b.month);
      if (monthCompare !== 0) {
        return monthCompare;
      }
      return a.label.localeCompare(b.label);
    });
  }, [
    managedMilestoneItems,
    milestoneMemberFilter,
    milestoneMonthRangeInvalid,
    milestoneSearchQuery,
    milestoneSourceFilter,
    milestoneStatusFilter,
    milestoneTemplateFilter,
    normalizedMilestoneFilterFrom,
    normalizedMilestoneFilterTo,
  ]);

  const milestoneHasActiveFilters = Boolean(
    milestoneSearchQuery.trim() ||
      milestoneMemberFilter !== "all" ||
      milestoneTemplateFilter !== "all" ||
      milestoneSourceFilter !== "all" ||
      milestoneStatusFilter !== "all" ||
      milestoneMonthFrom ||
      milestoneMonthTo
  );

  const handleClearMilestoneFilters = () => {
    setMilestoneSearchQuery("");
    setMilestoneMemberFilter("all");
    setMilestoneTemplateFilter("all");
    setMilestoneSourceFilter("all");
    setMilestoneStatusFilter("all");
    setMilestoneMonthFrom("");
    setMilestoneMonthTo("");
    showMilestoneToast({
      color: "teal",
      message: moneyT("milestoneManagerFiltersClearedToast"),
    });
  };

  const handleOpenMilestoneCreate = () => {
    const nextDraft = createMilestoneDraft(defaultMilestoneMonth, defaultMilestoneMemberId);
    setMilestoneDraft(nextDraft);
    setMilestoneDraftBaseline(nextDraft);
    setMilestoneDrawerOpened(true);
  };

  const handleOpenMilestoneEdit = (eventId: string) => {
    const target = markerMilestoneEvents.find((event) => event.id === eventId);
    if (!target) {
      return;
    }

    if (isSystemMilestoneEvent(target)) {
      showMilestoneToast({
        color: "orange",
        message: moneyT("milestoneManagerSystemLocked"),
      });
      return;
    }

    const nextDraft = {
      id: target.id,
      label: target.notes ?? "",
      effectiveMonth: target.effectiveMonth,
      memberId: target.memberId ?? "",
      templateType: target.templateType ?? "custom",
    };

    setMilestoneDraft(nextDraft);
    setMilestoneDraftBaseline(nextDraft);
    setMilestoneDrawerOpened(true);
  };

  useEffect(() => {
    setMilestoneQueryConsumed(false);
  }, [milestoneManagerQuery, selectedScenarioId]);

  useEffect(() => {
    if (milestoneManagerQuery !== MILESTONE_MANAGER_QUERY_VALUE || milestoneQueryConsumed) {
      return;
    }
    const nextDraft = createMilestoneDraft(defaultMilestoneMonth, defaultMilestoneMemberId);
    setMilestoneDraft(nextDraft);
    setMilestoneDraftBaseline(nextDraft);
    setMilestoneDrawerOpened(true);
    setMilestoneQueryConsumed(true);
  }, [
    defaultMilestoneMemberId,
    defaultMilestoneMonth,
    milestoneManagerQuery,
    milestoneQueryConsumed,
    selectedScenarioId,
  ]);

  const normalizedMilestoneDraftMonth = normalizeMonthStrict(milestoneDraft.effectiveMonth);
  const milestoneMonthError =
    milestoneDraft.effectiveMonth && !normalizedMilestoneDraftMonth.ok
      ? moneyT("flowFormMonthRequired")
      : undefined;

  const selectedDraftMilestone = useMemo(
    () => markerMilestoneEvents.find((event) => event.id === milestoneDraft.id),
    [markerMilestoneEvents, milestoneDraft.id]
  );
  const isEditingSystemMilestone =
    selectedDraftMilestone ? isSystemMilestoneEvent(selectedDraftMilestone) : false;

  const duplicateMilestoneEvent = useMemo(() => {
    if (!normalizedMilestoneDraftMonth.ok) {
      return null;
    }
    return markerMilestoneEvents.find((event) => {
      if (event.id === milestoneDraft.id) {
        return false;
      }
      if (event.effectiveMonth !== normalizedMilestoneDraftMonth.month) {
        return false;
      }
      const memberId = event.memberId ?? "";
      if (memberId !== milestoneDraft.memberId) {
        return false;
      }
      const templateType = event.templateType ?? "custom";
      return templateType === milestoneDraft.templateType;
    });
  }, [markerMilestoneEvents, milestoneDraft.id, milestoneDraft.memberId, milestoneDraft.templateType, normalizedMilestoneDraftMonth]);

  const isMilestoneDraftDirty = useMemo(() => {
    return (
      JSON.stringify(normalizeDraftForCompare(milestoneDraft)) !==
      JSON.stringify(normalizeDraftForCompare(milestoneDraftBaseline))
    );
  }, [milestoneDraft, milestoneDraftBaseline]);

  const handleCloseMilestoneDrawer = () => {
    if (isMilestoneDraftDirty) {
      const shouldClose = window.confirm(moneyT("milestoneManagerUnsavedConfirm"));
      if (!shouldClose) {
        return;
      }
    }
    setMilestoneDrawerOpened(false);
  };

  const handleUndoDeleteMilestone = () => {
    if (!pendingDeletedMilestone || !selectedScenarioId || pendingDeletedMilestone.scenarioId !== selectedScenarioId) {
      return;
    }

    const result = applyMilestoneEvent(selectedScenarioId, {
      id: pendingDeletedMilestone.id,
      mode: "marker",
      templateType: pendingDeletedMilestone.templateType,
      memberId: pendingDeletedMilestone.memberId,
      effectiveMonth: pendingDeletedMilestone.effectiveMonth,
      notes: pendingDeletedMilestone.notes,
    });

    if (Object.keys(result.fieldErrors).length > 0) {
      showMilestoneToast({
        color: "red",
        message: moneyT("milestoneManagerSaveFailed"),
      });
      return;
    }

    setPendingDeletedMilestone(null);
    showMilestoneToast({
      color: "teal",
      message: moneyT("milestoneManagerUndoToast"),
    });
  };

  const handleSaveMilestone = () => {
    if (!selectedScenario || !normalizedMilestoneDraftMonth.ok) {
      return;
    }

    if (isEditingSystemMilestone) {
      showMilestoneToast({
        color: "orange",
        message: moneyT("milestoneManagerSystemLocked"),
      });
      return;
    }

    if (duplicateMilestoneEvent) {
      showMilestoneToast({
        color: "red",
        message: moneyT("milestoneManagerDuplicateError"),
      });
      return;
    }

    const result = applyMilestoneEvent(selectedScenarioId, {
      id: milestoneDraft.id,
      mode: "marker",
      templateType: milestoneDraft.templateType,
      memberId: milestoneDraft.memberId || undefined,
      effectiveMonth: normalizedMilestoneDraftMonth.month,
      notes: milestoneDraft.label.trim() || undefined,
    });

    if (Object.keys(result.fieldErrors).length > 0) {
      showMilestoneToast({
        color: "red",
        message: moneyT("milestoneManagerSaveFailed"),
      });
      return;
    }

    const nextDraft = createMilestoneDraft(
      normalizedMilestoneDraftMonth.month,
      milestoneDraft.memberId
    );
    setMilestoneDraft(nextDraft);
    setMilestoneDraftBaseline(nextDraft);
    showMilestoneToast({
      color: "teal",
      message: moneyT("milestoneManagerSavedToast"),
    });
  };

  const handleDeleteMilestone = (eventId: string) => {
    const target = markerMilestoneEvents.find((event) => event.id === eventId);
    if (!target) {
      return;
    }

    const isSystem = isSystemMilestoneEvent(target);
    const confirmMessage = isSystem
      ? moneyT("milestoneManagerDeleteConfirmSystem")
      : moneyT("milestoneManagerDeleteConfirm");
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) {
      return;
    }

    if (!selectedScenarioId) {
      return;
    }

    removeMilestoneEvent(selectedScenarioId, eventId);

    const pending: PendingDeletedMilestone = {
      scenarioId: selectedScenarioId,
      id: target.id,
      templateType: target.templateType ?? "custom",
      memberId: target.memberId,
      effectiveMonth: target.effectiveMonth,
      notes: target.notes,
    };
    setPendingDeletedMilestone(pending);
    if (milestoneUndoTimeoutRef.current) {
      clearTimeout(milestoneUndoTimeoutRef.current);
    }
    milestoneUndoTimeoutRef.current = setTimeout(() => {
      setPendingDeletedMilestone((current) =>
        current?.id === pending.id ? null : current
      );
      milestoneUndoTimeoutRef.current = null;
    }, 10000);

    if (milestoneDraft.id === eventId) {
      const resetDraft = createMilestoneDraft(defaultMilestoneMonth, defaultMilestoneMemberId);
      setMilestoneDraft(resetDraft);
      setMilestoneDraftBaseline(resetDraft);
    }

    showMilestoneToast({
      color: "orange",
      message: isSystem
        ? moneyT("milestoneManagerDeleteSystemToast")
        : moneyT("milestoneManagerDeletedToast"),
      actionLabel: moneyT("milestoneManagerUndoAction"),
      onAction: handleUndoDeleteMilestone,
    });
  };
  const compareChartData = useMemo(() => {
    if (compareProjections.length === 0) {
      return [];
    }
    const maxLength = Math.max(
      ...compareProjections.map((item) => item.projection.months.length)
    );
    const baseMonths = compareProjections[0]?.projection.months ?? [];

    return Array.from({ length: maxLength }, (_, index) => {
      const month = baseMonths[index] ?? "";
      const deflatorValue = displayMode === "real" ? deflator(index) : 1;
      const row: Record<string, string | number> = { month };
      compareProjections.forEach((item) => {
        row[item.scenarioId] = (item.projection.netWorth[index] ?? 0) / deflatorValue;
      });
      return row;
    }).filter((row) => Boolean(row.month));
  }, [compareProjections, deflator, displayMode]);

  const compareKpiRows = useMemo(() => {
    return compareProjections.map((item) => {
      const horizonMonths = globalHorizonMonths;
      const netWorthByYear = snapshotTargets.map((years) => {
        if (years === 0) {
          const deflatorValue = displayMode === "real" ? deflator(0) : 1;
          return (item.projection.netWorth[0] ?? 0) / deflatorValue;
        }
        const requiredMonths = years * 12;
        if (horizonMonths < requiredMonths) {
          return null;
        }
        const index = Math.min(requiredMonths - 1, item.projection.netWorth.length - 1);
        const deflatorValue = displayMode === "real" ? deflator(index) : 1;
        return (item.projection.netWorth[index] ?? 0) / deflatorValue;
      });

      return {
        scenarioId: item.scenarioId,
        name: item.scenario.name,
        currency: item.scenario.baseCurrency,
        values: netWorthByYear,
      };
    });
  }, [compareProjections, deflator, displayMode, globalHorizonMonths, snapshotTargets]);

  const runwaySimulation = useMemo(() => {
    if (!projection || !selectedScenario) {
      return null;
    }
    const netCashflowSeries = buildRunwayNetCashflowSeries(projection);
    const baseMonth =
      appSettings.globalBaseMonth ??
      projection.baseMonth ??
      selectedScenario.assumptions.baseMonth ??
      null;
    const startingCash =
      selectedScenario.assumptions.initialCash ??
      projection.cashBalance[0] ??
      0;
    const withdrawableAssets =
      (projection.assets?.investments?.[0] ?? 0) +
      (projection.assets?.insurance?.[0] ?? 0);

    return computeRunwaySimulation({
      projection,
      baseMonth,
      startingCash,
      withdrawableAssets,
      horizonMonths: globalHorizonMonths,
      netCashflowSeries,
      traceMonths: 12,
    });
  }, [appSettings.globalBaseMonth, globalHorizonMonths, projection, selectedScenario]);

  const riskAssessment = useMemo(() => {
    if (!projection || !runwaySimulation) {
      return null;
    }
    return computeRiskAssessment({ projection, runway: runwaySimulation });
  }, [projection, runwaySimulation]);


  useEffect(() => {
    if (months.length === 0) {
      setBreakdownMonth(null);
      return;
    }
    const next =
      breakdownMonth && months.includes(breakdownMonth)
        ? breakdownMonth
        : months[0];
    setBreakdownMonth(next ?? null);
  }, [breakdownMonth, months, setBreakdownMonth]);

  const planLabFamilyEntryHref = useMemo(() => {
    if (!selectedScenario) {
      return "/plan-lab";
    }
    return scenarioPlanLabPath(caseId, selectedScenario.id);
  }, [caseId, selectedScenario]);

  const dashboardMetrics = useMemo(
    () => computeDashboardMetrics(projection, projectionNetCashflowByMonth, ledgerByMonth),
    [ledgerByMonth, projection, projectionNetCashflowByMonth]
  );

  const nextKeyEvent = useMemo(
    () =>
      getNextKeyEvent({
        events: overviewTimelineMarkers.highlightedEvents,
        milestones: milestoneMarkers,
        baseMonth: projection?.baseMonth ?? months[0] ?? null,
      }),
    [milestoneMarkers, months, overviewTimelineMarkers.highlightedEvents, projection?.baseMonth]
  );

  if (!selectedScenario) {
    return null;
  }

  const showCompare = viewMode === "compare";
  const sd = (key: string, fallback: string, values?: Record<string, string | number>) =>
    safeT(tDashboard, key, fallback, values);


  const formatRatio = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) {
      return sd("common.emptyValue", "--");
    }
    return `${(value * 100).toFixed(1)}%`;
  };

  const kpiItems = [
    {
      label: sd("kpi.minCash", "Min cash"),
      value: dashboardMetrics.minCash12m
        ? `${formatCurrency(dashboardMetrics.minCash12m.value, selectedScenario.baseCurrency, locale)} · ${dashboardMetrics.minCash12m.month}`
        : sd("common.emptyValue", "--"),
      helper: sd("kpi.scope12m", "Scope: 12 months"),
    },
    {
      label: sd("kpi.deficitMonths", "Deficit months"),
      value: `${dashboardMetrics.deficitMonthsCount12m} / 12`,
      helper: sd("kpi.scope12m", "Scope: 12 months"),
    },
    {
      label: sd("kpi.avgNetCashflow", "Avg net cashflow"),
      value: `${formatCurrency(dashboardMetrics.avgNetCashflow12m ?? 0, selectedScenario.baseCurrency, locale)} / ${sd("common.month", "month")}`,
      helper: sd("kpi.scope12m", "Scope: 12 months"),
    },
    {
      label: sd("kpi.cashRunway", "Cash runway"),
      value: dashboardMetrics.cashRunwayMonths === null
        ? sd("kpi.runwayUnavailable", "Not available")
        : sd("kpi.runwayMonths", `${dashboardMetrics.cashRunwayMonths.toFixed(1)} months`, {
            months: dashboardMetrics.cashRunwayMonths.toFixed(1),
          }),
      helper: sd("kpi.runwayProxyHint", "Proxy based on current trajectory"),
    },
    {
      label: sd("kpi.firstMillionMonth", "First million month"),
      value: dashboardMetrics.firstMillionMonth ?? sd("kpi.notReachedWithinHorizon", "Not reached within horizon", {
        years: Math.round((globalHorizonMonths ?? 0) / 12),
      }),
      helper: sd("kpi.scopeHorizon", "Scope: projection horizon to {endMonth}", {
        endMonth: dashboardMetrics.endMonth ?? "--",
      }),
    },
    {
      label: sd("kpi.avgNonSalaryIncome", "Avg non-salary income"),
      value: formatCurrency(dashboardMetrics.avgNonSalaryIncome12m ?? 0, selectedScenario.baseCurrency, locale),
      helper: sd("kpi.scope12m", "Scope: 12 months"),
      tooltip: sd("kpi.avgNonSalaryIncomeFormula", "Total non-salary income over 12 months / 12"),
    },
    {
      label: sd("kpi.nonSalaryIncomeRatio", "Non-salary income ratio"),
      value: formatRatio(dashboardMetrics.nonSalaryIncomeRatio),
      helper: sd("kpi.scope12m", "Scope: 12 months"),
      tooltip: sd("kpi.nonSalaryIncomeRatioFormula", "Non-salary income / total income over 12 months"),
    },
    {
      label: sd("kpi.passiveIncomeCoverage", "Passive income coverage"),
      value: formatRatio(dashboardMetrics.passiveIncomeCoverage),
      helper: sd("kpi.scope12m", "Scope: 12 months"),
      tooltip: sd("kpi.passiveIncomeCoverageFormula", "Rental + dividends + interest / expenses over rolling 12 months"),
    },
    {
      label: sd("kpi.assetLinkedExpenseRatio", "Asset-linked expense ratio"),
      value: formatRatio(dashboardMetrics.assetLinkedExpenseRatio),
      helper: sd("kpi.scope12m", "Scope: 12 months"),
      tooltip: sd("kpi.assetLinkedExpenseRatioFormula", "Housing + car linked expenses / total expenses over rolling 12 months"),
    },
    {
      label: sd("kpi.avgFunBudget", "Avg fun budget"),
      value: formatCurrency(dashboardMetrics.avgFunBudget12m ?? 0, selectedScenario.baseCurrency, locale),
      helper: sd("kpi.avgFunBudgetHint", "Proxy from net cashflow trend"),
    },
    {
      label: sd("kpi.riskLevel", "Risk level"),
      value: dashboardMetrics.riskLevel === "red" ? sd("kpi.riskHigh", "High") : sd("kpi.riskLow", "Low"),
      badgeLabel: dashboardMetrics.riskLevel === "red" ? sd("kpi.riskHigh", "High") : sd("kpi.riskLow", "Low"),
      badgeColor: dashboardMetrics.riskLevel === "red" ? "red" : "green",
      helper: sd("kpi.scope12m", "Scope: 12 months"),
    },
  ];
  const handleScenarioChange = (nextScenarioId: string) => {
    setActiveScenario(nextScenarioId);
    router.push(scenarioDashboardPath(caseId, nextScenarioId, locale as Locale));
  };

  const handleExportCsv = () => {
    if (!projection || !selectedScenario) {
      return;
    }
    const csv = projectionToCSV(projection);
    const filename = buildExportFilename(selectedScenario, "projection", "csv");
    downloadTextFile(filename, "text/csv;charset=utf-8", csv);
  };

  const handleExportJson = () => {
    if (!projection || !selectedScenario) {
      return;
    }
    const payload = {
      meta: {
        baseMonth: projection.baseMonth,
        horizonMonths: projection.months.length,
        exportedAtIso: new Date().toISOString(),
      },
      projection,
    };
    const filename = buildExportFilename(selectedScenario, "projection_raw", "json");
    downloadTextFile(
      filename,
      "application/json;charset=utf-8",
      JSON.stringify(payload, null, 2)
    );
  };

  const handleSelectSnapshot = (month: string) => {
    if (!projection) {
      return;
    }
    openBreakdown(month);
  };

  const moneyTimelineHref = `${scenarioMoneyPath(caseId, selectedScenario.id)}?tab=timeline`;
  const moneyHubHref = scenarioMoneyPath(caseId, selectedScenario.id);
  const moneyInputsHref = `${moneyHubHref}&tab=inputs`;
  const peopleHubHref = params.caseId
    ? scenarioPeoplePath(params.caseId, selectedScenario.id, locale as Locale)
    : memberCasesPath(locale as Locale);
  const completenessItems = [
    { key: "income", label: sd("completeness.income", "Income"), done: Object.values(ledgerByMonth).some((items) => items.some((item) => item.amount > 0)), href: `${moneyHubHref}&tab=income` },
    { key: "expenses", label: sd("completeness.expenses", "Expenses"), done: Object.values(ledgerByMonth).some((items) => items.some((item) => item.amount < 0)), href: `${moneyHubHref}&tab=expenses` },
    { key: "assets", label: sd("completeness.assets", "Assets"), done: Boolean(selectedScenario.positions?.homes?.length || selectedScenario.positions?.cars?.length || selectedScenario.positions?.investments?.length), href: `${moneyHubHref}&tab=assets` },
    { key: "liabilities", label: sd("completeness.liabilities", "Liabilities"), done: Boolean(selectedScenario.positions?.loans?.length), href: `${moneyHubHref}&tab=liabilities` },
    { key: "members", label: sd("completeness.members", "Members"), done: scenarioMembers.length > 0, href: peopleHubHref },
    { key: "rules", label: sd("completeness.rules", "Rules"), done: budgetRules.length > 0, href: `${moneyHubHref}&tab=inputs` },
  ];
  return (
    <Stack gap="sm" pb={isDesktop ? undefined : 120}>
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Title order={2}>{t("title")}</Title>
            <Text size="sm" c="dimmed">
              {t("subtitle")}
            </Text>
          </div>
          <Group gap="sm">
            <Menu position="bottom-end" withArrow>
              <Menu.Target>
                <Button variant="light" disabled={!projection || showCompare}>
                  {exportT("export")}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={handleExportCsv} disabled={!projection || showCompare}>
                  {exportT("exportCsv")}
                </Menu.Item>
                <Menu.Item onClick={handleExportJson} disabled={!projection || showCompare}>
                  {exportT("exportJson")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button component={Link} href="/scenarios" variant="subtle" display={"none"}>
              {t("backToScenarios")}
            </Button>
            <Button component={Link} href="/onboarding" variant="light" display={"none"}>
              {common("runOnboardingAgain")}
            </Button>
          </Group>
        </Group>

        <Stack gap="sm">
          <Group gap="sm" wrap="wrap">
            <SegmentedControl
              display={"none"}
              data={[
                { value: "single", label: t("viewSingle") },
                { value: "compare", label: t("viewCompare") },
              ]}
              value={viewMode}
              onChange={(value) => setViewMode(value as "single" | "compare")}
            />
            <SegmentedControl
              display={"none"}
              data={[
                { value: "nominal", label: t("viewNominal") },
                { value: "real", label: t("viewReal") },
              ]}
              value={displayMode}
              onChange={(value) =>
                setViewModeSetting(value as "nominal" | "real")
              }
            />
          </Group>
          <Text size="xs" c="dimmed" display={"none"}>
            {t("viewRealHint")}
          </Text>
          {scenarios.length > 1 && (
            <>
              {showCompare ? (
                <Stack gap={4}>
                  <MultiSelect
                    data={compareScenarioOptions}
                    value={compareScenarioIds}
                    onChange={(value) => setCompareScenarioIds(value.slice(0, 5))}
                    placeholder={t("compareSelectPlaceholder")}
                  />
                  {compareScenarioIds.length < 2 && (
                    <Text size="xs" c="red">
                      {t("compareSelectHint")}
                    </Text>
                  )}
                </Stack>
              ) : isDesktop ? (
                <ScenarioContextSelector
                  options={scenarios.map((scenario) => ({
                    label: scenario.name,
                    value: scenario.id,
                  }))}
                  value={selectedScenario.id}
                  onChange={handleScenarioChange}
                />
              ) : (
                <Group gap="xs">
                  <Badge variant="light" color="indigo">
                    {selectedScenario.name}
                  </Badge>
                  <Button component={Link} href="/scenarios" variant="subtle" size="xs">
                    {common("actionChange")}
                  </Button>
                </Group>
              )}
            </>
          )}
        </Stack>
      </Stack>

      {!showCompare && (
        <Card withBorder radius="md" padding="md">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <div>
                <Text fw={700}>{sd("healthSummary.title", "Financial Health Summary")}</Text>
                <Text size="xs" c="dimmed">{sd("healthSummary.subtitle", "Review 12-month financial health and risk signals")}</Text>
              </div>
              <Group gap="xs">
                <Button component={Link} href={planLabFamilyEntryHref}>{sd("cta.openPlanLab", "Open Plan Lab")}</Button>
                <Button display="none" component={Link} href={moneyInputsHref} variant="light">{sd("cta.completeData", "Complete data")}</Button>
              </Group>
            </Group>
            {isDesktop ? (
              <SimpleGrid cols={4} spacing="sm">
                {kpiItems.map((item) => (
                  <KpiCard key={item.label} {...item} />
                ))}
              </SimpleGrid>
            ) : (
              <KpiCarousel items={kpiItems} />
            )}
            <Card withBorder radius="md" padding="sm" display="none">
              <Stack gap={6}>
                <Text fw={600} size="sm">{sd("completeness.title", "Completeness")}</Text>
                <Group gap="xs" wrap="wrap">
                  {completenessItems.map((item) => (
                    <Button key={sd(`completeness.${item.key}`, item.key)} component={Link} href={item.href} variant="light" size="xs">
                      {item.done ? "OK" : "TODO"} {item.label}
                    </Button>
                  ))}
                </Group>
              </Stack>
            </Card>
            <Card withBorder radius="md" padding="sm" display="none">
              <Stack gap={6}>
                <Text fw={600} size="sm">{sd("nextKeyEvent.title", "Next key event")}</Text>
                {nextKeyEvent ? (
                  <Text size="sm">{nextKeyEvent.label} · {nextKeyEvent.month}</Text>
                ) : (
                  <Stack gap="xs" align="flex-start">
                    <Text size="sm" c="dimmed">{sd("nextKeyEvent.empty", "No key events yet. Add milestones to preview upcoming timeline points.")}</Text>
                    <Button component={Link} href={`${peopleHubHref}#milestones`} size="xs">{sd("nextKeyEvent.addEvent", "Add event")}</Button>
                  </Stack>
                )}
              </Stack>
            </Card>
          </Stack>
        </Card>
      )}

      {showCompare ? (
        <Stack gap="md">
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Text fw={600}>{t("compareNetWorthTitle")}</Text>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={compareChartData} margin={{ left: 8, right: 12 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={72}
                      tickFormatter={(value) =>
                        formatCurrency(Number(value), undefined, locale)
                      }
                    />
                    <ChartTooltip
                      formatter={(value) =>
                        formatCurrency(Number(value), undefined, locale)
                      }
                      labelFormatter={(label) => t("monthLabel", { month: label })}
                    />
                    {compareProjections.map((item, index) => (
                      <Line
                        key={item.scenarioId}
                        type="monotone"
                        dataKey={item.scenarioId}
                        stroke={["#228be6", "#12b886", "#fa5252", "#7950f2", "#fab005"][index % 5]}
                        strokeWidth={2}
                        dot={false}
                        name={item.scenario.name}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Stack>
          </Card>
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Text fw={600}>{t("compareKpiTitle")}</Text>
              <Table striped withColumnBorders highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t("compareScenarioLabel")}</Table.Th>
                    {snapshotTargets.map((years) => (
                      <Table.Th key={years}>
                        {years === 0
                          ? t("snapshotsNowLabel")
                          : t("compareYearLabel", { years })}
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {compareKpiRows.map((row) => (
                    <Table.Tr key={row.scenarioId}>
                      <Table.Td>{row.name}</Table.Td>
                      {row.values.map((value, index) => (
                        <Table.Td key={`${row.scenarioId}-${index}`}>
                          {value === null
                            ? t("compareUnavailable")
                            : formatCurrency(value, row.currency, locale)}
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>
        </Stack>
      ) : (
        <Card withBorder radius="md" padding="md">
          <Stack gap="sm">
            <Group justify="space-between" align="center" wrap="wrap">
              <Text fw={600}>{sd("chart.title", "Overview charts")}</Text>
              <Group gap="xs">
                <SegmentedControl
                  size="xs"
                  data={[
                    { value: "cash", label: sd("chart.tabs.cash", "Cash balance") },
                    { value: "netWorth", label: sd("chart.tabs.netWorth", "Net worth") },
                    { value: "netCashflow", label: sd("chart.tabs.netCashflow", "Net cashflow") },
                  ]}
                  value={primaryChartTab}
                  onChange={(value) => setPrimaryChartTab(value as "cash" | "netWorth" | "netCashflow")}
                />
                <SegmentedControl
                  size="xs"
                  data={[
                    { value: "all", label: t("cashflowFilterAll") },
                    { value: "operational", label: t("cashflowFilterOperational") },
                  ]}
                  value={cashflowView}
                  onChange={(value) => setCashflowView(value as "all" | "operational")}
                />
              </Group>
            </Group>
            {primaryChartTab === "cash" ? (
              <CashBalanceChart data={cashSeries} markers={milestoneMarkers} title={sd("chart.tabs.cash", "Cash balance")} />
            ) : primaryChartTab === "netWorth" ? (
              <NetWorthChart data={netWorthSeries} markers={milestoneMarkers} title={sd("chart.tabs.netWorth", "Net worth")} />
            ) : (
              <NetCashflowChart data={displayedNetCashflowSeries} markers={milestoneMarkers} title={sd("chart.tabs.netCashflow", "Net cashflow")} />
            )}
            <Text size="xs" c="dimmed">{sd("chart.toggleHint", "Toggle between cash, net worth, and net cashflow views.")}</Text>
          </Stack>
        </Card>
      )}

      {!showCompare && (
        <>
          <Accordion variant="separated" radius="md" defaultValue="snapshot">
            <Accordion.Item value="snapshot">
              <Accordion.Control>{sd("snapshot.title", "Snapshots")}</Accordion.Control>
              <Accordion.Panel>
                <AutoSnapshotsCard
                  snapshots={autoSnapshots}
                  currency={selectedScenario.baseCurrency}
                  onSelectMonth={handleSelectSnapshot}
                />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" >
            <Card withBorder radius="md" padding="md" display={"none"}>
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={600}>{sd("quickLinks.moneyTitle", "Money summary")}</Text>
                  <Button component={Link} href={moneyHubHref} size="xs" variant="light">{t("moneySummaryCta")}</Button>
                </Group>
                <SimpleGrid cols={2} spacing="xs">
                  {[{ key: "income", count: Object.values(ledgerByMonth).flat().filter((item) => item.amount > 0).length }, { key: "expenses", count: Object.values(ledgerByMonth).flat().filter((item) => item.amount < 0).length }, { key: "assets", count: (selectedScenario.positions?.homes?.length ?? 0) + (selectedScenario.positions?.cars?.length ?? 0) + (selectedScenario.positions?.investments?.length ?? 0) }, { key: "liabilities", count: selectedScenario.positions?.loans?.length ?? 0 }].map((item) => (
                    <Card key={item.key} withBorder radius="md" padding="xs">
                      <Text size="sm" fw={600}>{sd(`completeness.${item.key}`, item.key)}</Text>
                      <Text size="xs" c="dimmed">{item.count}</Text>
                    </Card>
                  ))}
                </SimpleGrid>
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={600}>{sd("quickLinks.peopleTitle", "People summary")}</Text>
                  <Group gap="xs">
                    <Button component={Link} href={`${peopleHubHref}#milestones`} size="xs" variant="default">
                      {common("settingsTabMilestonesAction")}
                    </Button>
                    <Button component={Link} href={peopleHubHref} size="xs" variant="light">
                      {t("peopleSummaryCta")}
                    </Button>
                  </Group>
                </Group>
                <Text size="sm">{t("peopleSummaryMembers", { count: scenarioMembers.length })}</Text>
                {upcomingMilestones.length > 0 ? (
                  <Stack gap={2}>
                    {upcomingMilestones.map((marker) => (
                      <Text key={marker.id} size="xs" c="dimmed">{marker.label} · {marker.month}</Text>
                    ))}
                  </Stack>
                ) : (
                  <Text size="xs" c="dimmed">{t("peopleSummaryEmpty")}</Text>
                )}
              </Stack>
            </Card>
          </SimpleGrid>
          <Drawer
            opened={milestoneDrawerOpened}
            onClose={handleCloseMilestoneDrawer}
            title={moneyT("milestoneManagerTitle")}
            position="right"
            size="md"
          >
            <Stack gap="sm">
              {milestoneToast && (
                <Notification color={milestoneToast.color} onClose={() => setMilestoneToast(null)}>
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Text size="sm">{milestoneToast.message}</Text>
                    {milestoneToast.actionLabel && milestoneToast.onAction ? (
                      <Button
                        size="compact-xs"
                        variant="light"
                        onClick={milestoneToast.onAction}
                      >
                        {milestoneToast.actionLabel}
                      </Button>
                    ) : null}
                  </Group>
                </Notification>
              )}

              <Group justify="space-between" align="center" wrap="wrap">
                <Text fw={600}>{moneyT("milestoneManagerTitle")}</Text>
                <Button size="xs" variant="light" onClick={handleOpenMilestoneCreate}>
                  {moneyT("milestoneEventCreate")}
                </Button>
              </Group>
              <Text size="xs" c="dimmed">
                {moneyT("milestoneManagerHint")}
              </Text>

              <Card withBorder radius="md" padding="sm">
                <Stack gap="xs">
                  <TextInput
                    label={moneyT("milestoneManagerSearch")}
                    placeholder={moneyT("milestoneManagerSearchPlaceholder")}
                    value={milestoneSearchQuery}
                    onChange={(event) => setMilestoneSearchQuery(event.currentTarget.value)}
                  />
                  <Group grow align="flex-end" wrap="wrap">
                    <Select
                      label={moneyT("milestoneMember")}
                      value={milestoneMemberFilter}
                      data={[
                        { value: "all", label: moneyT("milestoneManagerFilterAll") },
                        { value: "", label: t("flowMemberHousehold") },
                        ...scenarioMembers.map((member) => ({
                          value: member.id,
                          label: member.name,
                        })),
                      ]}
                      onChange={(value) => setMilestoneMemberFilter(value ?? "all")}
                    />
                    <Select
                      label={moneyT("milestoneManagerTemplate")}
                      value={milestoneTemplateFilter}
                      data={[
                        { value: "all", label: moneyT("milestoneManagerFilterAll") },
                        { value: "custom", label: resolveMilestoneTemplateLabel("custom") },
                        { value: "member_birth", label: resolveMilestoneTemplateLabel("member_birth") },
                        { value: "member_school_start", label: resolveMilestoneTemplateLabel("member_school_start") },
                        { value: "member_retirement", label: resolveMilestoneTemplateLabel("member_retirement") },
                      ]}
                      onChange={(value) =>
                        setMilestoneTemplateFilter((value as MilestoneTemplateFilter) ?? "all")
                      }
                    />
                    <Select
                      label={moneyT("milestoneManagerSource")}
                      value={milestoneSourceFilter}
                      data={[
                        { value: "all", label: moneyT("milestoneManagerFilterAll") },
                        { value: "manual", label: moneyT("milestoneManagerSourceManual") },
                        { value: "system", label: moneyT("milestoneManagerSourceSystem") },
                      ]}
                      onChange={(value) =>
                        setMilestoneSourceFilter((value as MilestoneSourceFilter) ?? "all")
                      }
                    />
                    <Select
                      label={moneyT("milestoneManagerStatus")}
                      value={milestoneStatusFilter}
                      data={[
                        { value: "all", label: moneyT("milestoneManagerFilterAll") },
                        { value: "upcoming", label: moneyT("milestoneManagerStatusUpcoming") },
                        { value: "expired", label: moneyT("milestoneManagerStatusExpired") },
                        { value: "completed", label: moneyT("milestoneManagerStatusCompleted") },
                      ]}
                      onChange={(value) =>
                        setMilestoneStatusFilter((value as MilestoneStatusFilter) ?? "all")
                      }
                    />
                  </Group>
                  <Group grow align="flex-end" wrap="wrap">
                    <MonthField
                      label={moneyT("milestoneManagerMonthFrom")}
                      value={milestoneMonthFrom}
                      onChange={setMilestoneMonthFrom}
                      error={milestoneMonthFromError}
                    />
                    <MonthField
                      label={moneyT("milestoneManagerMonthTo")}
                      value={milestoneMonthTo}
                      onChange={setMilestoneMonthTo}
                      error={
                        milestoneMonthToError ??
                        (milestoneMonthRangeInvalid
                          ? moneyT("milestoneManagerMonthRangeInvalid")
                          : undefined)
                      }
                    />
                    <Button
                      variant="default"
                      onClick={handleClearMilestoneFilters}
                      disabled={!milestoneHasActiveFilters}
                    >
                      {moneyT("milestoneManagerClearFilters")}
                    </Button>
                  </Group>
                </Stack>
              </Card>

              {filteredMilestoneItems.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {moneyT("milestoneManagerEmptyFiltered")}
                </Text>
              ) : (
                <Stack gap="xs">
                  {filteredMilestoneItems.map((item) => (
                    <Card key={item.id} withBorder padding="xs" radius="sm">
                      <Stack gap={6}>
                        <Group justify="space-between" align="flex-start" wrap="nowrap">
                          <Stack gap={2}>
                            <Text size="sm" fw={600}>
                              {item.label}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {item.month}
                              {item.memberName ? ` (${item.memberName})` : ""}
                            </Text>
                          </Stack>
                          <Group gap={4}>
                            {item.isSystemDerived ? (
                              <Button
                                component={Link}
                                href={moneyTimelineHref}
                                size="compact-xs"
                                variant="light"
                              >
                                {moneyT("milestoneManagerGoToSource")}
                              </Button>
                            ) : (
                              <Button
                                size="compact-xs"
                                variant="subtle"
                                onClick={() => handleOpenMilestoneEdit(item.id)}
                              >
                                {common("actionEdit")}
                              </Button>
                            )}
                            <Button
                              size="compact-xs"
                              color="red"
                              variant="subtle"
                              onClick={() => handleDeleteMilestone(item.id)}
                            >
                              {common("actionDelete")}
                            </Button>
                          </Group>
                        </Group>
                        <Group gap={6}>
                          <Badge variant="light" color={item.source === "system" ? "indigo" : "gray"}>
                            {item.source === "system"
                              ? moneyT("milestoneManagerSourceSystem")
                              : moneyT("milestoneManagerSourceManual")}
                          </Badge>
                          <Badge variant="light" color="teal">
                            {resolveMilestoneTemplateLabel(item.templateType)}
                          </Badge>
                          <Badge
                            variant="light"
                            color={
                              item.status === "upcoming"
                                ? "blue"
                                : item.status === "expired"
                                  ? "orange"
                                  : "gray"
                            }
                          >
                            {item.status === "upcoming"
                              ? moneyT("milestoneManagerStatusUpcoming")
                              : item.status === "expired"
                                ? moneyT("milestoneManagerStatusExpired")
                                : moneyT("milestoneManagerStatusCompleted")}
                          </Badge>
                        </Group>
                        {item.isSystemDerived ? (
                          <Text size="xs" c="dimmed">
                            {moneyT("milestoneManagerSystemHint")}
                          </Text>
                        ) : null}
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              )}

              <Card withBorder radius="md" padding="sm">
                <Stack gap="xs">
                  <Text fw={600}>{moneyT("milestoneManagerEditorTitle")}</Text>
                  {isEditingSystemMilestone ? (
                    <Text size="xs" c="dimmed">
                      {moneyT("milestoneManagerSystemLocked")}
                    </Text>
                  ) : null}
                  <TextInput
                    label={moneyT("milestoneNotes")}
                    value={milestoneDraft.label}
                    disabled={isEditingSystemMilestone}
                    onChange={(event) =>
                      setMilestoneDraft((current) => ({
                        ...current,
                        label: event.currentTarget.value,
                      }))
                    }
                  />
                  <Select
                    label={moneyT("milestoneManagerTemplate")}
                    value={milestoneDraft.templateType}
                    disabled={isEditingSystemMilestone}
                    data={[
                      { value: "custom", label: resolveMilestoneTemplateLabel("custom") },
                      { value: "member_birth", label: resolveMilestoneTemplateLabel("member_birth") },
                      { value: "member_school_start", label: resolveMilestoneTemplateLabel("member_school_start") },
                      { value: "member_retirement", label: resolveMilestoneTemplateLabel("member_retirement") },
                    ]}
                    onChange={(value) =>
                      setMilestoneDraft((current) => ({
                        ...current,
                        templateType: (value as MilestoneEventTemplateType) ?? "custom",
                      }))
                    }
                  />
                  <MonthField
                    label={moneyT("milestoneEffectiveMonth")}
                    value={milestoneDraft.effectiveMonth}
                    onChange={(value) =>
                      setMilestoneDraft((current) => ({
                        ...current,
                        effectiveMonth: value,
                      }))
                    }
                    error={milestoneMonthError}
                    disabled={isEditingSystemMilestone}
                  />
                  <Select
                    label={moneyT("milestoneMember")}
                    value={milestoneDraft.memberId}
                    disabled={isEditingSystemMilestone}
                    data={[
                      { value: "", label: t("flowMemberHousehold") },
                      ...scenarioMembers.map((member) => ({
                        value: member.id,
                        label: member.name,
                      })),
                    ]}
                    onChange={(value) =>
                      setMilestoneDraft((current) => ({
                        ...current,
                        memberId: value ?? "",
                      }))
                    }
                  />
                  {duplicateMilestoneEvent ? (
                    <Text size="xs" c="red">
                      {moneyT("milestoneManagerDuplicateError")}
                    </Text>
                  ) : null}
                  <Group justify="flex-end">
                    <Button variant="default" onClick={handleOpenMilestoneCreate}>
                      {common("actionClear")}
                    </Button>
                    <Button
                      onClick={handleSaveMilestone}
                      disabled={
                        !normalizedMilestoneDraftMonth.ok ||
                        Boolean(duplicateMilestoneEvent) ||
                        isEditingSystemMilestone
                      }
                    >
                      {common("actionSave")}
                    </Button>
                  </Group>
                </Stack>
              </Card>

              <Card withBorder radius="md" padding="sm">
                <Stack gap={4}>
                  <Text fw={600}>{moneyT("milestoneManagerCadenceTitle")}</Text>
                  <Text size="xs" c="dimmed">
                    {moneyT("milestoneManagerCadenceMonthly")}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {moneyT("milestoneManagerCadenceQuarterly")}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {moneyT("milestoneManagerCadenceAfterEvent")}
                  </Text>
                </Stack>
              </Card>
            </Stack>
          </Drawer>
          <MonthlyBreakdownModalHost
            months={months}
            ledgerByMonth={ledgerByMonth}
            summaryByMonth={summaryByMonth}
            positionCashflowsByMonth={positionCashflowsByMonth}
            projectionNetCashflowByMonth={projectionNetCashflowByMonth}
            projectionNetCashflowMode={projectionNetCashflowMode}
            netWorthByMonth={netWorthByMonth}
            netWorthBreakdownByMonth={netWorthBreakdownByMonth}
            currency={selectedScenario.baseCurrency}
            memberLookup={memberLookup}
            scenarioId={selectedScenario.id}
            baseMonth={selectedScenario.assumptions.baseMonth}
            horizonMonths={selectedScenario.assumptions.horizonMonths}
            members={members}
            eventViews={scenarioEventViews}
            milestoneMarkers={milestoneMarkers}
          />
          <RunwayDetailModal
            opened={runwayDetailOpen}
            onClose={() => setRunwayDetailOpen(false)}
            simulation={runwaySimulation}
            currency={selectedScenario.baseCurrency}
          />
          <RiskDetailModal
            opened={riskDetailOpen}
            onClose={() => setRiskDetailOpen(false)}
            assessment={riskAssessment}
            onOpenRunwayDetails={() => {
              setRiskDetailOpen(false);
              setRunwayDetailOpen(true);
            }}
          />
          <FullScreenChartModal
            opened={Boolean(fullscreenChart)}
            onClose={() => setFullscreenChart(null)}
            type={fullscreenChart?.type}
            data={fullscreenChart?.data ?? []}
            markers={fullscreenChart?.markers ?? []}
            title={
              fullscreenChart?.type === "netWorth"
                ? t("fullscreenTitleNetWorth")
                : fullscreenChart?.type === "netCashflow"
                  ? t("fullscreenTitleNetCashflow")
                  : t("fullscreenTitleCashBalance")
            }
          />
        </>
      )}
    </Stack>
  );
}
