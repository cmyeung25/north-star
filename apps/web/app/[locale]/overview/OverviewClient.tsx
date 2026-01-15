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
import { computeProjection } from "@north-star/engine";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import CashBalanceChart from "../../features/overview/components/CashBalanceChart";
import InsightsCard from "../../features/overview/components/InsightsCard";
import KpiCard from "../../features/overview/components/KpiCard";
import KpiCarousel from "../../features/overview/components/KpiCarousel";
import NetWorthChart from "../../features/overview/components/NetWorthChart";
import OverviewActionsCard from "../../features/overview/components/OverviewActionsCard";
import RentVsOwnCard from "../../features/overview/components/RentVsOwnCard";
import ScenarioContextSelector from "../../features/overview/components/ScenarioContextSelector";
import type { RiskLevel } from "../../features/overview/types";
import { formatCurrency } from "../../lib/i18n";
import {
  mapScenarioToEngineInput,
  projectionToOverviewViewModel,
} from "../../src/engine/adapter";
import {
  buildExportFilename,
  downloadTextFile,
  projectionToCSV,
} from "../../src/export/projectionExport";
import { useRentVsOwnComparison } from "../../src/engine/rentVsOwnComparison";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import { Link } from "../../src/i18n/navigation";

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
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const scenarioIdFromQuery = scenarioId ?? null;

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

  const projection = useMemo(() => {
    if (!selectedScenario) {
      return null;
    }
    const input = mapScenarioToEngineInput(selectedScenario);
    return computeProjection(input);
  }, [selectedScenario]);

  const overviewViewModel = useMemo(
    () => (projection ? projectionToOverviewViewModel(projection) : null),
    [projection]
  );

  const cashSeries = overviewViewModel?.cashSeries ?? [];
  const netWorthSeries = overviewViewModel?.netWorthSeries ?? [];
  const computedKpis = overviewViewModel?.kpis;
  const rentVsOwn = useRentVsOwnComparison(selectedScenario);

  const insights = useMemo(() => {
    if (!computedKpis) {
      return [];
    }

    return buildInsights(t, computedKpis);
  }, [computedKpis, t]);

  if (!selectedScenario) {
    return null;
  }

  const hasEnabledEvents =
    (selectedScenario.events ?? []).filter((event) => event.enabled).length > 0;

  const kpiItems = [
    {
      label: t("kpiLowestBalance"),
      value: formatCurrency(
        computedKpis?.lowestMonthlyBalance ?? 0,
        selectedScenario.baseCurrency,
        locale
      ),
      helper: t("kpiLowestBalanceHelper"),
    },
    {
      label: t("kpiRunway"),
      value: t("kpiRunwayValue", { months: computedKpis?.runwayMonths ?? 0 }),
      helper: t("kpiRunwayHelper"),
    },
    {
      label: t("kpiNetWorth"),
      value: formatCurrency(
        computedKpis?.netWorthYear5 ?? 0,
        selectedScenario.baseCurrency,
        locale
      ),
      helper: t("kpiNetWorthHelper"),
    },
    {
      label: t("kpiRisk"),
      value: common(`risk${computedKpis?.riskLevel ?? "Low"}`),
      badgeLabel: common(`risk${computedKpis?.riskLevel ?? "Low"}`),
      badgeColor: riskBadgeColor[computedKpis?.riskLevel ?? "Low"],
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
        <SimpleGrid cols={2} spacing="md">
          <CashBalanceChart data={cashSeries} title={t("cashBalanceTitle")} />
          <Stack gap="xs">
            <NetWorthChart data={netWorthSeries} title={t("netWorthTitle")} />
          </Stack>
        </SimpleGrid>
      ) : (
        <Stack gap="md">
          <CashBalanceChart data={cashSeries} title={t("cashBalanceTitle")} />
          <Accordion variant="separated" radius="md">
            <Accordion.Item value="net-worth">
              <Accordion.Control>{t("netWorthTitle")}</Accordion.Control>
              <Accordion.Panel>
                <NetWorthChart data={netWorthSeries} />
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
    </Stack>
  );
}
