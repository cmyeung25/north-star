"use client";

import {
  Button,
  Divider,
  Group,
  Modal,
  Notification,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  clearLocalData,
  deleteSnapshot,
  exportJSON,
  importJSON,
  listSnapshots,
  loadSnapshot,
  saveSnapshot,
  type SnapshotEntry,
} from "../src/persistence/storage";
import {
  hydrateFromPersistedState,
  selectPersistedState,
  useScenarioStore,
} from "../src/store/scenarioStore";

type DataManagementModalProps = {
  opened: boolean;
  onClose: () => void;
  onNotify: (message: string, color?: string) => void;
};

type ImportMode = "replace" | "snapshot";

const formatSnapshotName = (
  snapshot: SnapshotEntry,
  fallback: string
): string => snapshot.name?.trim() || fallback;

export default function DataManagementModal({
  opened,
  onClose,
  onNotify,
}: DataManagementModalProps) {
  const locale = useLocale();
  const t = useTranslations("dataManagement");
  const payload = useScenarioStore((state) => selectPersistedState(state));

  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [snapshotName, setSnapshotName] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("replace");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshSnapshots = () => {
    setSnapshots(listSnapshots());
  };

  useEffect(() => {
    if (!opened) {
      return;
    }
    setError(null);
    refreshSnapshots();
  }, [opened]);

  const handleSaveSnapshot = () => {
    setError(null);
    const result = saveSnapshot(snapshotName, payload);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSnapshotName("");
    refreshSnapshots();
    onNotify(t("saveSnapshotButton"), "teal");
  };

  const handleLoadSnapshot = (snapshotId: string) => {
    setError(null);
    if (!window.confirm(t("loadConfirm"))) {
      return;
    }

    const result = loadSnapshot(snapshotId);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    hydrateFromPersistedState(result.value.payload);
    onNotify(t("loadButton"), "teal");
  };

  const handleDeleteSnapshot = (snapshotId: string) => {
    setError(null);
    if (!window.confirm(t("deleteConfirm"))) {
      return;
    }

    const result = deleteSnapshot(snapshotId);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    refreshSnapshots();
    onNotify(t("deleteButton"), "teal");
  };

  const handleExport = () => {
    setError(null);
    const result = exportJSON(payload);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    onNotify(t("exportButton"), "teal");
  };

  const handleImport = async (file: File) => {
    setError(null);
    const result = await importJSON(file);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (importMode === "snapshot") {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const saveResult = saveSnapshot(baseName, result.value.payload);
      if (!saveResult.ok) {
        setError(saveResult.error);
        return;
      }
      refreshSnapshots();
      onNotify(t("importSuccessSnapshot"), "teal");
      return;
    }

    hydrateFromPersistedState(result.value.payload);
    onNotify(t("importSuccessReplace"), "teal");
  };

  const handleClear = () => {
    setError(null);
    if (!window.confirm(t("clearConfirm"))) {
      return;
    }

    const result = clearLocalData();
    if (!result.ok) {
      setError(result.error);
      return;
    }

    refreshSnapshots();
    onNotify(t("clearButton"), "teal");
  };

  const handleOpenFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    await handleImport(file);
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t("modalTitle")} centered>
      <Stack gap="lg">
        {error && (
          <Notification color="red" onClose={() => setError(null)}>
            {error}
          </Notification>
        )}

        <Stack gap="xs">
          <Text fw={600}>{t("saveSnapshotTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("saveSnapshotDescription")}
          </Text>
          <Group align="flex-end">
            <TextInput
              label={t("snapshotNameLabel")}
              placeholder={t("snapshotNamePlaceholder")}
              value={snapshotName}
              onChange={(event) => setSnapshotName(event.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button onClick={handleSaveSnapshot}>{t("saveSnapshotButton")}</Button>
          </Group>
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Text fw={600}>{t("snapshotsTitle")}</Text>
          {snapshots.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("snapshotsEmpty")}
            </Text>
          ) : (
            <ScrollArea h={180} offsetScrollbars>
              <Stack gap="sm">
                {snapshots.map((snapshot) => (
                  <Stack key={snapshot.id} gap={4} p="xs">
                    <Group justify="space-between" align="center">
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Text fw={500} size="sm">
                          {formatSnapshotName(snapshot, t("snapshotFallbackName"))}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(snapshot.savedAt).toLocaleString(locale)}
                        </Text>
                      </Stack>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => handleLoadSnapshot(snapshot.id)}
                        >
                          {t("loadButton")}
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={() => handleDeleteSnapshot(snapshot.id)}
                        >
                          {t("deleteButton")}
                        </Button>
                      </Group>
                    </Group>
                  </Stack>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Text fw={600}>{t("exportTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("exportDescription")}
          </Text>
          <Button onClick={handleExport}>{t("exportButton")}</Button>
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Text fw={600}>{t("importTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("importDescription")}
          </Text>
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {t("importModeLabel")}
            </Text>
            <SegmentedControl
              data={[
                { value: "replace", label: t("importModeReplace") },
                { value: "snapshot", label: t("importModeSnapshot") },
              ]}
              value={importMode}
              onChange={(value) => setImportMode(value as ImportMode)}
            />
          </Stack>
          <Group>
            <Button onClick={handleOpenFile}>{t("importButton")}</Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </Group>
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Text fw={600}>{t("clearTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("clearDescription")}
          </Text>
          <Button color="red" variant="light" onClick={handleClear}>
            {t("clearButton")}
          </Button>
        </Stack>
      </Stack>
    </Modal>
  );
}
