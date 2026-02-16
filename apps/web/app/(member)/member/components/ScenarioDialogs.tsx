"use client";

import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";

type ScenarioDialogBase = {
  opened: boolean;
  title: string;
  loading?: boolean;
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
};

export function CreateScenarioDialog(props: ScenarioDialogBase) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Create scenario" centered>
      <Stack>
        <TextInput
          label="Scenario title"
          value={props.title}
          onChange={(event) => props.onTitleChange(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>Cancel</Button>
          <Button loading={props.loading} onClick={props.onSubmit}>Create</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function DuplicateScenarioDialog(props: ScenarioDialogBase) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Duplicate scenario" centered>
      <Stack>
        <TextInput
          label="Copy title"
          value={props.title}
          onChange={(event) => props.onTitleChange(event.currentTarget.value)}
          disabled
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>Cancel</Button>
          <Button loading={props.loading} onClick={props.onSubmit}>Duplicate</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

type DeleteScenarioDialogProps = {
  opened: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export function DeleteScenarioDialog(props: DeleteScenarioDialogProps) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Delete scenario" centered>
      <Stack>
        <div>Delete this scenario? This cannot be undone.</div>
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>Cancel</Button>
          <Button color="red" loading={props.loading} onClick={props.onSubmit}>Delete</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
