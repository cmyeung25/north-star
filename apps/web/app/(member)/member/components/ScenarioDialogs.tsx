"use client";

import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { useTranslations } from "next-intl";

type ScenarioDialogBase = {
  opened: boolean;
  title: string;
  loading?: boolean;
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
};

export function CreateScenarioDialog(props: ScenarioDialogBase) {
  const t = useTranslations("member.scenarioDialogs");

  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t("createTitle")} centered>
      <Stack>
        <TextInput
          label={t("scenarioTitleLabel")}
          value={props.title}
          onChange={(event) => props.onTitleChange(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>{t("cancel")}</Button>
          <Button loading={props.loading} onClick={props.onSubmit}>{t("create")}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function DuplicateScenarioDialog(props: ScenarioDialogBase) {
  const t = useTranslations("member.scenarioDialogs");

  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t("duplicateTitle")} centered>
      <Stack>
        <TextInput
          label={t("copyTitleLabel")}
          value={props.title}
          onChange={(event) => props.onTitleChange(event.currentTarget.value)}
          disabled
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>{t("cancel")}</Button>
          <Button loading={props.loading} onClick={props.onSubmit}>{t("duplicate")}</Button>
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
  const t = useTranslations("member.scenarioDialogs");

  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t("deleteTitle")} centered>
      <Stack>
        <div>{t("deleteConfirm")}</div>
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>{t("cancel")}</Button>
          <Button color="red" loading={props.loading} onClick={props.onSubmit}>{t("delete")}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
