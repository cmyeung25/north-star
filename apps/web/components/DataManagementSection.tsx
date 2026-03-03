"use client";

import { Button, Card, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { exportJSON } from "../src/persistence/storage";
import { selectPersistedState, useScenarioStore } from "../src/store/scenarioStore";

type DataManagementSectionProps = {
  onNotify: (message: string, color?: string) => void;
};

export default function DataManagementSection({ onNotify }: DataManagementSectionProps) {
  const t = useTranslations("dataManagement");
  const scenarioState = useScenarioStore();
  const payload = useMemo(() => selectPersistedState(scenarioState), [scenarioState]);

  const handleExport = () => {
    const result = exportJSON(payload);
    if (!result.ok) {
      onNotify(t("exportFailed"), "red");
      return;
    }

    onNotify(t("exportSuccess"), "teal");
  };

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="lg">
        <Stack gap={4}>
          <Text fw={600}>{t("title")}</Text>
          <Text size="sm" c="dimmed">
            {t("subtitle")}
          </Text>
        </Stack>

        <Stack gap="xs">
          <Text fw={600}>{t("exportTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("exportDescription")}
          </Text>
          <Button onClick={handleExport}>{t("exportButton")}</Button>
        </Stack>
      </Stack>
    </Card>
  );
}
