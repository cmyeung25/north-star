import { Badge, List, Stack, Text } from "@mantine/core";

type ChecklistItem = {
  label: string;
  completed: boolean;
  warning?: string;
};

type Props = {
  items: ChecklistItem[];
};

export default function ReviewStep({ items }: Props) {
  return (
    <Stack>
      <Text fw={600}>Completeness checklist</Text>
      <List>
        {items.map((item) => (
          <List.Item key={item.label}>
            <Badge color={item.completed ? "green" : "yellow"} mr="xs">{item.completed ? "OK" : "TODO"}</Badge>
            {item.label}
            {!item.completed && item.warning ? ` · ${item.warning}` : ""}
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}
