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
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import CashBalanceChart from "../../features/overview/components/CashBalanceChart";
import InsightsCard from "../../features/overview/components/InsightsCard";
import KpiCard from "../../features/overview/components/KpiCard";
import KpiCarousel from "../../features/overview/components/KpiCarousel";
import NetWorthChart from "../../features/overview/components/NetWorthChart";
import OverviewActionsCard from "../../features/overview/components/OverviewActionsCard";
import ScenarioContextSelector from "../../features/overview/components/ScenarioContextSelector";
import type { OverviewKpis, RiskLevel, TimeSeriesPoint } from "../../features/overview/types";
import { formatCurrency } from "../../lib/i18n";

type OverviewScenario = {
  id: string;
  name: string;
  kpis: OverviewKpis;
  cashSeries: TimeSeriesPoint[];
  netWorthSeries: TimeSeriesPoint[];
  insights: string[];
  isActive: boolean;
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

const buildInsights = (kpis: OverviewKpis) => {
  const insights: string[] = [];

  if (kpis.lowestMonthlyBalance < 0) {
    insights.push("Cash balance dips below zero — consider trimming discretionary spend.");
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

const createScenario = (
  scenario: Omit<OverviewScenario, "insights">
): OverviewScenario => ({
  ...scenario,
  insights: buildInsights(scenario.kpis),
});

const mockedScenarios: OverviewScenario[] = [
  createScenario({
    id: "scenario-1",
    name: "Plan A · Rent + Baby",
    kpis: {
      lowestMonthlyBalance: -12000,
      runwayMonths: 18,
      netWorthYear5: 1650000,
      riskLevel: "Medium",
    },
    cashSeries: buildSeries("2024-01", 36, 32000, -1200, 3200, 8, -12000),
    netWorthSeries: buildSeries("2024-01", 36, 450000, 12000, 7000),
    isActive: true,
  }),
  createScenario({
    id: "scenario-2",
    name: "Plan B · Buy Home",
    kpis: {
      lowestMonthlyBalance: -32000,
      runwayMonths: 10,
      netWorthYear5: 2100000,
      riskLevel: "High",
    },
    cashSeries: buildSeries("2024-01", 36, 40000, -1800, 4200, 10, -32000),
    netWorthSeries: buildSeries("2024-01", 36, 520000, 15000, 9000),
    isActive: false,
  }),
  createScenario({
    id: "scenario-3",
    name: "Plan C · Delay Car",
    kpis: {
      lowestMonthlyBalance: 8000,
      runwayMonths: 24,
      netWorthYear5: 1350000,
      riskLevel: "Low",
    },
    cashSeries: buildSeries("2024-01", 36, 28000, 400, 1800, 12, 8000),
    netWorthSeries: buildSeries("2024-01", 36, 380000, 10000, 6000),
    isActive: false,
  }),
];

export default function OverviewPage() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const searchParams = useSearchParams();
  const scenarioIdFromQuery = searchParams.get("scenarioId");

  const activeScenario = useMemo(
    () => mockedScenarios.find((scenario) => scenario.isActive) ?? mockedScenarios[0],
    []
  );

  const initialScenarioId = useMemo(() => {
    const byQuery = mockedScenarios.find((scenario) => scenario.id === scenarioIdFromQuery);
    return byQuery?.id ?? activeScenario?.id ?? mockedScenarios[0]?.id ?? "";
  }, [activeScenario, scenarioIdFromQuery]);

  const [selectedScenarioId, setSelectedScenarioId] = useState(initialScenarioId);

  const selectedScenario = useMemo(() => {
    return (
      mockedScenarios.find((scenario) => scenario.id === selectedScenarioId) ??
      activeScenario ??
      mockedScenarios[0]
    );
  }, [activeScenario, selectedScenarioId]);

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
            options={mockedScenarios.map((scenario) => ({
              label: scenario.name,
              value: scenario.id,
            }))}
            value={selectedScenarioId}
            onChange={setSelectedScenarioId}
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
          <CashBalanceChart data={selectedScenario.cashSeries} title="Cash Balance" />
          <NetWorthChart data={selectedScenario.netWorthSeries} title="Net Worth" />
        </SimpleGrid>
      ) : (
        <Stack gap="md">
          <CashBalanceChart data={selectedScenario.cashSeries} title="Cash Balance" />
          <Accordion variant="separated" radius="md">
            <Accordion.Item value="net-worth">
              <Accordion.Control>Net Worth</Accordion.Control>
              <Accordion.Panel>
                <NetWorthChart data={selectedScenario.netWorthSeries} />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      )}

      {isDesktop ? (
        <SimpleGrid cols={2} spacing="md">
          <InsightsCard insights={selectedScenario.insights} />
          <OverviewActionsCard scenarioId={selectedScenario.id} />
        </SimpleGrid>
      ) : (
        <Stack gap="md">
          <InsightsCard insights={selectedScenario.insights} />
          <Card withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Button component={Link} href={`/timeline?scenarioId=${selectedScenario.id}`}>
                Open Timeline
              </Button>
              <Button
                component={Link}
                href={`/stress?scenarioId=${selectedScenario.id}`}
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
