"use client";

import { Card, Group, Stack, Table, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import {
  readScenarioMigrationEvents,
  type ScenarioMigrationTelemetryEvent,
} from "../../../../src/lib/telemetry/scenarioMigrationTelemetry";

const asPct = (num: number, den: number) => (den === 0 ? "0.0%" : `${((num / den) * 100).toFixed(1)}%`);
const asMinutes = (ms: number) => `${(ms / 1000 / 60).toFixed(1)} min`;

export default function MigrationDebugDashboard() {
  const events = useMemo(() => readScenarioMigrationEvents(), []);

  const stats = useMemo(() => {
    const submissionStarted = events.filter((event) => event.name === "scenario_submission_started").length;
    const submissionSucceeded = events.filter((event) => event.name === "scenario_submission_succeeded").length;
    const submissionFailed = events.filter((event) => event.name === "scenario_submission_failed").length;
    const compileFailed = events.filter((event) => event.name === "scenario_draft_compile_failed").length;
    const saveFailed = events.filter((event) => event.name === "scenario_save_failed").length;
    const redirectAnomaly = events.filter((event) => event.name === "route_redirect_anomaly").length;
    const doubleCountWarnings = events.filter(
      (event) => event.name === "scenario_double_count_warning_detected"
    ).length;

    const onboardingStartedByScenario = new Map(
      events
        .filter((event) => event.name === "onboarding_started" && typeof event.scenarioId === "string")
        .map((event) => [event.scenarioId as string, event])
    );

    const onboardingCompleted = events.filter(
      (event) => event.name === "onboarding_completed" && typeof event.scenarioId === "string"
    );

    let completionDurationSum = 0;
    let completionDurationCount = 0;
    onboardingCompleted.forEach((event) => {
      const started = onboardingStartedByScenario.get(event.scenarioId as string);
      if (!started) {
        return;
      }
      const startedAt = Date.parse(started.ts);
      const completedAt = Date.parse(event.ts);
      if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) {
        return;
      }
      completionDurationSum += completedAt - startedAt;
      completionDurationCount += 1;
    });

    return {
      compileFailed,
      submissionStarted,
      submissionSucceeded,
      submissionFailed,
      saveFailed,
      redirectAnomaly,
      doubleCountWarnings,
      onboardingStarted: onboardingStartedByScenario.size,
      onboardingCompleted: onboardingCompleted.length,
      compileErrorRate: asPct(compileFailed, submissionStarted),
      submissionFailureRate: asPct(submissionFailed, submissionStarted),
      doubleCountWarningRate: asPct(doubleCountWarnings, submissionStarted),
      saveFailureRate: asPct(saveFailed, submissionStarted),
      onboardingCompletionRate: asPct(onboardingCompleted.length, onboardingStartedByScenario.size),
      onboardingAvgCompletionTime:
        completionDurationCount === 0 ? "N/A" : asMinutes(completionDurationSum / completionDurationCount),
    };
  }, [events]);

  return (
    <Stack gap="lg">
      <Title order={2}>Migration Protection Dashboard</Title>
      <Group grow>
        <Card withBorder>
          <Text fw={700}>Submission Failure Rate</Text>
          <Text>{stats.submissionFailureRate}</Text>
        </Card>
        <Card withBorder>
          <Text fw={700}>Double-count Warning Rate</Text>
          <Text>{stats.doubleCountWarningRate}</Text>
        </Card>
        <Card withBorder>
          <Text fw={700}>Onboarding Completion Rate</Text>
          <Text>{stats.onboardingCompletionRate}</Text>
        </Card>
        <Card withBorder>
          <Text fw={700}>Average Onboarding Completion Time</Text>
          <Text>{stats.onboardingAvgCompletionTime}</Text>
        </Card>
      </Group>

      <Group grow>
        <Card withBorder>
          <Text fw={700}>Compile Error Rate</Text>
          <Text>{stats.compileErrorRate}</Text>
        </Card>
        <Card withBorder>
          <Text fw={700}>Save Failure Rate</Text>
          <Text>{stats.saveFailureRate}</Text>
        </Card>
        <Card withBorder>
          <Text fw={700}>Route Redirect Anomaly</Text>
          <Text>{stats.redirectAnomaly}</Text>
        </Card>
      </Group>

      <Card withBorder>
        <Text fw={700} mb="sm">Recent Events</Text>
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Source</Table.Th>
              <Table.Th>Route</Table.Th>
              <Table.Th>Scenario</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(events.slice(-50).reverse() as ScenarioMigrationTelemetryEvent[]).map((event, index) => (
              <Table.Tr key={`${event.ts}-${event.name}-${index}`}>
                <Table.Td>{event.ts}</Table.Td>
                <Table.Td>{event.name}</Table.Td>
                <Table.Td>{event.source ?? "-"}</Table.Td>
                <Table.Td>{event.route ?? "-"}</Table.Td>
                <Table.Td>{event.scenarioId ?? "-"}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
