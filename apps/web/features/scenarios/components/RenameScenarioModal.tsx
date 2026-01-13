import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { t } from "../../../lib/i18n";

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
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("scenariosRenameTitle")}
      centered
    >
      <Stack gap="md">
        <TextInput
          label={t("scenariosNameLabel")}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t("scenariosCancel")}
          </Button>
          <Button onClick={handleSave}>{t("scenariosSave")}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
