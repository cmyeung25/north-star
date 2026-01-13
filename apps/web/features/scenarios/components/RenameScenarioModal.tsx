import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";

type RenameScenarioModalProps = {
  opened: boolean;
  currentName: string;
  onClose: () => void;
  onSave: (name: string) => void;
};

export default function RenameScenarioModal({
  opened,
  currentName,
  onClose,
  onSave,
}: RenameScenarioModalProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (opened) {
      setName(currentName);
    }
  }, [currentName, opened]);

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }
    onSave(name.trim());
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Rename Scenario" centered>
      <Stack gap="md">
        <TextInput
          label="Scenario name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
