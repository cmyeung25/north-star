// Shape note: Overview now consumes rent-vs-own insights derived from homes[] fees/holding costs.
// Added fields: feesOneTime + holdingCostMonthly + holdingCostAnnualGrowthPct from scenario positions.
// Back-compat: when no rent event exists, the card shows \"Rent not configured\".
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
import InsightsCard from "../../../features/overview/components/InsightsCard";
import KpiCard from "../../../features/overview/components/KpiCard";
import KpiCarousel from "../../../features/overview/components/KpiCarousel";
import NetCashflowChart from "../../../features/overview/components/NetCashflowChart";
import NetWorthChart from "../../../features/overview/components/NetWorthChart";
import OverviewActionsCard from "../../../features/overview/components/OverviewActionsCard";
import RentVsOwnCard from "../../../features/overview/components/RentVsOwnCard";
import ScenarioContextSelector from "../../../features/overview/components/ScenarioContextSelector";
import AutoSnapshotsCard from "../../../features/overview/components/AutoSnapshotsCard";
import type { RiskLevel, TimeSeriesPoint } from "../../../features/overview/types";
import { formatCurrency } from "../../../lib/i18n";
import {
  projectionToOverviewViewModel,
} from "../../../src/engine/adapter";
import { useProjectionWithLedger } from "../../../src/engine/useProjectionWithLedger";
import { useScenarioProjections } from "../../../src/engine/useScenarioProjections";
import { buildScenarioTimelineEvents } from "../../../src/domain/events/utils";
import {
  compileAllBudgetRules,
  sumByMonth,
} from "../../../src/domain/budget/compileBudgetRules";
import {
  buildExportFilename,
  downloadTextFile,
  projectionToCSV,
} from "../../../src/export/projectionExport";
import { useRentVsOwnComparison } from "../../../src/engine/rentVsOwnComparison";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { Link } from "../../../src/i18n/navigation";
import { getMemberAgeYears } from "../../../src/domain/members/age";

type OverviewClientProps = {
  scenarioId?: string;
};

type OverviewKpis = {
  lowestMonthlyBalance: number;
  runwayMonths: number;
  riskLevel: RiskLevel;
};

