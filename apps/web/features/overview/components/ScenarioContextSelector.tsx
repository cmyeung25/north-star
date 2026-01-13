import { Group, SegmentedControl, Text } from "@mantine/core";

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
  return (
    <Group justify="space-between" align="center" wrap="nowrap">
      <Text size="sm" c="dimmed" fw={500}>
        Active Scenario
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
