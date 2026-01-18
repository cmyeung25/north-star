import { Stack, Text } from "@mantine/core";

export type PositionDetailItem = {
  label: string;
  value: string;
};

type PositionDetailListProps = {
  items: PositionDetailItem[];
};

export default function PositionDetailList({ items }: PositionDetailListProps) {
  return (
    <Stack gap={2}>
      {items.map((item) => (
        <Text key={`${item.label}-${item.value}`} size="xs">
          <Text component="span" c="dimmed">
            {item.label}:
          </Text>{" "}
          {item.value}
        </Text>
      ))}
    </Stack>
  );
}
