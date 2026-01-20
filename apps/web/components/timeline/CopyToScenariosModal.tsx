"use client";

import {
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Scenario } from "../../src/store/scenarioStore";

type CopyToScenariosModalProps = {
  opened: boolean;
  onClose: () => void;
  scenarios: Scenario[];
  currentScenarioId: string;
  title: string;
  onConfirm: (scenarioIds: string[]) => void;
};

export default function CopyToScenariosModal({
  opened,
  onClose,
  scenarios,
  currentScenarioId,
  title,
  onConfirm,
}: CopyToScenariosModalProps) {
  const t = useTranslations("timeline");
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);

  const options = useMemo(
    () =>
      scenarios
        .filter((scenario) => scenario.id !== currentScenarioId)
        .map((scenario) => ({
          value: scenario.id,
          label: scenario.name,
        })),
    [currentScenarioId, scenarios]
  );

  useEffect(() => {
    if (!opened) {
      return;
    }
    setSelectedScenarioIds(options.map((option) => option.value));
  }, [opened, options]);

  const handleConfirm = () => {
    if (selectedScenarioIds.length === 0) {
      return;
    }
    onConfirm(selectedScenarioIds);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack gap="sm">
        {options.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("copyPositionEmpty")}
          </Text>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              {t("copyPositionHint")}
            </Text>
            <Divider />
            <Checkbox.Group
              value={selectedScenarioIds}
              onChange={(value) => setSelectedScenarioIds(value)}
            >
              <Stack gap={6}>
                {options.map((option) => (
                  <Checkbox
                    key={option.value}
                    value={option.value}
                    label={option.label}
                  />
                ))}
              </Stack>
            </Checkbox.Group>
          </>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            {t("copyPositionCancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={options.length === 0 || selectedScenarioIds.length === 0}
          >
            {t("copyPositionConfirm")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
