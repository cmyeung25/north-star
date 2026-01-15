import {
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type SaveScenarioModalProps = {
  opened: boolean;
  defaultName: string;
  onClose: () => void;
  onSave: (name: string, includeSummary: boolean) => void;
};

export default function SaveScenarioModal({
  opened,
  defaultName,
  onClose,
  onSave,
}: SaveScenarioModalProps) {
  const t = useTranslations("stress");
  const common = useTranslations("common");
  const [name, setName] = useState(defaultName);
  const [includeSummary, setIncludeSummary] = useState(true);

  useEffect(() => {
    if (opened) {
      setName(defaultName);
      setIncludeSummary(true);
    }
  }, [defaultName, opened]);

  return (
    <Modal opened={opened} onClose={onClose} title={t("saveScenario")} centered>
      <Stack gap="md">
        <TextInput
          label={t("scenarioNameLabel")}
          placeholder={t("scenarioNamePlaceholder")}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Switch
          label={t("includeSummaryLabel")}
          checked={includeSummary}
          onChange={(event) => setIncludeSummary(event.currentTarget.checked)}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            {common("actionCancel")}
          </Button>
          <Button onClick={() => onSave(name, includeSummary)}>
            {common("actionConfirm")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
