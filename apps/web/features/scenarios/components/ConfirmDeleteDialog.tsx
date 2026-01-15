import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("scenarios");
  const common = useTranslations("common");
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={t("deleteTitle")}
      centered
    >
      <Stack gap="md">
        <Text>
          {t("confirmDelete", { name: scenarioName })}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            {common("actionCancel")}
          </Button>
          <Button color="red" onClick={onConfirm}>
            {common("actionDelete")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
