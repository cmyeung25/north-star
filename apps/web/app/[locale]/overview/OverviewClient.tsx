"use client";

import {
  Accordion,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  MultiSelect,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import {
  projectionToOverviewViewModel,
} from "../../../src/engine/adapter";
import { useProjectionWithLedger } from "../../../src/engine/useProjectionWithLedger";
import { useScenarioProjections } from "../../../src/engine/useScenarioProjections";
import { buildScenarioEventViews, buildScenarioTimelineEvents } from "../../../src/domain/events/utils";
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
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { Link } from "../../../src/i18n/navigation";
import { safeT } from "../../../src/i18n/safeT";
import { getMemberAgeYears } from "../../../src/domain/members/age";
import { appliesToScenario } from "../../../src/domain/applyScope";
import { computeMilestonesForScenario } from "../../../src/domain/members/milestones";
import { useUiStore } from "../../../src/store/uiStore";
import { isInvestmentCashflow } from "../../../src/domain/ledger/cashflowFilters";
import { computeDashboardMetrics } from "../../../src/domain/dashboard/metrics";
import { getNextKeyEvent } from "../../../src/domain/dashboard/nextKeyEvent";

type OverviewClientProps = {
  scenarioId?: string;
};

export default function OverviewClient({ scenarioId }: OverviewClientProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("overview");
  const tDashboard = useTranslations("overview.dashboard");
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
  const milestoneMarkers = useMemo(() => {
    if (!selectedScenario || !projection?.baseMonth) {
      return [];
    }
    const markers = computeMilestonesForScenario(
      selectedScenario.id,
      scenarioMembers,
      projection.baseMonth,
      globalHorizonMonths
    );
    return markers;
  }, [
    globalHorizonMonths,
    projection?.baseMonth,
    scenarioMembers,
    selectedScenario,
  ]);
  const monthIndexLookup = useMemo(
    () => new Map(months.map((month, index) => [month, index])),
    [months]
  );
  const timelineEvents = useMemo(
    () =>
      selectedScenario
        ? buildScenarioTimelineEvents(selectedScenario, eventLibrary).filter(
            (event) => event.enabled && !event.derived && event.highlighted
          )
        : [],
    [eventLibrary, selectedScenario]
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
    return buildScenarioUrl("/plan-lab", selectedScenario.id);
  }, [selectedScenario]);

  const dashboardMetrics = useMemo(
    () => computeDashboardMetrics(projection, projectionNetCashflowByMonth, ledgerByMonth),
    [ledgerByMonth, projection, projectionNetCashflowByMonth]
  );

  const nextKeyEvent = useMemo(
    () =>
      getNextKeyEvent({
        events: timelineEvents,
        milestones: milestoneMarkers,
        baseMonth: projection?.baseMonth ?? months[0] ?? null,
      }),
    [milestoneMarkers, months, projection?.baseMonth, timelineEvents]
  );

  if (!selectedScenario) {
    return null;
  }

  const showCompare = viewMode === "compare";
  const sd = (key: string, fallback: string, values?: Record<string, string | number>) =>
    safeT(tDashboard, key, fallback, values);

  const kpiItems = [
    {
      label: sd("kpi.minCash", "最低現金結餘"),
      value: dashboardMetrics.minCash12m
        ? `${formatCurrency(dashboardMetrics.minCash12m.value, selectedScenario.baseCurrency, locale)} · ${dashboardMetrics.minCash12m.month}`
        : sd("common.emptyValue", "--"),
      helper: sd("kpi.scope12m", "未來 12 個月"),
    },
    {
      label: sd("kpi.deficitMonths", "負現金流月份"),
      value: `${dashboardMetrics.deficitMonthsCount12m} / 12`,
      helper: sd("kpi.scope12m", "未來 12 個月"),
    },
    {
      label: sd("kpi.avgNetCashflow", "平均每月淨現金流"),
      value: `${formatCurrency(dashboardMetrics.avgNetCashflow12m ?? 0, selectedScenario.baseCurrency, locale)} / ${sd("common.month", "月")}`,
      helper: sd("kpi.scope12m", "未來 12 個月"),
    },
    {
      label: sd("kpi.cashRunway", "可支撐月數"),
      value: dashboardMetrics.cashRunwayMonths === null
        ? sd("kpi.runwayUnavailable", "未有資料")
        : sd("kpi.runwayMonths", `${dashboardMetrics.cashRunwayMonths.toFixed(1)} 個月`, { months: dashboardMetrics.cashRunwayMonths.toFixed(1) }),
      helper: sd("kpi.runwayProxyHint", "以平均必要支出估算。"),
    },
    {
      label: sd("kpi.firstMillionMonth", "第一桶金 (1百萬)"),
      value: dashboardMetrics.firstMillionMonth ?? sd("kpi.notReachedWithinHorizon", "未達標（在 {years} 年內）", { years: Math.round((globalHorizonMonths ?? 0) / 12) }),
      helper: dashboardMetrics.firstMillionMonth
        ? sd("kpi.scopeHorizon", "以全期投影（至 {endMonth}）", { endMonth: dashboardMetrics.endMonth ?? "--" })
        : sd("kpi.scopeHorizon", "以全期投影（至 {endMonth}）", { endMonth: dashboardMetrics.endMonth ?? "--" }),
    },
    {
      label: sd("kpi.avgNonSalaryIncome", "非工資收入（平均）"),
      value: formatCurrency(dashboardMetrics.avgNonSalaryIncome12m ?? 0, selectedScenario.baseCurrency, locale),
      helper: sd("kpi.scope12m", "未來 12 個月"),
    },
    {
      label: sd("kpi.avgFunBudget", "每月可自由支出（平均）"),
      value: formatCurrency(dashboardMetrics.avgFunBudget12m ?? 0, selectedScenario.baseCurrency, locale),
      helper: sd("kpi.avgFunBudgetHint", "以平均月淨現金流作 proxy"),
    },
    {
      label: sd("kpi.riskLevel", "風險等級"),
      value: dashboardMetrics.riskLevel === "red" ? sd("kpi.riskHigh", "高") : sd("kpi.riskLow", "低"),
      badgeLabel: dashboardMetrics.riskLevel === "red" ? sd("kpi.riskHigh", "高") : sd("kpi.riskLow", "低"),
      badgeColor: dashboardMetrics.riskLevel === "red" ? "red" : "green",
      helper: sd("kpi.scope12m", "未來 12 個月"),
    },
  ];

  const handleScenarioChange = (nextScenarioId: string) => {
    setActiveScenario(nextScenarioId);
    router.push(`/${locale}${buildScenarioUrl("/dashboard", nextScenarioId)}`);
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

  const moneyTimelineHref = `${buildScenarioUrl("/money", selectedScenario.id)}&tab=timeline`;
  const moneyHubHref = buildScenarioUrl("/money", selectedScenario.id);
  const moneyInputsHref = `${moneyHubHref}&tab=inputs`;
  const peopleHubHref = buildScenarioUrl("/people", selectedScenario.id);
  const completenessItems = [
    { key: "income", label: sd("completeness.income", "收入"), done: Object.values(ledgerByMonth).some((items) => items.some((item) => item.amount > 0)), href: `${moneyHubHref}&tab=income` },
    { key: "expenses", label: sd("completeness.expenses", "支出"), done: Object.values(ledgerByMonth).some((items) => items.some((item) => item.amount < 0)), href: `${moneyHubHref}&tab=expenses` },
    { key: "assets", label: sd("completeness.assets", "資產"), done: Boolean(selectedScenario.positions?.homes?.length || selectedScenario.positions?.cars?.length || selectedScenario.positions?.investments?.length), href: `${moneyHubHref}&tab=assets` },
    { key: "liabilities", label: sd("completeness.liabilities", "負債"), done: Boolean(selectedScenario.positions?.loans?.length), href: `${moneyHubHref}&tab=liabilities` },
    { key: "members", label: sd("completeness.members", "成員"), done: scenarioMembers.length > 0, href: peopleHubHref },
    { key: "rules", label: sd("completeness.rules", "規則"), done: budgetRules.length > 0, href: `${moneyHubHref}&tab=inputs` },
  ];
  return (
    <Stack gap="xl" pb={isDesktop ? undefined : 120}>
      <Stack gap="sm">
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
            <Button component={Link} href="/onboarding" variant="light">
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
        </Stack>
      </Stack>

      {!showCompare && (
        <Card withBorder radius="md" padding="md">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <div>
                <Text fw={700}>{sd("healthSummary.title", "財務健康總覽")}</Text>
                <Text size="xs" c="dimmed">{sd("healthSummary.subtitle", "以未來 12 個月投影評估風險與可承受度。")}</Text>
              </div>
              <Group gap="xs">
                <Button component={Link} href={planLabFamilyEntryHref}>{sd("cta.openPlanLab", "打開情景實驗室")}</Button>
                <Button component={Link} href={moneyInputsHref} variant="light">{sd("cta.completeData", "補齊資料")}</Button>
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
            <Card withBorder radius="md" padding="sm">
              <Stack gap={6}>
                <Text fw={600} size="sm">{sd("completeness.title", "資料完整度")}</Text>
                <Group gap="xs" wrap="wrap">
                  {completenessItems.map((item) => (
                    <Button key={sd(`completeness.${item.key}`, item.key)} component={Link} href={item.href} variant="light" size="xs">
                      {item.done ? "✔" : "✖"} {item.label}
                    </Button>
                  ))}
                </Group>
              </Stack>
            </Card>
            <Card withBorder radius="md" padding="sm">
              <Stack gap={6}>
                <Text fw={600} size="sm">{sd("nextKeyEvent.title", "下一個關鍵點")}</Text>
                {nextKeyEvent ? (
                  <Text size="sm">{nextKeyEvent.label} · {nextKeyEvent.month}</Text>
                ) : (
                  <Stack gap="xs" align="flex-start">
                    <Text size="sm" c="dimmed">{sd("nextKeyEvent.empty", "你未設定重要事件（例如旅行／結婚／入市／預產）。新增一個即可看到風險變化。")}</Text>
                    <Button component={Link} href={moneyTimelineHref} size="xs">{sd("nextKeyEvent.addEvent", "新增事件")}</Button>
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
              <Text fw={600}>{sd("chart.title", "預覽圖表")}</Text>
              <Group gap="xs">
                <SegmentedControl
                  size="xs"
                  data={[
                    { value: "cash", label: sd("chart.tabs.cash", "現金結餘") },
                    { value: "netWorth", label: sd("chart.tabs.netWorth", "資產淨值") },
                    { value: "netCashflow", label: sd("chart.tabs.netCashflow", "淨現金流") },
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
              <CashBalanceChart data={cashSeries} markers={milestoneMarkers} title={sd("chart.tabs.cash", "現金結餘")} />
            ) : primaryChartTab === "netWorth" ? (
              <NetWorthChart data={netWorthSeries} markers={milestoneMarkers} title={sd("chart.tabs.netWorth", "資產淨值")} />
            ) : (
              <NetCashflowChart data={displayedNetCashflowSeries} markers={milestoneMarkers} title={sd("chart.tabs.netCashflow", "淨現金流")} />
            )}
            <Text size="xs" c="dimmed">{sd("chart.toggleHint", "切換不同視角以查看現金壓力與資產走勢。")}</Text>
          </Stack>
        </Card>
      )}

      {!showCompare && (
        <>
          <Accordion variant="separated" radius="md" defaultValue="snapshot">
            <Accordion.Item value="snapshot">
              <Accordion.Control>{sd("snapshot.title", "投影快照")}</Accordion.Control>
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
                  <Text fw={600}>{sd("quickLinks.moneyTitle", "金錢摘要")}</Text>
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
                  <Text fw={600}>{sd("quickLinks.peopleTitle", "成員摘要")}</Text>
                  <Button component={Link} href={peopleHubHref} size="xs" variant="light">{t("peopleSummaryCta")}</Button>
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
