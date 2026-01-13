import {
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { useEffect, useState } from "react";

type SaveScenarioModalProps = {
  opened: boolean;
  defaultName: string;
  onClose: () => void;
  onSave: (name: string, includeSummary: boolean) => void;
};

export default function SaveScenarioModal({
  opened,
  defaultName,
  onClose,
  onSave,
}: SaveScenarioModalProps) {
  const [name, setName] = useState(defaultName);
  const [includeSummary, setIncludeSummary] = useState(true);

  useEffect(() => {
    if (opened) {
      setName(defaultName);
      setIncludeSummary(true);
    }
  }, [defaultName, opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="Save as Scenario" centered>
      <Stack gap="md">
        <TextInput
          label="Scenario name"
          placeholder="e.g. Plan A · Job loss"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Switch
          label="Include stress summary in name"
          checked={includeSummary}
          onChange={(event) => setIncludeSummary(event.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(name, includeSummary)}>Confirm</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
