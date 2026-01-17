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
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
import SnapshotsCard from "../../../features/overview/components/SnapshotsCard";
import type { RiskLevel } from "../../../features/overview/types";
import { formatCurrency } from "../../../lib/i18n";
import {
  projectionToOverviewViewModel,
} from "../../../src/engine/adapter";
import { useProjectionWithLedger } from "../../../src/engine/useProjectionWithLedger";
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
  type ProjectionSnapshot,
} from "../../../src/store/scenarioStore";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { Link } from "../../../src/i18n/navigation";
import { nanoid } from "nanoid";

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
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const addSnapshot = useScenarioStore((state) => state.addSnapshot);
  const removeSnapshot = useScenarioStore((state) => state.removeSnapshot);
  const scenarioIdFromQuery = scenarioId ?? null;
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<string | undefined>(undefined);

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
  const {
    projection,
    months,
    ledgerByMonth,
    summaryByMonth,
    projectionNetCashflowByMonth,
    projectionNetCashflowMode,
  } = useProjectionWithLedger(selectedScenario, eventLibrary);

  const overviewViewModel = useMemo(
    () => (projection ? projectionToOverviewViewModel(projection) : null),
    [projection]
  );

  const cashSeries = overviewViewModel?.cashSeries ?? [];
  const netWorthSeries = overviewViewModel?.netWorthSeries ?? [];
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
  const snapshots = selectedScenario?.snapshots ?? [];

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

  const createSnapshotForProjection = (
    projectionData: NonNullable<typeof projection>,
    monthIndex: number,
    label: string
  ): ProjectionSnapshot | null => {
    if (monthIndex < 0 || monthIndex >= projectionData.months.length) {
      return null;
    }

    return {
      id: `snapshot-${nanoid(8)}`,
      label,
      monthIndex,
      cash: projectionData.cashBalance[monthIndex] ?? 0,
      assets: projectionData.assets.total[monthIndex] ?? 0,
      liabilities: projectionData.liabilities.total[monthIndex] ?? 0,
      netWorth: projectionData.netWorth[monthIndex] ?? 0,
    };
  };

  const presetSnapshots = [
    { label: t("snapshotsPresetLabel", { years: 5 }), monthIndex: 60 },
    { label: t("snapshotsPresetLabel", { years: 10 }), monthIndex: 120 },
    { label: t("snapshotsPresetLabel", { years: 15 }), monthIndex: 180 },
    { label: t("snapshotsPresetLabel", { years: 20 }), monthIndex: 240 },
    { label: t("snapshotsPresetLabel", { years: 30 }), monthIndex: 360 },
  ].map((preset) => ({
    ...preset,
    disabled:
      !projection ||
      preset.monthIndex >= months.length ||
      snapshots.some((snapshot) => snapshot.monthIndex === preset.monthIndex),
  }));

  const handleAddSnapshot = (preset: { label: string; monthIndex: number }) => {
    if (!projection || !selectedScenario) {
      return;
    }
    const snapshot = createSnapshotForProjection(
      projection,
      preset.monthIndex,
      preset.label
    );
    if (!snapshot) {
      return;
    }
    addSnapshot(selectedScenario.id, snapshot);
  };

  const handleDeleteSnapshot = (snapshotId: string) => {
    if (!selectedScenario) {
      return;
    }
    removeSnapshot(selectedScenario.id, snapshotId);
  };

  const sanitizeFilenamePart = (value: string) =>
    value
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "");

  const buildSnapshotFilename = (ext: "csv" | "json") => {
    const scenarioName = sanitizeFilenamePart(selectedScenario?.name || "scenario");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${scenarioName}_snapshots_${timestamp}.${ext}`;
  };

  const handleExportSnapshotsJson = () => {
    if (!selectedScenario) {
      return;
    }
    const payload = {
      scenarioId: selectedScenario.id,
      scenarioName: selectedScenario.name,
      baseCurrency: selectedScenario.baseCurrency,
      snapshots: snapshots.map((snapshot) => ({
        ...snapshot,
        month: months[snapshot.monthIndex] ?? null,
      })),
    };
    downloadTextFile(
      buildSnapshotFilename("json"),
      "application/json;charset=utf-8",
      JSON.stringify(payload, null, 2)
    );
  };

  const csvEscape = (value: string) =>
    /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  const handleExportSnapshotsCsv = () => {
    if (!selectedScenario) {
      return;
    }
    const header = [
      "label",
      "month",
      "monthIndex",
      "cash",
      "assets",
      "liabilities",
      "netWorth",
    ];
    const rows = snapshots.map((snapshot) =>
      [
        snapshot.label,
        months[snapshot.monthIndex] ?? "",
        snapshot.monthIndex,
        snapshot.cash,
        snapshot.assets,
        snapshot.liabilities,
        snapshot.netWorth,
      ]
        .map((value) => csvEscape(String(value)))
        .join(",")
    );
    downloadTextFile(
      buildSnapshotFilename("csv"),
      "text/csv;charset=utf-8",
      [header.join(","), ...rows].join("\n")
    );
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
                <Button variant="light" disabled={!projection}>
                  {exportT("export")}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={handleExportCsv} disabled={!projection}>
                  {exportT("exportCsv")}
                </Menu.Item>
                <Menu.Item onClick={handleExportJson} disabled={!projection}>
                  {exportT("exportJson")}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button component={Link} href="/scenarios" variant="subtle">
              {t("backToScenarios")}
            </Button>
          </Group>
        </Group>

        {isDesktop ? (
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
            onClick={projection ? () => setBreakdownOpen(true) : undefined}
          />
          <NetWorthChart
            data={netWorthSeries}
            title={t("netWorthTitle")}
            onClick={projection ? () => setBreakdownOpen(true) : undefined}
          />
          <NetCashflowChart
            data={netCashflowSeries}
            title={t("netCashflowTitle")}
            onClick={projection ? () => setBreakdownOpen(true) : undefined}
          />
        </SimpleGrid>
      ) : (
        <Stack gap="md">
          <CashBalanceChart
            data={cashSeries}
            title={t("cashBalanceTitle")}
            onClick={projection ? () => setBreakdownOpen(true) : undefined}
          />
          <Accordion variant="separated" radius="md">
            <Accordion.Item value="net-worth">
              <Accordion.Control>{t("netWorthTitle")}</Accordion.Control>
              <Accordion.Panel>
                <NetWorthChart
                  data={netWorthSeries}
                  onClick={projection ? () => setBreakdownOpen(true) : undefined}
                />
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="net-cashflow">
              <Accordion.Control>{t("netCashflowTitle")}</Accordion.Control>
              <Accordion.Panel>
                <NetCashflowChart
                  data={netCashflowSeries}
                  onClick={projection ? () => setBreakdownOpen(true) : undefined}
                />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      )}

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
      <SnapshotsCard
        snapshots={snapshots}
        months={months}
        currency={selectedScenario.baseCurrency}
        presets={presetSnapshots}
        onAddSnapshot={handleAddSnapshot}
        onDeleteSnapshot={handleDeleteSnapshot}
        onExportCsv={handleExportSnapshotsCsv}
        onExportJson={handleExportSnapshotsJson}
      />
      <ProjectionDetailsModal
        opened={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        months={months}
        currentMonth={currentMonth}
        onMonthChange={setCurrentMonth}
        ledgerByMonth={ledgerByMonth}
        summaryByMonth={summaryByMonth}
        projectionNetCashflowByMonth={projectionNetCashflowByMonth}
        projectionNetCashflowMode={projectionNetCashflowMode}
        netWorthByMonth={netWorthByMonth}
        currency={selectedScenario.baseCurrency}
        memberLookup={memberLookup}
      />
    </Stack>
  );
}
