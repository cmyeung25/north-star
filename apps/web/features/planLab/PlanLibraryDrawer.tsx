"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Menu,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import type { EventDefinition } from "../../src/domain/events/types";
import type { Plan } from "../../src/domain/planLab/types";
import type { BudgetRule, Scenario, ScenarioMember } from "../../src/store/scenarioStore";
import { formatCurrency } from "../../lib/i18n";
import { computeCashRiskScorecard } from "../../src/domain/planLab/scorecard/cashRisk";
import { getProjectionForPlanSnapshot } from "./planLabPlans";

type TranslateFn = (
  key: string,
  fallback: string,
  values?: Record<string, string | number>
) => string;

type PlanMetric = {
  minCash?: { amount: number; month: string } | null;
  status?: "safe" | "bust";
  isLoading?: boolean;
  error?: string | null;
};

type PlanLibraryDrawerProps = {
  opened: boolean;
  onClose: () => void;
  scenario: Scenario;
  plans: Plan[];
  locale: string;
  eventLibrary: EventDefinition[];
  members: ScenarioMember[];
  budgetRules: BudgetRule[];
  translate: TranslateFn;
  onLoadPlan: (plan: Plan) => void;
  onSetPlanA: (plan: Plan) => void;
  onSetPlanB: (plan: Plan) => void;
  onDuplicatePlan: (plan: Plan) => void;
  onDeletePlan: (plan: Plan) => void;
};

const computePlanMetric = (
  plan: Plan,
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  members: ScenarioMember[],
  budgetRules: BudgetRule[]
): PlanMetric => {
  const result = getProjectionForPlanSnapshot(
    plan.snapshot,
    scenario,
    eventLibrary,
    members,
    budgetRules
  );
  if (!result.projection || result.errors.length > 0) {
    return {
      error: result.errors[0] ?? "Unable to compute.",
    };
  }
  const projection = result.projection;
  const cashSeries =
    projection.months.map((month, index) => ({
      month,
      value: projection.cashBalance[index] ?? 0,
    })) ?? [];
  const scorecard = computeCashRiskScorecard({ cashSeries });
  const minCash = scorecard.minCash
    ? { amount: scorecard.minCash.amount, month: scorecard.minCash.month }
    : null;
  return {
    minCash,
    status: scorecard.flags.belowZero ? "bust" : "safe",
  };
};

export const PlanLibraryDrawer = ({
  opened,
  onClose,
  scenario,
  plans,
  locale,
  eventLibrary,
  members,
  budgetRules,
  translate,
  onLoadPlan,
  onSetPlanA,
  onSetPlanB,
  onDuplicatePlan,
  onDeletePlan,
}: PlanLibraryDrawerProps) => {
  const [metrics, setMetrics] = useState<Record<string, PlanMetric>>({});

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => b.updatedAt - a.updatedAt),
    [plans]
  );

  useEffect(() => {
    if (!opened) {
      return;
    }
    const pending = sortedPlans.slice(0, 5).filter((plan) => !metrics[plan.id]);
    if (pending.length === 0) {
      return;
    }
    pending.forEach((plan) => {
      setMetrics((current) => ({
        ...current,
        [plan.id]: { isLoading: true },
      }));
      const metric = computePlanMetric(
        plan,
        scenario,
        eventLibrary,
        members,
        budgetRules
      );
      setMetrics((current) => ({
        ...current,
        [plan.id]: { ...metric, isLoading: false },
      }));
    });
  }, [budgetRules, eventLibrary, members, metrics, opened, scenario, sortedPlans]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={translate("planLabPlanLibraryTitle", "Plan Library")}
    >
      <Stack gap="sm">
        {sortedPlans.length === 0 && (
          <Text size="sm" c="dimmed">
            {translate("planLabPlanLibraryEmpty", "No plans saved yet.")}
          </Text>
        )}
        {sortedPlans.map((plan) => {
          const metric = metrics[plan.id];
          const badgeColor = metric?.status === "bust" ? "red" : "teal";
          const baselineMismatch =
            plan.baseScenarioVersion !== undefined &&
            plan.baseScenarioVersion !== scenario.version;
          return (
            <Card key={plan.id} withBorder radius="md" padding="sm">
              <Stack gap="xs">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Text fw={600}>{plan.name}</Text>
                    <Text size="xs" c="dimmed">
                      {translate("planLabPlanUpdatedAt", "Updated {date}", {
                        date: new Date(plan.updatedAt).toLocaleDateString(locale),
                      })}
                    </Text>
                  </Stack>
                  <Menu withinPortal shadow="md" position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle" size="sm" aria-label="Plan actions">
                        •••
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item onClick={() => onLoadPlan(plan)}>
                        {translate("planLabPlanLoad", "Load into editor")}
                      </Menu.Item>
                      <Menu.Item onClick={() => onSetPlanA(plan)}>
                        {translate("planLabPlanSetA", "Set as Plan A")}
                      </Menu.Item>
                      <Menu.Item onClick={() => onSetPlanB(plan)}>
                        {translate("planLabPlanSetB", "Set as Plan B")}
                      </Menu.Item>
                      <Menu.Item onClick={() => onDuplicatePlan(plan)}>
                        {translate("planLabPlanDuplicate", "Duplicate")}
                      </Menu.Item>
                      <Menu.Item
                        color="red"
                        onClick={() => {
                          const confirmed = window.confirm(
                            translate(
                              "planLabPlanDeleteConfirm",
                              "Delete this plan? This cannot be undone."
                            )
                          );
                          if (confirmed) {
                            onDeletePlan(plan);
                          }
                        }}
                      >
                        {translate("planLabPlanDelete", "Delete")}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
                {baselineMismatch && (
                  <Badge color="yellow" variant="light">
                    {translate(
                      "planLabPlanBaselineMismatch",
                      "Baseline changed since save"
                    )}
                  </Badge>
                )}
                <Group justify="space-between" align="center">
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {translate("planLabPlanMinCash", "Min cash")}
                    </Text>
                    {metric?.isLoading ? (
                      <Skeleton height={14} width={120} />
                    ) : metric?.minCash ? (
                      <Stack gap={2}>
                        <Text size="sm">
                          {formatCurrency(metric.minCash.amount, scenario.baseCurrency, locale)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {metric.minCash.month}
                        </Text>
                      </Stack>
                    ) : metric?.error ? (
                      <Text size="xs" c="red">
                        {metric.error}
                      </Text>
                    ) : (
                      <Button
                        size="xs"
                        variant="subtle"
                        onClick={() => {
                          setMetrics((current) => ({
                            ...current,
                            [plan.id]: { isLoading: true },
                          }));
                          const nextMetric = computePlanMetric(
                            plan,
                            scenario,
                            eventLibrary,
                            members,
                            budgetRules
                          );
                          setMetrics((current) => ({
                            ...current,
                            [plan.id]: { ...nextMetric, isLoading: false },
                          }));
                        }}
                      >
                        {translate("planLabPlanComputeKpi", "Compute")}
                      </Button>
                    )}
                  </Stack>
                  {metric?.status && (
                    <Badge color={badgeColor} variant="light">
                      {metric.status === "bust"
                        ? translate("planLabPlanStatusBust", "Bust")
                        : translate("planLabPlanStatusSafe", "Safe")}
                    </Badge>
                  )}
                </Group>
              </Stack>
            </Card>
          );
        })}
      </Stack>
    </Drawer>
  );
};
