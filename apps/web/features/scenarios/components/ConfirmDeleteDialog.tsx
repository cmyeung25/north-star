import { Button, Group, Modal, Stack, Text } from "@mantine/core";

type ConfirmDeleteDialogProps = {
  opened: boolean;
  scenarioName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteDialog({
  opened,
  scenarioName,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Modal opened={opened} onClose={onCancel} title="Delete Scenario" centered>
      <Stack gap="md">
        <Text>
          Are you sure you want to delete <strong>{scenarioName}</strong>?
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button color="red" onClick={onConfirm}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