const buildInsights = (
  t: (key: string, values?: Record<string, string | number>) => string,
  kpis: OverviewKpis
) => {
  const insights: string[] = [];

  if (kpis.lowestMonthlyBalance < 0) {
    insights.push(t("insightNegativeCash"));
  } else {
    insights.push(t("insightPositiveCash"));
  }

  if (kpis.runwayMonths < 12) {
    insights.push(t("insightRunwayShort"));
  } else if (kpis.runwayMonths < 24) {
    insights.push(t("insightRunwayStable"));
  } else {
    insights.push(t("insightRunwayLong"));
  }

  if (kpis.riskLevel === "High") {
    insights.push(t("insightHighRisk"));
  }

  return insights.slice(0, 3);
};

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
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const globalHorizonMonths = useScenarioStore((state) => state.globalHorizonMonths);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const scenarioIdFromQuery = scenarioId ?? null;
  const [viewMode, setViewMode] = useState<"single" | "compare">("single");
  const [compareScenarioIds, setCompareScenarioIds] = useState<string[]>([]);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<string | undefined>(undefined);
  const [fullscreenChart, setFullscreenChart] = useState<{
    type: FullScreenChartType;
    data: TimeSeriesPoint[];
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
  } = useProjectionWithLedger(selectedScenario, eventLibrary);
  const compareProjections = useScenarioProjections(
    scenarios,
    eventLibrary,
    compareScenarioIds,
    { horizonMonths: globalHorizonMonths }
  );

  const overviewViewModel = useMemo(
    () => (projection ? projectionToOverviewViewModel(projection) : null),
    [projection]
  );

  const cashSeries = useMemo(
    () => overviewViewModel?.cashSeries ?? [],
    [overviewViewModel]
  );
  const netWorthSeries = useMemo(
    () => overviewViewModel?.netWorthSeries ?? [],
    [overviewViewModel]
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
  const rentVsOwn = useRentVsOwnComparison(selectedScenario, eventLibrary);
  const memberLookup = useMemo(
    () =>
      Object.fromEntries(
        (selectedScenario?.members ?? []).map((member) => [member.id, member.name])
      ),
    [selectedScenario]
  );
  const budgetTotals = useMemo(() => {
    if (!selectedScenario) {
      return [];
    }
    const ledger = compileAllBudgetRules(selectedScenario);
    return sumByMonth(ledger);
  }, [selectedScenario]);
  const budgetTotalsPreview = budgetTotals.slice(0, 12);
  const netCashflowSeries = useMemo(
    () =>
      months.map((month) => ({
        month,
        value: projectionNetCashflowByMonth?.[month] ?? 0,
      })),
    [months, projectionNetCashflowByMonth]
  );
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
        const ageLabels = (selectedScenario.members ?? []).map((member) => {
          const ageYears = Math.max(0, getMemberAgeYears(member, month, baseMonth));
          return t("snapshotAgeLabel", {
            name: member.name,
            age: formatAge(ageYears),
          });
        });
        return {
          label: t("snapshotsYearLabel", { years }),
          month,
          cash: projection.cashBalance[monthIndex] ?? 0,
          assets: projection.assets.total[monthIndex] ?? 0,
          liabilities: projection.liabilities.total[monthIndex] ?? 0,
          netWorth: projection.netWorth[monthIndex] ?? 0,
          ageLabels,
        };
      })
      .filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot));
  }, [globalHorizonMonths, projection, selectedScenario, snapshotTargets, t]);

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
      const row: Record<string, string | number> = { month };
      compareProjections.forEach((item) => {
        row[item.scenarioId] = item.projection.netWorth[index] ?? 0;
      });
      return row;
    }).filter((row) => Boolean(row.month));
  }, [compareProjections]);

  const compareKpiRows = useMemo(() => {
    return compareProjections.map((item) => {
      const horizonMonths = globalHorizonMonths;
      const netWorthByYear = snapshotTargets.map((years) => {
        const requiredMonths = years * 12;
        if (horizonMonths < requiredMonths) {
          return null;
        }
        const index = Math.min(requiredMonths - 1, item.projection.netWorth.length - 1);
        return item.projection.netWorth[index] ?? 0;
      });

      return {
        scenarioId: item.scenarioId,
        name: item.scenario.name,
        currency: item.scenario.baseCurrency,
        values: netWorthByYear,
      };
    });
  }, [compareProjections, globalHorizonMonths, snapshotTargets]);

  const insights = useMemo(() => {
    if (!computedKpis) {
      return [];
    }

    return buildInsights(t, computedKpis);
  }, [computedKpis, t]);

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
          <SegmentedControl
            data={[
              { value: "single", label: t("viewSingle") },
              { value: "compare", label: t("viewCompare") },
            ]}
            value={viewMode}
            onChange={(value) => setViewMode(value as "single" | "compare")}
          />
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
                title={t("cashBalanceTitle")}
                onClick={
                  projection
                    ? () =>
                        setFullscreenChart({
                          type: "cash",
                          data: cashSeries,
                        })
                    : undefined
                }
              />
              <NetWorthChart
                data={netWorthSeries}
                title={t("netWorthTitle")}
                onClick={
                  projection
                    ? () =>
                        setFullscreenChart({
                          type: "netWorth",
                          data: netWorthSeries,
                        })
                    : undefined
                }
              />
              <NetCashflowChart
                data={netCashflowSeries}
                title={t("netCashflowTitle")}
                onClick={
                  projection
                    ? () =>
                        setFullscreenChart({
                          type: "netCashflow",
                          data: netCashflowSeries,
                        })
                    : undefined
                }
              />
            </SimpleGrid>
          ) : (
            <Stack gap="md">
              <CashBalanceChart
                data={cashSeries}
                title={t("cashBalanceTitle")}
                onClick={
                  projection
                    ? () =>
                        setFullscreenChart({
                          type: "cash",
                          data: cashSeries,
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
                      onClick={
                        projection
                          ? () =>
                              setFullscreenChart({
                                type: "netWorth",
                                data: netWorthSeries,
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
                      onClick={
                        projection
                          ? () =>
                              setFullscreenChart({
                                type: "netCashflow",
                                data: netCashflowSeries,
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

          {isDesktop ? (
            <SimpleGrid cols={3} spacing="md">
              <InsightsCard insights={insights} />
              <RentVsOwnCard
                comparison={rentVsOwn}
                currency={selectedScenario.baseCurrency}
              />
              <OverviewActionsCard scenarioId={selectedScenario.id} />
            </SimpleGrid>
          ) : (
            <Stack gap="md">
              <InsightsCard insights={insights} />
              <RentVsOwnCard
                comparison={rentVsOwn}
                currency={selectedScenario.baseCurrency}
              />
              <Card withBorder radius="md" padding="md">
                <Stack gap="sm">
                  <Button
                    component={Link}
                    href={buildScenarioUrl("/timeline", selectedScenario.id)}
                  >
                    {t("actionsTimeline")}
                  </Button>
                  <Button
                    component={Link}
                    href={buildScenarioUrl("/stress", selectedScenario.id)}
                    variant="light"
                  >
                    {t("actionsStress")}
                  </Button>
                </Stack>
              </Card>
            </Stack>
          )}

          <Card withBorder radius="md" padding="md">
            <Stack gap="xs">
              <Text fw={600}>{t("budgetPreviewTitle")}</Text>
              <Text size="sm" c="dimmed">
                {t("budgetPreviewSubtitle")}
              </Text>
              {budgetTotalsPreview.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("budgetPreviewEmpty")}
                </Text>
              ) : (
                <Stack gap={2}>
                  {budgetTotalsPreview.map((entry) => (
                    <Text key={`budget-${entry.month}`} size="sm">
                      {entry.month} ·{" "}
                      {formatCurrency(
                        entry.totalAmountSigned,
                        selectedScenario.baseCurrency,
                        locale
                      )}
                    </Text>
                  ))}
                  {budgetTotals.length > budgetTotalsPreview.length && (
                    <Text size="xs" c="dimmed">
                      {t("budgetPreviewMore", {
                        count: budgetTotals.length - budgetTotalsPreview.length,
                      })}
                    </Text>
                  )}
                </Stack>
              )}
            </Stack>
          </Card>
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
            currency={selectedScenario.baseCurrency}
            memberLookup={memberLookup}
          />
          <FullScreenChartModal
            opened={Boolean(fullscreenChart)}
            onClose={() => setFullscreenChart(null)}
            type={fullscreenChart?.type}
            data={fullscreenChart?.data ?? []}
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
