import { Card, List, Stack, Text, Title } from "@mantine/core";

interface InsightsCardProps {
  insights: string[];
}

export default function InsightsCard({ insights }: InsightsCardProps) {
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Title order={4}>Insights</Title>
        <List spacing="xs" size="sm">
          {insights.map((insight) => (
            <List.Item key={insight}>
              <Text size="sm">{insight}</Text>
            </List.Item>
          ))}
        </List>
      </Stack>
    </Card>
  );
}
