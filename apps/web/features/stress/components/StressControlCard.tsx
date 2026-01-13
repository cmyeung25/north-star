import {
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";

const activeBadgeStyle = { textTransform: "uppercase" as const };

type SegmentedOption = {
  label: string;
  value: string;
};

type StressControlCardProps = {
  title: string;
  description: string;
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  isApplied: boolean;
};

export default function StressControlCard({
  title,
  description,
  options,
  value,
  onChange,
  onApply,
  isApplied,
}: StressControlCardProps) {
  return (
    <Card withBorder padding="lg" radius="md" shadow="sm">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Title order={4}>{title}</Title>
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          </Stack>
          {isApplied && (
            <Badge color="teal" variant="light" style={activeBadgeStyle}>
              Active
            </Badge>
          )}
        </Group>
        <SegmentedControl
          fullWidth
          value={value}
          onChange={onChange}
          data={options}
        />
        <Button size="md" onClick={onApply} fullWidth>
          Apply
        </Button>
      </Stack>
    </Card>
  );
}
