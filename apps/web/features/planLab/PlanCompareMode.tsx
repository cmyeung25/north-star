"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import type { EventDefinition } from "../../src/domain/events/types";
import type { PlanSnapshot } from "../../src/domain/planLab/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../src/store/scenarioStore";
import { formatCurrency } from "../../lib/i18n";
import { diffPlanSnapshots } from "./diffPlanSnapshots";
import { usePlanCompareProjections } from "./usePlanCompareProjections";

type TranslateFn = (
  key: string,
  fallback: string,
  values?: Record<string, string | number>
) => string;

type PlanCompareModeProps = {
  scenario: Scenario;
  plans: PlanSnapshot[];
  planAId: string | null;
  planBId: string | null;
  onPlanAChange: (id: string | null) => void;
  onPlanBChange: (id: string | null) => void;
  onSwapPlans: () => void;
  onLoadPlan: (plan: PlanSnapshot) => void;
  displayMode: "nominal" | "real";
  deflateSeries: (series: Array<{ month: string; value: number }>) => Array<{
    month: string;
    value: number;
  }>;
  locale: string;
  eventLibrary: EventDefinition[];
  members: ScenarioMember[];
  budgetRules: BudgetRule[];
  translate: TranslateFn;
};

const mergeSeries = (
  a: Array<{ month: string; value: number }>,
  b: Array<{ month: string; value: number }>
) => {
  const map = new Map<string, { month: string; a?: number; b?: number }>();
  a.forEach((entry) => {
    map.set(entry.month, { month: entry.month, a: entry.value });
  });
  b.forEach((entry) => {
    const existing = map.get(entry.month);
    if (existing) {
      existing.b = entry.value;
    } else {
      map.set(entry.month, { month: entry.month, b: entry.value });
    }
  });
  return Array.from(map.values()).sort((left, right) =>
    left.month.localeCompare(right.month)
  );
};

const getMinCash = (projection: { months: string[]; cashBalance: number[] }) => {
  let minValue = Number.POSITIVE_INFINITY;
  let minMonth: string | null = null;
  projection.months.forEach((month, index) => {
    const value = projection.cashBalance[index] ?? 0;
    if (value < minValue) {
      minValue = value;
      minMonth = month;
    }
  });
  if (!Number.isFinite(minValue)) {
    return null;
  }
  return { value: minValue, month: minMonth };
};

