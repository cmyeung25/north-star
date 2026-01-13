import { Card, List, Stack, Text, Title } from "@mantine/core";
import type { Kpis } from "../types";

type StressInsightsCardProps = {
  riskLevel: Kpis["riskLevel"];
};

const insightsMap: Record<Kpis["riskLevel"], string[]> = {
  Low: [
    "Cash runway remains resilient under current assumptions.",
    "Consider setting automated buffers for short-term shocks.",
  ],
  Medium: [
    "Projected cash dips below comfort level in the stress window.",
    "Review discretionary spend or short-term credit options.",
  ],
  High: [
    "Runway could shorten quickly without immediate interventions.",
    "Prioritize liquidity planning and consider income buffers.",
  ],
};

export default function StressInsightsCard({
  riskLevel,
}: StressInsightsCardProps) {
  return (
    <Card withBorder radius="md" shadow="sm" padding="lg">
      <Stack gap="sm">
        <Title order={5}>Insights</Title>
        <Text size="sm" c="dimmed">
          Suggested next steps based on current stress signals.
        </Text>
        <List spacing="xs" size="sm">
          {insightsMap[riskLevel].map((insight) => (
            <List.Item key={insight}>{insight}</List.Item>
          ))}
        </List>
      </Stack>
    </Card>
  );
}
