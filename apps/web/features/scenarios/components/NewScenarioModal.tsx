import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";

type NewScenarioModalProps = {
  opened: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
};

export default function NewScenarioModal({
  opened,
  onClose,
  onCreate,
}: NewScenarioModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (opened) {
      setName("");
    }
  }, [opened]);

  const handleCreate = () => {
    if (!name.trim()) {
      return;
    }
    onCreate(name.trim());
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New Scenario" centered>
      <Stack gap="md">
        <TextInput
          label="Scenario name"
          placeholder="e.g. Plan D · Sabbatical"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
