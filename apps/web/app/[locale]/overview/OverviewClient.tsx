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
import { useRouter } from "next/navigation";
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
import ProjectionDetailsModal from "../../../components/ProjectionDetailsModal";
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
import { buildScenarioTimelineEvents } from "../../../src/domain/events/utils";
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
  const scenarios = useScenarioStore((state) => state.scenarios);
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const globalHorizonMonths = appSettings.globalHorizonMonths;
  const setViewModeSetting = useScenarioStore((state) => state.setViewMode);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const scenarioIdFromQuery = scenarioId ?? null;
  const [viewMode, setViewMode] = useState<"single" | "compare">("single");
  const [compareScenarioIds, setCompareScenarioIds] = useState<string[]>([]);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<string | undefined>(undefined);
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
  const compareScenarioOptions = useMemo(
    () =>
      scenarios.map((scenarioOption) => ({
        value: scenarioOption.id,
        label: scenarioOption.name,
      })),
    [scenarios]
  );

  useEffect(() => {
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
  }, [scenarios, selectedScenario, viewMode]);
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
  });
  const compareProjections = useScenarioProjections(
    scenarios,
    eventLibrary,
    compareScenarioIds,
    { horizonMonths: globalHorizonMonths, members }
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
  const computedKpis = overviewViewModel?.kpis;
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
  const snapshotTargets = useMemo(() => [5, 10, 15, 20, 30], []);
  const autoSnapshots = useMemo(() => {
    if (!projection || !selectedScenario) {
      return [];
    }
    const baseMonth = projection.baseMonth;
    const formatAge = (value: number) =>
      Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);

    return snapshotTargets
      .map((years) => {
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


  useEffect(() => {
    if (months.length === 0) {
      setCurrentMonth(undefined);
      return;
    }
    setCurrentMonth((previous) =>
      previous && months.includes(previous) ? previous : months[0]
    );
  }, [months]);

  if (!selectedScenario) {
    return null;
  }

  const showCompare = viewMode === "compare";
  const hasEnabledEvents =
    buildScenarioTimelineEvents(selectedScenario, eventLibrary).filter(
      (event) => event.enabled
    ).length > 0;

  const kpiItems = [
    {
      label: t("kpiLowestBalance"),
      value: formatCurrency(
        computedKpis?.lowestMonthlyBalance ?? 0,
        selectedScenario.baseCurrency,
        locale
      ),
      helper: t("kpiLowestBalanceHelper"),
      onDetails: projection ? () => setBreakdownOpen(true) : undefined,
      detailsLabel: t("breakdownCta"),
    },
    {
      label: t("kpiRunway"),
      value: t("kpiRunwayValue", { months: computedKpis?.runwayMonths ?? 0 }),
      helper: t("kpiRunwayHelper"),
      onDetails: projection ? () => setBreakdownOpen(true) : undefined,
      detailsLabel: t("breakdownCta"),
    },
    {
      label: t("kpiNetWorth"),
      value: formatCurrency(
        computedKpis?.netWorthYear5 ?? 0,
        selectedScenario.baseCurrency,
        locale
      ),
      helper: t("kpiNetWorthHelper"),
      onDetails: projection ? () => setBreakdownOpen(true) : undefined,
      detailsLabel: t("breakdownCta"),
    },
    {
      label: t("kpiRisk"),
      value: common(`risk${computedKpis?.riskLevel ?? "Low"}`),
      badgeLabel: common(`risk${computedKpis?.riskLevel ?? "Low"}`),
      badgeColor: riskBadgeColor[computedKpis?.riskLevel ?? "Low"],
      onDetails: projection ? () => setBreakdownOpen(true) : undefined,
      detailsLabel: t("breakdownCta"),
    },
  ];

  const handleScenarioChange = (nextScenarioId: string) => {
    setActiveScenario(nextScenarioId);
    router.push(`/${locale}${buildScenarioUrl("/overview", nextScenarioId)}`);
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
    setCurrentMonth(month);
    setBreakdownOpen(true);
  };

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
            <Button component={Link} href="/scenarios" variant="subtle">
              {t("backToScenarios")}
            </Button>
          </Group>
        </Group>

        <Stack gap="sm">
          <Group gap="sm" wrap="wrap">
            <SegmentedControl
              data={[
                { value: "single", label: t("viewSingle") },
                { value: "compare", label: t("viewCompare") },
              ]}
              value={viewMode}
              onChange={(value) => setViewMode(value as "single" | "compare")}
            />
            <SegmentedControl
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
          <Text size="xs" c="dimmed">
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
                      <Table.Th key={years}>{t("compareYearLabel", { years })}</Table.Th>
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
            <SimpleGrid cols={4} spacing="md">
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
                data={netCashflowSeries}
                markers={milestoneMarkers}
                title={t("netCashflowTitle")}
                onClick={
                  projection
                    ? () =>
                        setFullscreenChart({
                          type: "netCashflow",
                          data: netCashflowSeries,
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
                      data={netCashflowSeries}
                      markers={milestoneMarkers}
                      onClick={
                        projection
                          ? () =>
                              setFullscreenChart({
                                type: "netCashflow",
                                data: netCashflowSeries,
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
          {!hasEnabledEvents && (
            <Card withBorder radius="md" padding="md">
              <Stack gap="sm" align="flex-start">
                <Text size="sm">{t("emptyTimeline")}</Text>
                <Button
                  component={Link}
                  href={buildScenarioUrl("/timeline", selectedScenario.id)}
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
          <ProjectionDetailsModal
            opened={breakdownOpen}
            onClose={() => setBreakdownOpen(false)}
            months={months}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            ledgerByMonth={ledgerByMonth}
            summaryByMonth={summaryByMonth}
            positionCashflowsByMonth={positionCashflowsByMonth}
            projectionNetCashflowByMonth={projectionNetCashflowByMonth}
            projectionNetCashflowMode={projectionNetCashflowMode}
            netWorthByMonth={netWorthByMonth}
            netWorthBreakdownByMonth={netWorthBreakdownByMonth}
            currency={selectedScenario.baseCurrency}
            memberLookup={memberLookup}
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
