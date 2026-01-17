import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";

interface KpiCardProps {
  label: string;
  value: string;
  helper?: string;
  badgeLabel?: string;
  badgeColor?: string;
  onDetails?: () => void;
  detailsLabel?: string;
}

export default function KpiCard({
  label,
  value,
  helper,
  badgeLabel,
  badgeColor,
  onDetails,
  detailsLabel,
}: KpiCardProps) {
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap={4}>
        <Group justify="space-between" align="flex-start">
          <Text size="sm" c="dimmed" fw={500}>
            {label}
          </Text>
          {badgeLabel && (
            <Badge color={badgeColor} variant="light">
              {badgeLabel}
            </Badge>
          )}
        </Group>
        <Text fw={600} size="lg">
          {value}
        </Text>
        {helper && (
          <Text size="xs" c="dimmed">
            {helper}
          </Text>
        )}
        {onDetails && detailsLabel && (
          <Button variant="subtle" size="xs" onClick={onDetails}>
            {detailsLabel}
          </Button>
        )}
      </Stack>
    </Card>
  );
}
