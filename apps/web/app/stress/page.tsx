"use client";

import {
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ScenarioContextSelector from "../../features/overview/components/ScenarioContextSelector";
import { formatCurrency } from "../../lib/i18n";
import {
  getScenarioById,
  useScenarioStore,
  type ScenarioKpis,
} from "../../src/store/scenarioStore";
import {
  buildScenarioUrl,
  getScenarioIdFromSearchParams,
  resolveScenarioId,
} from "../../src/utils/scenarioContext";

const formatRisk = (risk: ScenarioKpis["riskLevel"]) => risk;

const buildStressedKpis = (
  baseline: ScenarioKpis,
  expenseIncreasePct: number,
  incomeDropPct: number
): ScenarioKpis => {
  const stressFactor = expenseIncreasePct + incomeDropPct;
  const balanceDelta = Math.round(
    Math.abs(baseline.lowestMonthlyBalance) * (expenseIncreasePct / 100)
  );
  const netWorthDelta = Math.round(
    baseline.netWorthYear5 * (stressFactor / 100)
  );
  const runwayReduction = Math.ceil(stressFactor / 5);

  let riskLevel: ScenarioKpis["riskLevel"] = baseline.riskLevel;
  if (stressFactor >= 18) {
    riskLevel = "High";
  } else if (stressFactor >= 8) {
    riskLevel = baseline.riskLevel === "Low" ? "Medium" : baseline.riskLevel;
  }

  return {
    lowestMonthlyBalance: baseline.lowestMonthlyBalance - balanceDelta,
    runwayMonths: Math.max(1, baseline.runwayMonths - runwayReduction),
    netWorthYear5: Math.max(0, baseline.netWorthYear5 - netWorthDelta),
    riskLevel,
  };
};

export default function StressPage() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioIdFromQuery = getScenarioIdFromSearchParams(searchParams);
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const createScenario = useScenarioStore((state) => state.createScenario);
  const updateScenarioKpis = useScenarioStore((state) => state.updateScenarioKpis);
  const upsertScenarioEvents = useScenarioStore(
    (state) => state.upsertScenarioEvents
  );

  const [expenseIncreasePct, setExpenseIncreasePct] = useState(8);
  const [incomeDropPct, setIncomeDropPct] = useState(4);
  const [stressApplied, setStressApplied] = useState(false);
  const [saveName, setSaveName] = useState("");

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

  const scenario = getScenarioById(scenarios, resolvedScenarioId);

  useEffect(() => {
    if (scenario) {
      setSaveName(`Stressed ${scenario.name}`);
    }
  }, [scenario]);

  const stressedKpis = useMemo(() => {
    if (!scenario) {
      return null;
    }

    return buildStressedKpis(
      scenario.kpis,
      expenseIncreasePct,
      incomeDropPct
    );
  }, [expenseIncreasePct, incomeDropPct, scenario]);

  if (!scenario || !stressedKpis) {
    return null;
  }

  const handleApplyStress = () => {
    setStressApplied(true);
  };

  const handleSaveScenario = () => {
    const newScenario = createScenario(saveName || `Stressed ${scenario.name}`);
    if (scenario.events && scenario.events.length > 0) {
      const clonedEvents = scenario.events.map((event) => ({
        ...event,
        id: `event-${nanoid(10)}`,
      }));
      upsertScenarioEvents(newScenario.id, clonedEvents);
    }

    updateScenarioKpis(newScenario.id, stressedKpis);
    setActiveScenario(newScenario.id);
    router.push("/scenarios");
  };

  const handleScenarioChange = (scenarioId: string) => {
    setActiveScenario(scenarioId);
    router.push(buildScenarioUrl("/stress", scenarioId));
  };

  const kpiCard = (label: string, value: string, helper: string) => (
    <Card withBorder radius="md" padding="md">
      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text fw={600} size="lg">
          {value}
        </Text>
        <Text size="xs" c="dimmed">
          {helper}
        </Text>
      </Stack>
    </Card>
  );

  return (
    <Stack gap="xl" pb={isDesktop ? undefined : 120}>
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Title order={2}>Stress Test</Title>
            <Text size="sm" c="dimmed">
              Apply downside shocks to see how the plan reacts.
            </Text>
          </div>
        </Group>

        {isDesktop ? (
          <ScenarioContextSelector
            options={scenarios.map((scenarioOption) => ({
              label: scenarioOption.name,
              value: scenarioOption.id,
            }))}
            value={scenario.id}
            onChange={handleScenarioChange}
          />
        ) : (
          <Group gap="xs">
            <Badge variant="light" color="indigo">
              {scenario.name}
            </Badge>
            <Button
              variant="subtle"
              size="xs"
              onClick={() => router.push("/scenarios")}
            >
              Change
            </Button>
          </Group>
        )}
      </Stack>

      <Card withBorder radius="md" padding="lg">
        <Stack gap="md">
          <Text fw={600}>Stress Controls</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <NumberInput
              label="Expense increase (%)"
              value={expenseIncreasePct}
              onChange={(value) => setExpenseIncreasePct(Number(value ?? 0))}
              min={0}
              max={50}
            />
            <NumberInput
              label="Income drop (%)"
              value={incomeDropPct}
              onChange={(value) => setIncomeDropPct(Number(value ?? 0))}
              min={0}
              max={50}
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="light" onClick={handleApplyStress}>
              {stressApplied ? "Recalculate" : "Apply Stress"}
            </Button>
          </Group>
        </Stack>
      </Card>

      <Stack gap="md">
        <Text fw={600}>Baseline KPIs</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {kpiCard(
            "Lowest Balance",
            formatCurrency(scenario.kpis.lowestMonthlyBalance),
            "Lowest point across forecast"
          )}
          {kpiCard(
            "Runway",
            `${scenario.kpis.runwayMonths} months`,
            "Time until cash runs out"
          )}
          {kpiCard(
            "5Y Net Worth",
            formatCurrency(scenario.kpis.netWorthYear5),
            "Projected net worth"
          )}
          {kpiCard(
            "Risk Level",
            formatRisk(scenario.kpis.riskLevel),
            "Current risk posture"
          )}
        </SimpleGrid>
      </Stack>

      <Stack gap="md">
        <Text fw={600}>Stressed KPIs</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {kpiCard(
            "Lowest Balance",
            formatCurrency(stressedKpis.lowestMonthlyBalance),
            "After applied stress"
          )}
          {kpiCard(
            "Runway",
            `${stressedKpis.runwayMonths} months`,
            "After applied stress"
          )}
          {kpiCard(
            "5Y Net Worth",
            formatCurrency(stressedKpis.netWorthYear5),
            "After applied stress"
          )}
          {kpiCard(
            "Risk Level",
            formatRisk(stressedKpis.riskLevel),
            "Stress-adjusted risk"
          )}
        </SimpleGrid>
      </Stack>

      <Card withBorder radius="md" padding="lg">
        <Stack gap="md">
          <Text fw={600}>Save as Scenario</Text>
          <TextInput
            label="Scenario name"
            value={saveName}
            onChange={(event) => setSaveName(event.currentTarget.value)}
          />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              This will create a new scenario with stressed KPIs and any existing
              timeline events.
            </Text>
            <Button onClick={handleSaveScenario}>Save as Scenario</Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
