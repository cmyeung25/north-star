import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { t } from "../../../lib/i18n";

type ConfirmDeleteDialogProps = {
  opened: boolean;
  scenarioName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteDialog({
  opened,
  scenarioName,
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={t("scenariosDeleteTitle")}
      centered
    >
      <Stack gap="md">
        <Text>
          {t("scenariosConfirmDelete", { name: scenarioName })}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            {t("scenariosCancel")}
          </Button>
          <Button color="red" onClick={onConfirm}>
            {t("scenariosDelete")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
