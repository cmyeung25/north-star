"use client";

import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("member.caseDialogs");

  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t("createTitle")} centered>
      <Stack>
        <TextInput
          label={t("caseTitleLabel")}
          placeholder={t("caseTitlePlaceholder")}
          value={props.title}
          onChange={(event) => props.onTitleChange(event.currentTarget.value)}
          required
        />
        <Select
          label={t("currencyLabel")}
          value={props.currency}
          onChange={(value) => props.onCurrencyChange(value ?? "HKD")}
          data={["HKD", "USD", "CNY"]}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>{t("cancel")}</Button>
          <Button loading={props.loading} onClick={props.onSubmit}>{t("create")}</Button>
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
  const t = useTranslations("member.caseDialogs");

  return (
    <Modal opened={props.opened} onClose={props.onClose} title={t("renameTitle")} centered>
      <Stack>
        <TextInput
          label={t("caseTitleLabel")}
          value={props.title}
          onChange={(event) => props.onTitleChange(event.currentTarget.value)}
          required
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={props.onClose}>{t("cancel")}</Button>
          <Button loading={props.loading} onClick={props.onSubmit}>{t("save")}</Button>
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
  const t = useTranslations("member.caseDialogs");

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