export const PlanCompareMode = ({
  scenario,
  plans,
  planAId,
  planBId,
  onPlanAChange,
  onPlanBChange,
  onSwapPlans,
  onLoadPlan,
  displayMode,
  deflateSeries,
  locale,
  eventLibrary,
  members,
  budgetRules,
  translate,
}: PlanCompareModeProps) => {
  const planA = plans.find((plan) => plan.id === planAId) ?? null;
  const planB = plans.find((plan) => plan.id === planBId) ?? null;
  const options = plans.map((plan) => ({ value: plan.id, label: plan.name }));

  const { planA: planAState, planB: planBState } = usePlanCompareProjections({
    scenario,
    planA,
    planB,
    eventLibrary,
    members,
    budgetRules,
  });

  const planAOverview = planAState.result?.overview ?? null;
  const planBOverview = planBState.result?.overview ?? null;

  const planASeries = useMemo(() => {
    const series = planAOverview?.netWorthSeries ?? [];
    return displayMode === "real" ? deflateSeries(series) : series;
  }, [deflateSeries, displayMode, planAOverview]);
  const planBSeries = useMemo(() => {
    const series = planBOverview?.netWorthSeries ?? [];
    return displayMode === "real" ? deflateSeries(series) : series;
  }, [deflateSeries, displayMode, planBOverview]);

  const chartData = useMemo(() => mergeSeries(planASeries, planBSeries), [
    planASeries,
    planBSeries,
  ]);

  const diffSummary = useMemo(() => {
    if (!planA || !planB) {
      return [];
    }
    return diffPlanSnapshots(planA, planB, translate);
  }, [planA, planB, translate]);

  const baselineMismatch =
    (planA && planA.baselineRevision !== scenario.version) ||
    (planB && planB.baselineRevision !== scenario.version);

  const isLoading = planAState.status === "loading" || planBState.status === "loading";

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Stack gap="xs">
              <Text fw={600}>{translate("planLabCompareTitle", "Compare plans")}</Text>
              <Text size="sm" c="dimmed">
                {translate(
                  "planLabCompareSubtitle",
                  "Select two plans to compare their results."
                )}
              </Text>
            </Stack>
            <Group gap="xs" wrap="wrap">
              <Button size="xs" variant="default" onClick={onSwapPlans}>
                {translate("planLabCompareSwap", "Swap")}
              </Button>
              <Button
                size="xs"
                variant="light"
                onClick={() => planA && onLoadPlan(planA)}
                disabled={!planA}
              >
                {translate("planLabCompareLoadA", "Load A into editor")}
              </Button>
              <Button
                size="xs"
                variant="light"
                onClick={() => planB && onLoadPlan(planB)}
                disabled={!planB}
              >
                {translate("planLabCompareLoadB", "Load B into editor")}
              </Button>
            </Group>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <Select
              label={translate("planLabComparePlanA", "Plan A")}
              data={options}
              value={planAId}
              onChange={(value) => onPlanAChange(value ?? null)}
              placeholder={translate("planLabComparePickPlan", "Select a plan")}
            />
            <Select
              label={translate("planLabComparePlanB", "Plan B")}
              data={options}
              value={planBId}
              onChange={(value) => onPlanBChange(value ?? null)}
              placeholder={translate("planLabComparePickPlan", "Select a plan")}
            />
          </SimpleGrid>
          {baselineMismatch && (
            <Alert color="yellow" title={translate("planLabBaselineMismatch", "Baseline changed")}>
              {translate(
                "planLabBaselineMismatchDetail",
                "One or both plans were saved against an older baseline scenario."
              )}
            </Alert>
          )}
          {(planAState.result?.errors.length ?? 0) > 0 && (
            <Alert color="red" title={translate("planLabComparePlanErrorA", "Plan A error")}>
              {planAState.result?.errors[0]}
            </Alert>
          )}
          {(planBState.result?.errors.length ?? 0) > 0 && (
            <Alert color="red" title={translate("planLabComparePlanErrorB", "Plan B error")}>
              {planBState.result?.errors[0]}
            </Alert>
          )}
          {(planAState.result?.warnings.length ?? 0) > 0 && (
            <Alert color="orange" title={translate("planLabComparePlanWarningA", "Plan A warnings")}>
              <Stack gap={4}>
                {planAState.result?.warnings.map((warning, index) => (
                  <Text key={`${warning.code}-${index}`} size="sm">
                    {translate(warning.messageKey, warning.defaultMessage)}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}
          {(planBState.result?.warnings.length ?? 0) > 0 && (
            <Alert color="orange" title={translate("planLabComparePlanWarningB", "Plan B warnings")}>
              <Stack gap={4}>
                {planBState.result?.warnings.map((warning, index) => (
                  <Text key={`${warning.code}-${index}`} size="sm">
                    {translate(warning.messageKey, warning.defaultMessage)}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card withBorder radius="md" padding="md">
          <Stack gap="sm">
            <Text fw={600}>{translate("planLabCompareScorecard", "Scorecard")}</Text>
            {isLoading && <Skeleton height={120} />}
            {!isLoading && (!planA || !planB) && (
              <Text size="sm" c="dimmed">
                {translate("planLabCompareEmpty", "Select two plans to compare.")}
              </Text>
            )}
            {!isLoading && planA && planB && (
              <Stack gap="sm">
                {[
                  { label: "A", plan: planA, state: planAState },
                  { label: "B", plan: planB, state: planBState },
                ].map(({ label, plan, state }) => {
                  const projection = state.result?.projection ?? null;
                  const minCash = projection ? getMinCash(projection) : null;
                  const cashBalance = projection?.cashBalance ?? [];
                  const negativeMonths = cashBalance.filter((value) => value < 0).length;
                  const netWorthSeries = state.result?.overview?.netWorthSeries ?? [];
                  const endNetWorth = netWorthSeries.slice(-1)[0]?.value ?? null;
                  let peak = Number.NEGATIVE_INFINITY;
                  let maxDrawdown = 0;
                  netWorthSeries.forEach((point) => {
                    peak = Math.max(peak, point.value);
                    if (peak > 0) {
                      const drawdown = (peak - point.value) / peak;
                      maxDrawdown = Math.max(maxDrawdown, drawdown);
                    }
                  });
                  const drawdownLabel =
                    maxDrawdown > 0 ? `${(maxDrawdown * 100).toFixed(1)}%` : null;

                  return (
                    <Card key={plan.id} withBorder radius="md" padding="sm">
                      <Group justify="space-between" align="center">
                        <Text fw={600}>
                          {translate("planLabComparePlanLabel", "Plan {label}", { label })}
                        </Text>
                        <Badge variant="light">{plan.name}</Badge>
                      </Group>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {translate("planLabCompareMinCash", "Worst cash")}
                          </Text>
                          {minCash ? (
                            <Text size="sm">
                              {formatCurrency(minCash.value, scenario.baseCurrency, locale)}
                              {minCash.month && (
                                <Text size="xs" c="dimmed">
                                  {minCash.month}
                                </Text>
                              )}
                            </Text>
                          ) : (
                            <Text size="sm" c="dimmed">
                              {translate("planLabCompareValueUnavailable", "Unavailable")}
                            </Text>
                          )}
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {translate("planLabCompareNegativeMonths", "Negative months")}
                          </Text>
                          <Text size="sm">{negativeMonths}</Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {translate("planLabCompareEndNetWorth", "End net worth")}
                          </Text>
                          {endNetWorth != null ? (
                            <Text size="sm">
                              {formatCurrency(endNetWorth, scenario.baseCurrency, locale)}
                            </Text>
                          ) : (
                            <Text size="sm" c="dimmed">
                              {translate("planLabCompareValueUnavailable", "Unavailable")}
                            </Text>
                          )}
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">
                            {translate("planLabCompareDrawdown", "Max drawdown")}
                          </Text>
                          {drawdownLabel ? (
                            <Text size="sm">{drawdownLabel}</Text>
                          ) : (
                            <Text size="sm" c="dimmed">
                              {translate("planLabCompareValueUnavailable", "Unavailable")}
                            </Text>
                          )}
                        </Stack>
                      </SimpleGrid>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Card>
        <Card withBorder radius="md" padding="md">
          <Stack gap="sm">
            <Text fw={600}>{translate("planLabCompareChart", "Plan comparison chart")}</Text>
            {isLoading && <Skeleton height={220} />}
            {!isLoading && planA && planB && (
              <div style={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ left: 8, right: 12 }}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={72}
                      tickFormatter={(value) =>
                        formatCurrency(Number(value), undefined, locale)
                      }
                    />
                    <RechartsTooltip
                      formatter={(value) =>
                        formatCurrency(Number(value), undefined, locale)
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="a"
                      stroke="#4c6ef5"
                      strokeWidth={2}
                      dot={false}
                      name={planA?.name ?? "A"}
                    />
                    <Line
                      type="monotone"
                      dataKey="b"
                      stroke="#12b886"
                      strokeWidth={2}
                      dot={false}
                      name={planB?.name ?? "B"}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {!isLoading && (!planA || !planB) && (
              <Text size="sm" c="dimmed">
                {translate("planLabCompareEmpty", "Select two plans to compare.")}
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Text fw={600}>{translate("planLabCompareDiffTitle", "Diff summary")}</Text>
          {diffSummary.length === 0 && (
            <Text size="sm" c="dimmed">
              {translate("planLabCompareDiffEmpty", "Pick two plans to see differences.")}
            </Text>
          )}
          {diffSummary.map((line, index) => (
            <Text key={`${index}-${line}`} size="sm">
              {line}
            </Text>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
};
