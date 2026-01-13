import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import type { Scenario } from "../types";
import { formatRelativeTime, riskColorMap } from "../utils";
import ScenarioKpiGrid from "./ScenarioKpiGrid";

export type ScenarioCardProps = {
  scenario: Scenario;
  actions?: ReactNode;
  menu?: ReactNode;
  footer?: ReactNode;
};

export default function ScenarioCard({
  scenario,
  actions,
  menu,
  footer,
}: ScenarioCardProps) {
  return (
    <Card withBorder shadow="sm" radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={600} size="lg">
              {scenario.name}
            </Text>
            <Text size="xs" c="dimmed">
              Last updated {formatRelativeTime(scenario.updatedAt)}
            </Text>
          </div>
          {menu}
        </Group>

        <ScenarioKpiGrid scenario={scenario} />

        <Group justify="space-between">
          <Badge color={riskColorMap[scenario.kpis.riskLevel]} variant="light">
            Risk {scenario.kpis.riskLevel}
          </Badge>
          <Text size="xs" c="dimmed">
            Base currency: {scenario.baseCurrency}
          </Text>
        </Group>

        {actions}

        {footer}
      </Stack>
    </Card>
  );
}
