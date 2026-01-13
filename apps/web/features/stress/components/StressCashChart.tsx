import { Card, Group, Stack, Text } from "@mantine/core";
import type { TimeSeriesPoint } from "../types";

type StressCashChartProps = {
  baseline: TimeSeriesPoint[];
  stressed: TimeSeriesPoint[];
};

const buildPath = (points: TimeSeriesPoint[]) => {
  if (points.length === 0) {
    return "";
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 40 - ((point.value - min) / range) * 40;
      return `${x},${y}`;
    })
    .join(" ");
};

export default function StressCashChart({
  baseline,
  stressed,
}: StressCashChartProps) {
  const baselinePath = buildPath(baseline);
  const stressedPath = buildPath(stressed);

  return (
    <Card withBorder padding="lg" radius="md" shadow="sm">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>Cash balance trend</Text>
          <Group gap="md">
            <Group gap={6}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "#4C6EF5",
                  display: "inline-block",
                }}
              />
              <Text size="xs" c="dimmed">
                Baseline
              </Text>
            </Group>
            <Group gap={6}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "#E03131",
                  display: "inline-block",
                }}
              />
              <Text size="xs" c="dimmed">
                Stressed
              </Text>
            </Group>
          </Group>
        </Group>
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          width="100%"
          height="120"
        >
          <polyline
            points={baselinePath}
            fill="none"
            stroke="#4C6EF5"
            strokeWidth="1.5"
          />
          <polyline
            points={stressedPath}
            fill="none"
            stroke="#E03131"
            strokeWidth="1.5"
          />
        </svg>
      </Stack>
    </Card>
  );
}
