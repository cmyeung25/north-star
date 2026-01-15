import { Group, SegmentedControl, Text } from "@mantine/core";
import { useTranslations } from "next-intl";

interface ScenarioOption {
  label: string;
  value: string;
}

interface ScenarioContextSelectorProps {
  options: ScenarioOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function ScenarioContextSelector({
  options,
  value,
  onChange,
}: ScenarioContextSelectorProps) {
  const t = useTranslations("overview");
  return (
    <Group justify="space-between" align="center" wrap="nowrap">
      <Text size="sm" c="dimmed" fw={500}>
        {t("activeScenario")}
      </Text>
      <SegmentedControl
        data={options}
        value={value}
        onChange={onChange}
        size="sm"
      />
    </Group>
  );
}
