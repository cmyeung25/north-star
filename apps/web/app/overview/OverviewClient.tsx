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
import { computeProjection } from "@north-star/engine";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  mapScenarioToEngineInput,
  projectionToOverviewViewModel,
} from "../../src/engine/adapter";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";

type OverviewClientProps = {
  scenarioId?: string;
};

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
  { netWorthSeries: TimeSeriesPoint[] }
> = {
  "scenario-plan-a": {
    netWorthSeries: buildSeries("2024-01", 36, 450000, 12000, 7000),
  },
  "scenario-plan-b": {
    netWorthSeries: buildSeries("2024-01", 36, 520000, 15000, 9000),
  },
  "scenario-plan-c": {
    netWorthSeries: buildSeries("2024-01", 36, 380000, 10000, 6000),
  },
};

export default function OverviewClient({ scenarioId }: OverviewClientProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
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

  const series =
    (selectedScenario && scenarioSeriesById[selectedScenario.id]) ??
    scenarioSeriesById[scenarios[0]?.id ?? ""] ?? {
      netWorthSeries: buildSeries("2024-01", 24, 420000, 8000, 4000),
    };

  const cashSeries = overviewViewModel?.cashSeries ?? [];
  const computedKpis = overviewViewModel?.kpis;

  const insights = useMemo(() => {
    if (!computedKpis) {
      return [];
    }

    return buildInsights(computedKpis);
  }, [computedKpis]);

  if (!selectedScenario) {
    return null;
  }

  const hasEnabledEvents =
    (selectedScenario.events ?? []).filter((event) => event.enabled).length > 0;

  const kpiItems = [
    {
      label: "Lowest Balance",
      value: formatCurrency(computedKpis?.lowestMonthlyBalance ?? 0),
      helper: "Lowest point across forecast",
    },
    {
      label: "Runway",
      value: `${computedKpis?.runwayMonths ?? 0} months`,
      helper: "Time until cash runs out",
    },
    {
      label: "5Y Net Worth",
      value: formatCurrency(computedKpis?.netWorthYear5 ?? 0),
      helper: "Projected net worth",
    },
    {
      label: "Risk Level",
      value: computedKpis?.riskLevel ?? "Low",
      badgeLabel: computedKpis?.riskLevel ?? "Low",
      badgeColor: riskBadgeColor[computedKpis?.riskLevel ?? "Low"],
    },
  ];

  const handleScenarioChange = (nextScenarioId: string) => {
    setActiveScenario(nextScenarioId);
    router.push(buildScenarioUrl("/overview", nextScenarioId));
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
          <CashBalanceChart data={cashSeries} title="Cash Balance" />
          <Stack gap="xs">
            <NetWorthChart data={series.netWorthSeries} title="Net Worth" />
            <Text size="xs" c="dimmed">
              Net worth projection will be improved in later versions.
            </Text>
          </Stack>
        </SimpleGrid>
      ) : (
        <Stack gap="md">
          <CashBalanceChart data={cashSeries} title="Cash Balance" />
          <Accordion variant="separated" radius="md">
            <Accordion.Item value="net-worth">
              <Accordion.Control>Net Worth</Accordion.Control>
              <Accordion.Panel>
                <NetWorthChart data={series.netWorthSeries} />
                <Text size="xs" c="dimmed" mt="xs">
                  Net worth projection will be improved in later versions.
                </Text>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      )}

      {!hasEnabledEvents && (
        <Card withBorder radius="md" padding="md">
          <Stack gap="sm" align="flex-start">
            <Text size="sm">Add events in Timeline to see your projection.</Text>
            <Button
              component={Link}
              href={buildScenarioUrl("/timeline", selectedScenario.id)}
              size="xs"
            >
              Add Events
            </Button>
          </Stack>
        </Card>
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
