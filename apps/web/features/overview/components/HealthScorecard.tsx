import { Card, Group, Progress, Stack, Text } from "@mantine/core";
import type { HealthScorecardDistribution, HealthScorecardStatus } from "../../../src/domain/dashboard/healthScorecard";

type Segment = {
  status: HealthScorecardStatus;
  count: number;
  color: string;
  label: string;
};

interface HealthScorecardProps {
  title: string;
  subtitle: string;
  totalLabel: string;
  segments: Segment[];
  distribution: HealthScorecardDistribution;
}

export default function HealthScorecard({
  title,
  subtitle,
  totalLabel,
  segments,
  distribution,
}: HealthScorecardProps) {
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-end">
          <div>
            <Text fw={600}>{title}</Text>
            <Text size="xs" c="dimmed">{subtitle}</Text>
          </div>
          <Text size="sm" c="dimmed">{totalLabel}</Text>
        </Group>
        <Progress.Root size={14} radius="xl">
          {segments
            .filter((segment) => segment.count > 0)
            .map((segment) => (
              <Progress.Section
                key={segment.status}
                value={total > 0 ? (segment.count / total) * 100 : 0}
                color={segment.color}
              />
            ))}
        </Progress.Root>
        <Group gap="md" wrap="wrap">
          {segments.map((segment) => (
            <Text key={segment.status} size="xs" c="dimmed">
              <Text component="span" c={segment.color} fw={600}>{segment.count}</Text> {segment.label}
            </Text>
          ))}
        </Group>
      </Stack>
    </Card>
  );
}

