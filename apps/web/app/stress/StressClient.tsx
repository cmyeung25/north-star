"use client";

import {
  Badge,
  Button,
  Card,
  Group,
  List,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { computeProjection } from "@north-star/engine";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ScenarioContextSelector from "../../features/overview/components/ScenarioContextSelector";
import StressCashChart from "../../features/stress/components/StressCashChart";
import { defaultCurrency, formatCurrency } from "../../lib/i18n";
import {
  mapScenarioToEngineInput,
  projectionToOverviewViewModel,
} from "../../src/engine/adapter";
import { useStressComparison } from "../../src/engine/useStressComparison";
import type { StressPreset } from "../../src/engine/stressTransforms";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import {
  buildStressEvents,
  type AppliedStressState,
} from "../../src/features/stress/stressEvents";
import { normalizeMonth } from "../../src/features/timeline/schema";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";

type StressClientProps = {
  scenarioId?: string;
};

const emptyStressState: AppliedStressState = {
  jobLossMonths: null,
  rateHikePct: null,
  medicalAmount: null,
  applyMonth: null,
};

const addMonths = (baseMonth: string, offset: number) => {
  const [year, month] = baseMonth.split("-").map(Number);
  const totalMonths = year * 12 + (month - 1) + offset;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = String((totalMonths % 12) + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}`;
};

export default function StressClient({ scenarioId }: StressClientProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const scenarioIdFromQuery = scenarioId ?? null;
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const createScenario = useScenarioStore((state) => state.createScenario);
  const upsertScenarioEvents = useScenarioStore(
    (state) => state.upsertScenarioEvents
  );
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );

  const [draftStress, setDraftStress] = useState<AppliedStressState>(
    emptyStressState
  );
  const [appliedStress, setAppliedStress] = useState<AppliedStressState>(
    emptyStressState
  );
  const [saveName, setSaveName] = useState("");
  const [activePreset, setActivePreset] = useState<StressPreset | null>(null);
  const [shockMonth, setShockMonth] = useState<string | null>(null);

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

  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const baseCurrency = scenario?.baseCurrency ?? defaultCurrency;

  const baselineInput = useMemo(() => {
    if (!scenario) {
      return null;
    }
    return mapScenarioToEngineInput(scenario);
  }, [scenario]);

  const normalizedShockMonth = useMemo(
    () => normalizeMonth(shockMonth ?? "") ?? shockMonth ?? undefined,
    [shockMonth]
  );

  const presetComparison = useStressComparison(scenario, activePreset, {
    shockMonth: normalizedShockMonth,
  });

  useEffect(() => {
    if (!scenario) {
      return;
    }

    const defaultApplyMonth =
      normalizeMonth(scenario.assumptions.baseMonth ?? "") ??
      baselineInput?.baseMonth ??
      null;
    const defaultShockMonth = baselineInput?.baseMonth
      ? addMonths(baselineInput.baseMonth, 1)
      : defaultApplyMonth;

    setSaveName(`${scenario.name} · Stress`);
    setShockMonth(defaultShockMonth);
    setDraftStress((previous) => ({
      ...previous,
      applyMonth: defaultApplyMonth,
    }));
    setAppliedStress({
      ...emptyStressState,
      applyMonth: defaultApplyMonth,
    });
  }, [baselineInput?.baseMonth, scenario]);

  const stressEvents = useMemo(() => {
    if (!scenario) {
      return [];
    }
    return buildStressEvents(appliedStress, scenario);
  }, [appliedStress, scenario]);

  const afterInput = useMemo(() => {
    if (!scenario || !baselineInput) {
      return null;
    }
    const combinedScenario = {
      ...scenario,
      events: [...(scenario.events ?? []), ...stressEvents],
    };

    return mapScenarioToEngineInput(combinedScenario, {
      baseMonth: baselineInput.baseMonth,
      horizonMonths: baselineInput.horizonMonths,
      initialCash: baselineInput.initialCash,
    });
  }, [baselineInput, scenario, stressEvents]);

  const baselineProjection = useMemo(() => {
    if (!baselineInput) {
      return null;
    }
    return computeProjection(baselineInput);
  }, [baselineInput]);

  const afterProjection = useMemo(() => {
    if (!afterInput) {
      return null;
    }
    return computeProjection(afterInput);
  }, [afterInput]);

  const baselineView = useMemo(
    () => (baselineProjection ? projectionToOverviewViewModel(baselineProjection) : null),
    [baselineProjection]
  );
  const afterView = useMemo(
    () => (afterProjection ? projectionToOverviewViewModel(afterProjection) : null),
    [afterProjection]
  );

  const applyMonthError =
    draftStress.applyMonth && !normalizeMonth(draftStress.applyMonth)
      ? "Use YYYY-MM"
      : undefined;

  const hasActiveStresses = stressEvents.length > 0;

  const insights = useMemo(() => {
    if (!afterProjection || !baselineProjection) {
      return [];
    }

    const notes: string[] = [];
    const jobLossEvent = stressEvents.find((event) =>
      event.id.startsWith("stress_jobloss")
    );

    if (afterProjection.lowestMonthlyBalance.value < 0) {
      notes.push("Cash balance drops below zero after stress is applied.");
    }

    if (afterProjection.runwayMonths < 3) {
      notes.push("Emergency runway falls below 3 months.");
    }

    if (
      hasActiveStresses &&
      afterProjection.lowestMonthlyBalance.index <
        baselineProjection.lowestMonthlyBalance.index
    ) {
      notes.push("The lowest cash month arrives sooner than the baseline plan.");
    }

    if (appliedStress.jobLossMonths && jobLossEvent?.monthlyAmount === 0) {
      notes.push("No income to offset in the selected apply month.");
    }

    if (notes.length === 0) {
      notes.push("Stress impact is muted relative to the baseline projection.");
    }

    if (notes.length < 2) {
      notes.push("Try increasing shocks to surface additional downside risks.");
    }

    return notes.slice(0, 3);
  }, [
    afterProjection,
    appliedStress.jobLossMonths,
    baselineProjection,
    hasActiveStresses,
    stressEvents,
  ]);

  const shockMonthOptions = useMemo(() => {
    if (!baselineInput?.baseMonth) {
      return [];
    }
    const horizon = Math.min(baselineInput.horizonMonths ?? 12, 24);
    return Array.from({ length: horizon }, (_, index) => {
      const value = addMonths(baselineInput.baseMonth, index);
      return { value, label: value };
    });
  }, [baselineInput?.baseMonth, baselineInput?.horizonMonths]);

  if (!scenario || !baselineView || !afterView || !baselineProjection || !afterProjection) {
    return null;
  }

  const scenarioData = scenario;
  const baselineKpis = baselineView.kpis;
  const afterKpis = afterView.kpis;
  const presetDeltas = presetComparison?.deltas ?? null;
  const presetBaselineSeries = presetComparison?.baselineView.cashSeries ?? [];
  const presetStressedSeries = presetComparison?.stressedView.cashSeries ?? [];

  const activeStressBadges = [
    appliedStress.jobLossMonths
      ? {
          key: "jobloss",
          label: `Job loss (${appliedStress.jobLossMonths}m)`,
        }
      : null,
    appliedStress.rateHikePct
      ? {
          key: "ratehike",
          label: `Rate hike (+${appliedStress.rateHikePct}%)`,
        }
      : null,
    typeof appliedStress.medicalAmount === "number" &&
    appliedStress.medicalAmount > 0
      ? {
          key: "medical",
          label: `Medical expense (${formatCurrency(
            appliedStress.medicalAmount,
            baseCurrency
          )})`,
        }
      : null,
  ].filter(Boolean) as { key: string; label: string }[];

  const handleApplyStress = () => {
    setAppliedStress({
      ...draftStress,
      applyMonth: normalizeMonth(draftStress.applyMonth ?? "") ?? draftStress.applyMonth,
    });
  };

  const handleRevertStress = () => {
    const fallbackApplyMonth =
      baselineInput?.baseMonth ??
      scenarioData.assumptions.baseMonth ??
      new Date().toISOString().slice(0, 7);

    setAppliedStress({
      ...emptyStressState,
      applyMonth: draftStress.applyMonth ?? fallbackApplyMonth,
    });
  };

  const handleSaveScenario = () => {
    const newScenario = createScenario(saveName || `${scenarioData.name} · Stress`, {
      baseCurrency: scenarioData.baseCurrency,
    });

    updateScenarioAssumptions(newScenario.id, { ...scenario.assumptions });

    const clonedEvents = (scenario.events ?? []).map((event) => ({
      ...event,
      id: `event-${nanoid(10)}`,
    }));
    const eventsToSave = [...clonedEvents, ...stressEvents];
    if (eventsToSave.length > 0) {
      upsertScenarioEvents(newScenario.id, eventsToSave);
    }

    setActiveScenario(newScenario.id);
    router.push("/scenarios");
  };

  const handleScenarioChange = (nextScenarioId: string) => {
    setActiveScenario(nextScenarioId);
    router.push(buildScenarioUrl("/stress", nextScenarioId));
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
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={600}>Stress Presets</Text>
              <Text size="sm" c="dimmed">
                Compare baseline vs. a single preset stress scenario.
              </Text>
            </div>
            {activePreset && (
              <Badge variant="light" color="red">
                {activePreset === "RATE_HIKE_2" && "Rate hike +2%"}
                {activePreset === "INCOME_DROP_20" && "Income drop -20%"}
                {activePreset === "INFLATION_PLUS_2" && "Inflation +2%"}
              </Badge>
            )}
          </Group>
          <Group gap="sm" wrap="wrap">
            <Button
              variant={activePreset === "RATE_HIKE_2" ? "filled" : "light"}
              onClick={() => setActivePreset("RATE_HIKE_2")}
            >
              Rate +2%
            </Button>
            <Button
              variant={activePreset === "INCOME_DROP_20" ? "filled" : "light"}
              onClick={() => setActivePreset("INCOME_DROP_20")}
            >
              Income -20%
            </Button>
            <Button
              variant={activePreset === "INFLATION_PLUS_2" ? "filled" : "light"}
              onClick={() => setActivePreset("INFLATION_PLUS_2")}
            >
              Inflation +2%
            </Button>
            <Button variant="default" onClick={() => setActivePreset(null)}>
              Clear
            </Button>
          </Group>
          {activePreset === "INCOME_DROP_20" && (
            <Select
              label="Shock month"
              placeholder="Select month"
              data={shockMonthOptions}
              value={shockMonth}
              onChange={(value) => setShockMonth(value)}
              allowDeselect={false}
            />
          )}
        </Stack>
      </Card>

      <Stack gap="md">
        <Text fw={600}>Preset KPI Delta</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {kpiCard(
            "Net Worth (End)",
            presetDeltas
              ? formatCurrency(
                  presetDeltas.netWorthDeltaAtHorizon,
                  baseCurrency
                )
              : "N/A",
            "Stressed minus baseline"
          )}
          {kpiCard(
            "Cash (End)",
            presetDeltas?.cashDeltaAtHorizon != null
              ? formatCurrency(
                  presetDeltas.cashDeltaAtHorizon,
                  baseCurrency
                )
              : "N/A",
            "Stressed minus baseline"
          )}
          {kpiCard(
            "Breakeven Delta",
            presetDeltas?.breakevenDeltaMonths != null
              ? `${presetDeltas.breakevenDeltaMonths} months`
              : "N/A",
            "Months until stressed meets baseline"
          )}
        </SimpleGrid>
      </Stack>

      <StressCashChart
        baseline={presetBaselineSeries}
        stressed={presetStressedSeries}
      />

      <Card withBorder radius="md" padding="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={600}>Stress Controls</Text>
              <Text size="sm" c="dimmed">
                Select stress tests and choose when they take effect.
              </Text>
            </div>
            <Group gap="xs">
              {activeStressBadges.length > 0 ? (
                activeStressBadges.map((badge) => (
                  <Badge key={badge.key} variant="light" color="red">
                    {badge.label}
                  </Badge>
                ))
              ) : (
                <Badge variant="light">No active stresses</Badge>
              )}
            </Group>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Job loss duration"
              placeholder="Select months"
              value={draftStress.jobLossMonths?.toString() ?? null}
              data={[
                { value: "3", label: "3 months" },
                { value: "6", label: "6 months" },
                { value: "12", label: "12 months" },
              ]}
              clearable
              onChange={(value) =>
                setDraftStress((previous) => ({
                  ...previous,
                  jobLossMonths: value ? (Number(value) as 3 | 6 | 12) : null,
                }))
              }
            />
            <Select
              label="Interest rate hike"
              placeholder="Select hike"
              value={draftStress.rateHikePct?.toString() ?? null}
              data={[
                { value: "0.5", label: "+0.5%" },
                { value: "1", label: "+1%" },
                { value: "2", label: "+2%" },
              ]}
              clearable
              onChange={(value) =>
                setDraftStress((previous) => ({
                  ...previous,
                  rateHikePct: value
                    ? (Number(value) as 0.5 | 1 | 2)
                    : null,
                }))
              }
            />
            <NumberInput
              label="Medical expense"
              value={draftStress.medicalAmount ?? ""}
              onChange={(value) =>
                setDraftStress((previous) => ({
                  ...previous,
                  medicalAmount:
                    typeof value === "number" ? Math.max(0, value) : null,
                }))
              }
              min={0}
              placeholder="One-time amount"
              thousandSeparator
            />
            <TextInput
              label="Apply month"
              placeholder="YYYY-MM"
              value={draftStress.applyMonth ?? ""}
              onChange={(event) =>
                setDraftStress((previous) => ({
                  ...previous,
                  applyMonth: event.currentTarget.value,
                }))
              }
              error={applyMonthError}
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="default" onClick={handleRevertStress}>
              Revert
            </Button>
            <Button variant="light" onClick={handleApplyStress}>
              {hasActiveStresses ? "Recalculate" : "Apply Stress"}
            </Button>
          </Group>
        </Stack>
      </Card>

      <Stack gap="md">
        <Text fw={600}>Baseline KPIs</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {kpiCard(
            "Lowest Balance",
            formatCurrency(baselineKpis.lowestMonthlyBalance, baseCurrency),
            "Lowest point across forecast"
          )}
          {kpiCard(
            "Runway",
            `${baselineKpis.runwayMonths} months`,
            "Time until cash runs out"
          )}
          {kpiCard(
            "5Y Net Worth",
            formatCurrency(baselineKpis.netWorthYear5, baseCurrency),
            "Projected net worth"
          )}
          {kpiCard(
            "Risk Level",
            baselineKpis.riskLevel,
            "Current risk posture"
          )}
        </SimpleGrid>
      </Stack>

      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>After Stress KPIs</Text>
          {!hasActiveStresses && (
            <Text size="sm" c="dimmed">
              No stresses applied yet.
            </Text>
          )}
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {kpiCard(
            "Lowest Balance",
            formatCurrency(afterKpis.lowestMonthlyBalance, baseCurrency),
            "After applied stress"
          )}
          {kpiCard(
            "Runway",
            `${afterKpis.runwayMonths} months`,
            "After applied stress"
          )}
          {kpiCard(
            "5Y Net Worth",
            formatCurrency(afterKpis.netWorthYear5, baseCurrency),
            "After applied stress"
          )}
          {kpiCard("Risk Level", afterKpis.riskLevel, "Stress-adjusted risk")}
        </SimpleGrid>
      </Stack>

      <StressCashChart
        baseline={baselineView.cashSeries}
        stressed={afterView.cashSeries}
      />

      <Card withBorder radius="md" padding="lg">
        <Stack gap="sm">
          <Text fw={600}>Insights</Text>
          <List spacing="xs" size="sm">
            {insights.map((insight) => (
              <List.Item key={insight}>{insight}</List.Item>
            ))}
          </List>
        </Stack>
      </Card>

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
              This will create a new scenario with the stress events applied to
              the timeline.
            </Text>
            <Button onClick={handleSaveScenario} disabled={!hasActiveStresses}>
              Save as Scenario
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
