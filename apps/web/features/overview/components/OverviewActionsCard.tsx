import { Button, Card, Stack, Title } from "@mantine/core";
import Link from "next/link";

interface OverviewActionsCardProps {
  scenarioId: string;
}

export default function OverviewActionsCard({ scenarioId }: OverviewActionsCardProps) {
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Title order={4}>Quick actions</Title>
        <Button component={Link} href={`/timeline?scenarioId=${scenarioId}`}>
          Open Timeline
        </Button>
        <Button
          component={Link}
          href={`/stress?scenarioId=${scenarioId}`}
          variant="light"
        >
          Run Stress Test
        </Button>
        <Button component={Link} href="/settings" variant="subtle">
          Settings
        </Button>
      </Stack>
    </Card>
  );
}
