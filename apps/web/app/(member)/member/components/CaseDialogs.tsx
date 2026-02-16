"use client";

import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";

type CreateCaseDialogProps = {
  opened: boolean;
  title: string;
  currency: string;
  loading?: boolean;
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onSubmit: () => void;
};

export function CreateCaseDialog(props: CreateCaseDialogProps) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Create case" centered>
      <Stack>
        <TextInput
          label="Case title"
          placeholder="My retirement plan"
          value={props.title}
          onChange={(event) => props.onTitleChange(event.currentTarget.value)}
          required
        />
        <Select
          label="Currency"
          value={props.currency}
          onChange={(value) => props.onCurrencyChange(value ?? "HKD")}
          data={["HKD", "USD", "CNY"]}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>Cancel</Button>
          <Button loading={props.loading} onClick={props.onSubmit}>Create</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

type RenameCaseDialogProps = {
  opened: boolean;
  title: string;
  loading?: boolean;
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
};

export function RenameCaseDialog(props: RenameCaseDialogProps) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Rename case" centered>
      <Stack>
        <TextInput
          label="Case title"
          value={props.title}
          onChange={(event) => props.onTitleChange(event.currentTarget.value)}
          required
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>Cancel</Button>
          <Button loading={props.loading} onClick={props.onSubmit}>Save</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

type DeleteCaseDialogProps = {
  opened: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

export function DeleteCaseDialog(props: DeleteCaseDialogProps) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title="Delete case" centered>
      <Stack>
        <div>Delete this case and all scenarios? This cannot be undone.</div>
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>Cancel</Button>
          <Button color="red" loading={props.loading} onClick={props.onSubmit}>Delete</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
