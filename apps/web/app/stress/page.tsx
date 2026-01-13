import { Card, Stack, Text, Title } from "@mantine/core";

export default function StressPage() {
  return (
    <Stack gap="md">
      <Title order={2}>Stress Test</Title>
      <Card withBorder radius="md" padding="lg">
        <Text size="sm" c="dimmed">
          Stress test controls will land here next. For now, this is a UI stub.
        </Text>
      </Card>
    </Stack>
  );
}
