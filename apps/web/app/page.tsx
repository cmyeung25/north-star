import { Button, Card, Stack, Text, Title } from "@mantine/core";

export default function HomePage() {
  return (
    <Stack gap="md">
      <Title order={1}>Plan your next chapter</Title>
      <Card withBorder shadow="sm" padding="lg" radius="md">
        <Text>
          Welcome to North Star. Your personalized life-stage planner will live here
          soon.
        </Text>
      </Card>
      <Button size="md">Start exploring</Button>
    </Stack>
  );
}
