"use client";

import {
  Accordion,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CashBalanceChart from "../../features/overview/components/CashBalanceChart";
import InsightsCard from "../../features/overview/components/InsightsCard";
import KpiCard from "../../features/overview/components/KpiCard";
import KpiCarousel from "../../features/overview/components/KpiCarousel";
import NetWorthChart from "../../features/overview/components/NetWorthChart";
import OverviewActionsCard from "../../features/overview/components/OverviewActionsCard";
import ScenarioContextSelector from "../../features/overview/components/ScenarioContextSelector";
import type { RiskLevel, TimeSeriesPoint } from "../../features/overview/types";
import { formatCurrency } from "../../lib/i18n";
import {
  getScenarioById,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import {
  buildScenarioUrl,
  getScenarioIdFromSearchParams,
  resolveScenarioId,
} from "../../src/utils/scenarioContext";

const buildMonths = (startMonth: string, months: number) => {
  const [startYear, startMonthValue] = startMonth.split("-").map(Number);
  const results: string[] = [];
  let year = startYear;
  let month = startMonthValue;

  for (let index = 0; index < months; index += 1) {
    results.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return results;
};

const buildSeries = (
  startMonth: string,
  months: number,
  baseValue: number,
  trend: number,
  volatility: number,
  forcedLowIndex?: number,
  forcedLowValue?: number
) => {
  const monthsList = buildMonths(startMonth, months);
  let currentValue = baseValue;

  const series = monthsList.map((month, index) => {
    const seasonal = Math.sin(index / 2) * volatility;
    currentValue = currentValue + trend + seasonal;
    return {
      month,
      value: Math.round(currentValue),
    } satisfies TimeSeriesPoint;
  });

  if (
    typeof forcedLowIndex === "number" &&
    forcedLowIndex >= 0 &&
    forcedLowIndex < series.length &&
    typeof forcedLowValue === "number"
  ) {
    series[forcedLowIndex] = {
      ...series[forcedLowIndex],
      value: forcedLowValue,
    };
  }

  return series;
};

const buildInsights = (kpis: {
  lowestMonthlyBalance: number;
  runwayMonths: number;
  riskLevel: RiskLevel;
}) => {
  const insights: string[] = [];

  if (kpis.lowestMonthlyBalance < 0) {
    insights.push(
      "Cash balance dips below zero — consider trimming discretionary spend."
    );
  } else {
    insights.push("Cash buffer remains positive across the forecast window.");
  }

  if (kpis.runwayMonths < 12) {
    insights.push("Runway is under 12 months. Prioritize savings or reduce fixed costs.");
  } else if (kpis.runwayMonths < 24) {
    insights.push("Runway is stable but could be extended with small optimizations.");
  } else {
    insights.push("Runway comfortably exceeds 24 months, supporting growth plans.");
  }

  if (kpis.riskLevel === "High") {
    insights.push("High risk exposure detected. Stress-test expenses and income shocks.");
  }

  return insights.slice(0, 3);
};

const riskBadgeColor: Record<RiskLevel, string> = {
  Low: "green",
  Medium: "yellow",
  High: "red",
};

const scenarioSeriesById: Record<
  string,
  { cashSeries: TimeSeriesPoint[]; netWorthSeries: TimeSeriesPoint[] }
> = {
  "scenario-plan-a": {
    cashSeries: buildSeries("2024-01", 36, 32000, -1200, 3200, 8, -12000),
    netWorthSeries: buildSeries("2024-01", 36, 450000, 12000, 7000),
  },
  "scenario-plan-b": {
    cashSeries: buildSeries("2024-01", 36, 40000, -1800, 4200, 10, -32000),
    netWorthSeries: buildSeries("2024-01", 36, 520000, 15000, 9000),
  },
  "scenario-plan-c": {
    cashSeries: buildSeries("2024-01", 36, 28000, 400, 1800, 12, 8000),
    netWorthSeries: buildSeries("2024-01", 36, 380000, 10000, 6000),
  },
};

export default function OverviewPage() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const scenarioIdFromQuery = getScenarioIdFromSearchParams(searchParams);

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
    () => resolveScenarioId(searchParams, activeScenarioId, scenarios),
    [activeScenarioId, scenarios, searchParams]
  );

  const selectedScenario = getScenarioById(scenarios, resolvedScenarioId);

  const series =
    (selectedScenario && scenarioSeriesById[selectedScenario.id]) ??
    scenarioSeriesById[scenarios[0]?.id ?? ""] ?? {
      cashSeries: buildSeries("2024-01", 24, 30000, 600, 1200),
      netWorthSeries: buildSeries("2024-01", 24, 420000, 8000, 4000),
    };

  const insights = useMemo(() => {
    if (!selectedScenario) {
      return [];
    }

    return buildInsights(selectedScenario.kpis);
  }, [selectedScenario]);

  if (!selectedScenario) {
    return null;
  }

  const kpiItems = [
    {
      label: "Lowest Balance",
      value: formatCurrency(selectedScenario.kpis.lowestMonthlyBalance),
      helper: "Lowest point across forecast",
    },
    {
      label: "Runway",
      value: `${selectedScenario.kpis.runwayMonths} months`,
      helper: "Time until cash runs out",
    },
    {
      label: "5Y Net Worth",
      value: formatCurrency(selectedScenario.kpis.netWorthYear5),
      helper: "Projected net worth",
    },
    {
      label: "Risk Level",
      value: selectedScenario.kpis.riskLevel,
      badgeLabel: selectedScenario.kpis.riskLevel,
      badgeColor: riskBadgeColor[selectedScenario.kpis.riskLevel],
    },
  ];

  const handleScenarioChange = (scenarioId: string) => {
    setActiveScenario(scenarioId);
    router.push(buildScenarioUrl("/overview", scenarioId));
  };

  return (
    <Stack gap="xl" pb={isDesktop ? undefined : 120}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Title order={2}>Overview</Title>
            <Text size="sm" c="dimmed">
              Snapshot of your plan health and momentum.
            </Text>
          </div>
          <Button component={Link} href="/scenarios" variant="subtle">
            Back to Scenarios
          </Button>
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
              Change
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
          <CashBalanceChart data={series.cashSeries} title="Cash Balance" />
          <NetWorthChart data={series.netWorthSeries} title="Net Worth" />
        </SimpleGrid>
      ) : (
        <Stack gap="md">
          <CashBalanceChart data={series.cashSeries} title="Cash Balance" />
          <Accordion variant="separated" radius="md">
            <Accordion.Item value="net-worth">
              <Accordion.Control>Net Worth</Accordion.Control>
              <Accordion.Panel>
                <NetWorthChart data={series.netWorthSeries} />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      )}

      {isDesktop ? (
        <SimpleGrid cols={2} spacing="md">
          <InsightsCard insights={insights} />
          <OverviewActionsCard scenarioId={selectedScenario.id} />
        </SimpleGrid>
      ) : (
        <Stack gap="md">
          <InsightsCard insights={insights} />
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Button
                component={Link}
                href={buildScenarioUrl("/timeline", selectedScenario.id)}
              >
                Open Timeline
              </Button>
              <Button
                component={Link}
                href={buildScenarioUrl("/stress", selectedScenario.id)}
                variant="light"
              >
                Run Stress Test
              </Button>
            </Stack>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}
