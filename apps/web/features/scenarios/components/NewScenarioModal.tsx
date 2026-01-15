import { Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("scenarios");
  const common = useTranslations("common");
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
      title={t("newTitle")}
      centered
    >
      <Stack gap="md">
        <TextInput
          label={t("nameLabel")}
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {common("actionCancel")}
          </Button>
          <Button onClick={handleCreate}>{common("actionCreate")}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
