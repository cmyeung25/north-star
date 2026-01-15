import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("scenarios");
  const common = useTranslations("common");
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
      title={t("renameTitle")}
      centered
    >
      <Stack gap="md">
        <TextInput
          label={t("nameLabel")}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {common("actionCancel")}
          </Button>
          <Button onClick={handleSave}>{common("actionSave")}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
