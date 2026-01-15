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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("stress");
  const common = useTranslations("common");
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
              {t("activeBadge")}
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
          {common("actionApply")}
        </Button>
      </Stack>
    </Card>
  );
}
