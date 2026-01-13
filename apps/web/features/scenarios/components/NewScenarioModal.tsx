import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { t } from "../../../lib/i18n";

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
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("scenariosNewTitle")}
      centered
    >
      <Stack gap="md">
        <TextInput
          label={t("scenariosNameLabel")}
          placeholder={t("scenariosNamePlaceholder")}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("scenariosCancel")}
          </Button>
          <Button onClick={handleCreate}>{t("scenariosCreate")}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
