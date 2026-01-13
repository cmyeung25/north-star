import { Button, Group, Paper } from "@mantine/core";

type StickyActionBarProps = {
  onSave: () => void;
  onRevert: () => void;
};

export default function StickyActionBar({
  onSave,
  onRevert,
}: StickyActionBarProps) {
  return (
    <Paper
      withBorder
      shadow="md"
      radius={0}
      p="md"
      style={{ position: "sticky", bottom: 0, zIndex: 10 }}
    >
      <Group grow>
        <Button size="md" onClick={onSave}>
          Save as Scenario
        </Button>
        <Button size="md" variant="light" onClick={onRevert}>
          Revert
        </Button>
      </Group>
    </Paper>
  );
}
