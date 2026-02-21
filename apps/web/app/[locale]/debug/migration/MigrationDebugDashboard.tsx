"use client";

import { Card, Group, Stack, Table, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import {
  readScenarioMigrationEvents,
  type ScenarioMigrationTelemetryEvent,
} from "../../../../src/lib/telemetry/scenarioMigrationTelemetry";

const asPct = (num: number, den: number) => (den === 0 ? "0.0%" : `${((num / den) * 100).toFixed(1)}%`);

export default function MigrationDebugDashboard() {
  const events = useMemo(() => readScenarioMigrationEvents(), []);

  const stats = useMemo(() => {
    const compileFailed = events.filter((event) => event.name === "scenario_draft_compile_failed").length;
    const submissionCount = events.filter((event) => event.name === "scenario_submission_source").length;
    const saveFailed = events.filter((event) => event.name === "scenario_save_failed").length;
    const redirectAnomaly = events.filter((event) => event.name === "route_redirect_anomaly").length;
    return {
      compileFailed,
      submissionCount,
      saveFailed,
      redirectAnomaly,
      compileErrorRate: asPct(compileFailed, submissionCount),
      saveFailureRate: asPct(saveFailed, submissionCount),
    };
  }, [events]);

  return (
    <Stack gap="lg">
      <Title order={2}>Migration Protection Dashboard</Title>
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
