"use client";

import {
  Accordion,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  MultiSelect,
  ScrollArea,
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
import type { RiskLevel, TimeSeriesPoint, MilestoneMarker } from "../../../features/overview/types";
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
import { getMemberAgeYears } from "../../../src/domain/members/age";
import { appliesToScenario } from "../../../src/domain/applyScope";
import { computeMilestonesForScenario } from "../../../src/domain/members/milestones";
import { normalizeMonthStrict } from "../../../src/utils/month";
import { useUiStore } from "../../../src/store/uiStore";
import { isInvestmentCashflow } from "../../../src/domain/ledger/cashflowFilters";

type OverviewClientProps = {
  scenarioId?: string;
};

// type OverviewKpis = {
//   lowestMonthlyBalance: number;
//   runwayMonths: number;
//   riskLevel: RiskLevel;
// };

const riskBadgeColor: Record<RiskLevel, string> = {
  Low: "green",
  Medium: "yellow",
  High: "red",
};

export default function OverviewClient({ scenarioId }: OverviewClientProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("overview");
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
  const assetMarkers = useMemo(() => {
    if (!selectedScenario) {
      return [];
    }
    const markers: Array<{ id: string; label: string; month: string; kind: string }> = [];
    const pushMarker = (id: string, label: string, month?: string) => {
      if (!month) {
        return;
      }
      const normalized = normalizeMonthStrict(month);
      if (!normalized.ok) {
        return;
      }
      markers.push({ id, label, month: normalized.month, kind: "asset" });
    };
    const homes =
      selectedScenario.positions?.homes ??
      (selectedScenario.positions?.home ? [selectedScenario.positions.home] : []);
    const cars = selectedScenario.positions?.cars ?? [];
    const investments = selectedScenario.positions?.investments ?? [];

    homes.forEach((home, index) => {
      pushMarker(
        `home-buy-${index}`,
        t("timelineAssetBuyHome", { index: index + 1 }),
        home.purchaseMonth
      );
      pushMarker(
        `home-sell-${index}`,
        t("timelineAssetSellHome", { index: index + 1 }),
        home.sellMonth
      );
    });

    cars.forEach((car, index) => {
      pushMarker(
        `car-buy-${index}`,
        t("timelineAssetBuyCar", { index: index + 1 }),
        car.purchaseMonth
      );
      pushMarker(
        `car-sell-${index}`,
        t("timelineAssetSellCar", { index: index + 1 }),
        car.sellMonth
      );
    });

    investments.forEach((investment, index) => {
      pushMarker(
        `investment-buy-${index}`,
        t("timelineAssetBuyInvestment", { index: index + 1 }),
        investment.startMonth
      );
    });

    return markers;
  }, [selectedScenario, t]);
  const timelineStripMarkers = useMemo(() => {
    const markers: Array<{ id: string; label: string; month: string; kind: string }> = [];
    const baseMonth = projection?.baseMonth ?? months[0];
    if (baseMonth) {
      markers.push({
        id: "now",
        label: t("timelineNow"),
        month: baseMonth,
        kind: "now",
      });
    }

    milestoneMarkers.forEach((marker) => {
      markers.push({
        id: marker.id,
        label: t("timelineMarkerLabel", {
          label: marker.label,
          name: marker.memberName,
        }),
        month: marker.month,
        kind: "milestone",
      });
    });

    timelineEvents.forEach((event) => {
      if (!event.startMonth) {
        return;
      }
      markers.push({
        id: event.id,
        label: event.name,
        month: event.startMonth,
        kind: "event",
      });
    });

    assetMarkers.forEach((marker) => {
      markers.push(marker);
    });

    return markers
      .filter((marker) => marker.month)
      .sort((a, b) => {
        const aIndex = monthIndexLookup.get(a.month) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = monthIndexLookup.get(b.month) ?? Number.MAX_SAFE_INTEGER;
        if (aIndex === bIndex) {
          return a.label.localeCompare(b.label);
        }
        return aIndex - bIndex;
      });
  }, [
    assetMarkers,
    milestoneMarkers,
    monthIndexLookup,
    months,
    projection?.baseMonth,
    t,
    timelineEvents,
  ]);
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

  if (!selectedScenario) {
    return null;
  }

  const showCompare = viewMode === "compare";
  const hasEnabledEvents =
    buildScenarioTimelineEvents(selectedScenario, eventLibrary).filter(
      (event) => event.enabled
    ).length > 0;

  const runwayValueLabel = (() => {
    if (!runwaySimulation || runwaySimulation.months === null) {
      return t("kpiRunwayUnavailable");
    }
    if (runwaySimulation.isCapped) {
      return t("kpiRunwayCapped", { months: runwaySimulation.horizonMonths });
    }
    return t("kpiRunwayValue", { months: runwaySimulation.months });
  })();

  const kpiItems = [
    {
      label: t("kpiLowestBalance"),
      value: formatCurrency(
        overviewViewModel?.kpis.lowestMonthlyBalance ?? 0,
        selectedScenario.baseCurrency,
        locale
      ),
      helper: t("kpiLowestBalanceHelper"),
      onDetails: projection
        ? () => openBreakdown(breakdownMonth ?? months[0])
        : undefined,
      detailsLabel: t("breakdownCta"),
    },
    {
      label: t("kpiRunway"),
      value: runwayValueLabel,
      helper: t("kpiRunwayHelper"),
      onDetails: projection ? () => setRunwayDetailOpen(true) : undefined,
      detailsLabel: t("runwayDetailCta"),
    },
    {
      label: t("kpiRisk"),
      value: common(`risk${riskAssessment?.level ?? "Medium"}`),
      badgeLabel: common(`risk${riskAssessment?.level ?? "Medium"}`),
      badgeColor: riskBadgeColor[riskAssessment?.level ?? "Medium"],
      onDetails: projection ? () => setRiskDetailOpen(true) : undefined,
      detailsLabel: t("riskDetailCta"),
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

  const visibleTimelineMarkers = timelineStripMarkers.sort((a, b) => a.month.localeCompare(b.month)).slice(0, 10);
  const timelineOverflowCount = timelineStripMarkers.length - visibleTimelineMarkers.length;
  const moneyTimelineHref = `${buildScenarioUrl("/money", selectedScenario.id)}&tab=timeline`;
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

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <div>
              <Text fw={600}>{t("timelineStripTitle")}</Text>
              <Text size="xs" c="dimmed">
                {t("timelineStripSubtitle")}
              </Text>
            </div>
            <Button
              component={Link}
              href={moneyTimelineHref}
              size="xs"
              variant="light"
            >
              {t("timelineStripCta")}
            </Button>
          </Group>
          {visibleTimelineMarkers.length > 0 ? (
            <Stack gap={4}>
              <ScrollArea type="auto" offsetScrollbars>
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  {visibleTimelineMarkers.map((marker) => (
                    <Stack key={marker.id} gap={4} align="center">
                      <Badge
                        color={
                          marker.kind === "now"
                            ? "blue"
                            : marker.kind === "milestone"
                              ? "teal"
                              : "grape"
                        }
                        variant={marker.kind === "now" ? "filled" : "light"}
                      >
                        {marker.label}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {marker.month}
                      </Text>
                    </Stack>
                  ))}
                </Group>
              </ScrollArea>
              {timelineOverflowCount > 0 && (
                <Text size="xs" c="dimmed">
                  {t("timelineStripMore", { count: timelineOverflowCount })}
                </Text>
              )}
            </Stack>
          ) : (
            <Text size="xs" c="dimmed">
              {t("timelineStripEmpty")}
            </Text>
          )}
        </Stack>
      </Card>

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
        <>
          {isDesktop ? (
            <SimpleGrid cols={3} spacing="md">
              {kpiItems.map((item) => (
                <KpiCard key={item.label} {...item} />
              ))}
            </SimpleGrid>
          ) : (
            <KpiCarousel items={kpiItems} />
          )}

          {isDesktop ? (
            <SimpleGrid cols={3} spacing="md">
              <CashBalanceChart
                data={cashSeries}
                markers={milestoneMarkers}
                title={t("cashBalanceTitle")}
                onClick={
                  projection
                    ? () =>
                        setFullscreenChart({
                          type: "cash",
                          data: cashSeries,
                          markers: milestoneMarkers,
                        })
                    : undefined
                }
              />
              <NetWorthChart
                data={netWorthSeries}
                markers={milestoneMarkers}
                title={t("netWorthTitle")}
                onClick={
                  projection
                    ? () =>
                        setFullscreenChart({
                          type: "netWorth",
                          data: netWorthSeries,
                          markers: milestoneMarkers,
                        })
                    : undefined
                }
              />
              <NetCashflowChart
                data={displayedNetCashflowSeries}
                markers={milestoneMarkers}
                title={t("netCashflowTitle")}
                headerRight={
                  <SegmentedControl
                    size="xs"
                    data={[
                      { value: "all", label: t("cashflowFilterAll") },
                      { value: "operational", label: t("cashflowFilterOperational") },
                    ]}
                    value={cashflowView}
                    onChange={(value) => setCashflowView(value as "all" | "operational")}
                  />
                }
                onClick={
                  projection
                    ? () =>
                        setFullscreenChart({
                          type: "netCashflow",
                          data: displayedNetCashflowSeries,
                          markers: milestoneMarkers,
                        })
                    : undefined
                }
              />
            </SimpleGrid>
          ) : (
            <Stack gap="md">
              <CashBalanceChart
                data={cashSeries}
                markers={milestoneMarkers}
                title={t("cashBalanceTitle")}
                onClick={
                  projection
                    ? () =>
                        setFullscreenChart({
                          type: "cash",
                          data: cashSeries,
                          markers: milestoneMarkers,
                        })
                    : undefined
                }
              />
              <Accordion variant="separated" radius="md">
                <Accordion.Item value="net-worth">
                  <Accordion.Control>{t("netWorthTitle")}</Accordion.Control>
                  <Accordion.Panel>
                    <NetWorthChart
                      data={netWorthSeries}
                      markers={milestoneMarkers}
                      onClick={
                        projection
                          ? () =>
                              setFullscreenChart({
                                type: "netWorth",
                                data: netWorthSeries,
                                markers: milestoneMarkers,
                              })
                          : undefined
                      }
                    />
                  </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="net-cashflow">
                  <Accordion.Control>{t("netCashflowTitle")}</Accordion.Control>
                  <Accordion.Panel>
                    <NetCashflowChart
                      data={displayedNetCashflowSeries}
                      markers={milestoneMarkers}
                      headerRight={
                        <SegmentedControl
                          size="xs"
                          data={[
                            { value: "all", label: t("cashflowFilterAll") },
                            { value: "operational", label: t("cashflowFilterOperational") },
                          ]}
                          value={cashflowView}
                          onChange={(value) =>
                            setCashflowView(value as "all" | "operational")
                          }
                        />
                      }
                      onClick={
                        projection
                          ? () =>
                              setFullscreenChart({
                                type: "netCashflow",
                                data: displayedNetCashflowSeries,
                                markers: milestoneMarkers,
                              })
                          : undefined
                      }
                    />
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Stack>
          )}
        </>
      )}

      {!showCompare && (
        <>
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Title order={5}>{t("planLabFamilyEntryTitle")}</Title>
                  <Text size="sm" c="dimmed">
                    {t("planLabFamilyEntryHint")}
                  </Text>
                </div>
                <Button component={Link} href={planLabFamilyEntryHref}>
                  {t("planLabFamilyEntryCta")}
                </Button>
              </Group>
            </Stack>
          </Card>
          {!hasEnabledEvents && (
            <Card withBorder radius="md" padding="md">
              <Stack gap="sm" align="flex-start">
                <Text size="sm">{t("emptyTimeline")}</Text>
                <Button
                  component={Link}
                  href={moneyTimelineHref}
                  size="xs"
                >
                  {t("addEventsCta")}
                </Button>
              </Stack>
            </Card>
          )}

          <AutoSnapshotsCard
            snapshots={autoSnapshots}
            currency={selectedScenario.baseCurrency}
            onSelectMonth={handleSelectSnapshot}
          />
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={600}>{t("moneySummaryTitle")}</Text>
                  <Button
                    component={Link}
                    href={buildScenarioUrl("/money", selectedScenario.id)}
                    size="xs"
                    variant="light"
                  >
                    {t("moneySummaryCta")}
                  </Button>
                </Group>
                <SimpleGrid cols={2} spacing="xs">
                  {[
                    { key: "income", label: t("moneySummaryIncome") },
                    { key: "expenses", label: t("moneySummaryExpenses") },
                    { key: "assets", label: t("moneySummaryAssets") },
                    { key: "liabilities", label: t("moneySummaryLiabilities") },
                  ].map((item) => (
                    <Card key={item.key} withBorder radius="md" padding="xs">
                      <Stack gap={2}>
                        <Text size="sm" fw={600}>
                          {item.label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t("moneySummaryHint")}
                        </Text>
                      </Stack>
                    </Card>
                  ))}
                </SimpleGrid>
              </Stack>
            </Card>

            <Card withBorder radius="md" padding="md">
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={600}>{t("peopleSummaryTitle")}</Text>
                  <Button
                    component={Link}
                    href={buildScenarioUrl("/people", selectedScenario.id)}
                    size="xs"
                    variant="light"
                  >
                    {t("peopleSummaryCta")}
                  </Button>
                </Group>
                <Stack gap={4}>
                  <Text size="sm">
                    {t("peopleSummaryMembers", { count: scenarioMembers.length })}
                  </Text>
                  {upcomingMilestones.length > 0 ? (
                    <Stack gap={2}>
                      {upcomingMilestones.map((marker) => (
                        <Text key={marker.id} size="xs" c="dimmed">
                          {t("peopleSummaryMilestone", {
                            label: marker.label,
                            name: marker.memberName,
                            month: marker.month,
                          })}
                        </Text>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="xs" c="dimmed">
                      {t("peopleSummaryEmpty")}
                    </Text>
                  )}
                </Stack>
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
