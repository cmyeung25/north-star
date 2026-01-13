"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Notification,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "../../lib/i18n";
import ScenarioActionsMenu from "../../features/scenarios/components/ScenarioActionsMenu";
import ScenarioCard from "../../features/scenarios/components/ScenarioCard";
import ConfirmDeleteDialog from "../../features/scenarios/components/ConfirmDeleteDialog";
import NewScenarioModal from "../../features/scenarios/components/NewScenarioModal";
import RenameScenarioModal from "../../features/scenarios/components/RenameScenarioModal";
import type { Scenario } from "../../features/scenarios/types";
import { formatRelativeTime } from "../../features/scenarios/utils";
import {
  getActiveScenario,
  getScenarioById,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";

const floatingButtonStyle = {
  position: "fixed" as const,
  right: 20,
  bottom: 92,
  zIndex: 10,
};

type ToastState = {
  message: string;
  color?: string;
};

export default function ScenariosPage() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const createScenario = useScenarioStore((state) => state.createScenario);
  const renameScenario = useScenarioStore((state) => state.renameScenario);
  const duplicateScenario = useScenarioStore((state) => state.duplicateScenario);
  const deleteScenario = useScenarioStore((state) => state.deleteScenario);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);

  const [selectedScenarioId, setSelectedScenarioId] = useState(
    activeScenarioId ?? scenarios[0]?.id ?? ""
  );
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [renameScenarioTarget, setRenameScenarioTarget] = useState<Scenario | null>(
    null
  );
  const [deleteScenarioTarget, setDeleteScenarioTarget] = useState<Scenario | null>(
    null
  );
  const [toast, setToast] = useState<ToastState | null>(null);

  const activeScenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  const selectedScenario = useMemo(() => {
    return (
      getScenarioById(scenarios, selectedScenarioId) ??
      activeScenario ??
      scenarios[0]
    );
  }, [activeScenario, scenarios, selectedScenarioId]);

  const showToast = (message: string, color?: string) => {
    setToast({ message, color });
  };

  const handleSetActiveScenario = (id: string) => {
    const nextActive = getScenarioById(scenarios, id);
    if (!nextActive) {
      return;
    }
    setActiveScenario(id);
    setSelectedScenarioId(id);
    showToast(t("scenariosActiveUpdated"), "teal");
  };

  const handleCreateScenario = (name: string) => {
    const newScenario = createScenario(name);
    setSelectedScenarioId(newScenario.id);
    showToast(t("scenariosCreated"), "teal");
  };

  const handleRenameScenario = (id: string, newName: string) => {
    renameScenario(id, newName);
    showToast(t("scenariosRenamed"), "teal");
  };

  const handleDuplicateScenario = (id: string) => {
    const copy = duplicateScenario(id);
    if (!copy) {
      return;
    }
    setSelectedScenarioId(copy.id);
    showToast(t("scenariosDuplicated"), "teal");
  };

  const handleDeleteScenario = (id: string) => {
    if (scenarios.length <= 1) {
      showToast(t("scenariosDeleteMinimum"), "red");
      return;
    }

    const remaining = scenarios.filter((scenario) => scenario.id !== id);
    const nextActive =
      id === activeScenarioId
        ? remaining[0]
        : remaining.find((scenario) => scenario.id === activeScenarioId) ??
          remaining[0];

    deleteScenario(id);
    setSelectedScenarioId(nextActive?.id ?? remaining[0]?.id ?? "");

    if (id === activeScenarioId && nextActive) {
      showToast(t("scenariosActiveSwitched", { name: nextActive.name }), "yellow");
    } else {
      showToast(t("scenariosDeleted"), "teal");
    }
  };

  const handleOpenTimeline = (scenarioId: string) => {
    router.push(buildScenarioUrl("/timeline", scenarioId));
  };

  if (!selectedScenario) {
    return null;
  }

  return (
    <Stack gap="xl" pb={isDesktop ? undefined : 120}>
      <Stack gap={4}>
        <Title order={2}>{t("scenariosTitle")}</Title>
        <Text c="dimmed" size="sm">
          {t("scenariosSubtitle")}
        </Text>
      </Stack>

      {toast && (
        <Notification color={toast.color} onClose={() => setToast(null)}>
          {toast.message}
        </Notification>
      )}

      {isDesktop ? (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>{t("scenariosYourScenarios")}</Text>
              <Button onClick={() => setNewModalOpen(true)}>
                {t("scenariosNewScenario")}
              </Button>
            </Group>

            <Stack gap="sm">
              {scenarios.map((scenario) => (
                <Card
                  key={scenario.id}
                  withBorder
                  padding="sm"
                  radius="md"
                  onClick={() => setSelectedScenarioId(scenario.id)}
                  style={{
                    cursor: "pointer",
                    borderColor:
                      scenario.id === selectedScenario.id ? "#4c6ef5" : undefined,
                  }}
                >
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Text fw={600}>{scenario.name}</Text>
                      <Text size="xs" c="dimmed">
                        {t("scenariosUpdated", {
                          time: formatRelativeTime(scenario.updatedAt),
                        })}
                      </Text>
                    </Box>
                    {scenario.id === activeScenarioId && (
                      <Badge color="teal" variant="light">
                        {t("scenariosActive")}
                      </Badge>
                    )}
                  </Group>
                </Card>
              ))}
            </Stack>
          </Stack>

          <Stack gap="md">
            <ScenarioCard
              scenario={selectedScenario}
              actions={
                <Group wrap="wrap" gap="sm">
                  <Button
                    onClick={() => handleSetActiveScenario(selectedScenario.id)}
                    disabled={selectedScenario.id === activeScenarioId}
                  >
                    {t("scenariosSetActive")}
                  </Button>
                  <Button
                    variant="light"
                    onClick={() => handleOpenTimeline(selectedScenario.id)}
                    disabled={selectedScenario.id !== activeScenarioId}
                  >
                    {t("scenariosGoToTimeline")}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setRenameScenarioTarget(selectedScenario)}
                  >
                    {t("scenariosRename")}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => handleDuplicateScenario(selectedScenario.id)}
                  >
                    {t("scenariosDuplicate")}
                  </Button>
                  <Button
                    color="red"
                    variant="light"
                    onClick={() => setDeleteScenarioTarget(selectedScenario)}
                  >
                    {t("scenariosDelete")}
                  </Button>
                </Group>
              }
            />
          </Stack>
        </SimpleGrid>
      ) : (
        <ScrollArea type="hover" scrollbarSize={6} offsetScrollbars>
          <Group wrap="nowrap" gap="md" align="stretch">
            {scenarios.map((scenario) => (
              <Box key={scenario.id} style={{ minWidth: 280, width: "80%" }}>
                <ScenarioCard
                  scenario={scenario}
                  menu={
                    <ScenarioActionsMenu
                      scenarioName={scenario.name}
                      onRename={() => setRenameScenarioTarget(scenario)}
                      onDuplicate={() => handleDuplicateScenario(scenario.id)}
                      onDelete={() => setDeleteScenarioTarget(scenario)}
                    />
                  }
                  actions={
                    <Group grow>
                      <Button
                        onClick={() => handleSetActiveScenario(scenario.id)}
                        disabled={scenario.id === activeScenarioId}
                      >
                        {t("scenariosSetActive")}
                      </Button>
                      <Button
                        variant="light"
                        onClick={() => handleOpenTimeline(scenario.id)}
                        disabled={scenario.id !== activeScenarioId}
                      >
                        {t("scenariosGoToTimeline")}
                      </Button>
                    </Group>
                  }
                />
              </Box>
            ))}
          </Group>
        </ScrollArea>
      )}

      {!isDesktop && (
        <Button style={floatingButtonStyle} onClick={() => setNewModalOpen(true)}>
          {t("scenariosNewScenario")}
        </Button>
      )}

      <NewScenarioModal
        opened={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreate={handleCreateScenario}
      />
      <RenameScenarioModal
        opened={Boolean(renameScenarioTarget)}
        currentName={renameScenarioTarget?.name ?? ""}
        onClose={() => setRenameScenarioTarget(null)}
        onSave={(name) => {
          if (renameScenarioTarget) {
            handleRenameScenario(renameScenarioTarget.id, name);
          }
        }}
      />
      <ConfirmDeleteDialog
        opened={Boolean(deleteScenarioTarget)}
        scenarioName={deleteScenarioTarget?.name ?? ""}
        onCancel={() => setDeleteScenarioTarget(null)}
        onConfirm={() => {
          if (deleteScenarioTarget) {
            handleDeleteScenario(deleteScenarioTarget.id);
            setDeleteScenarioTarget(null);
          }
        }}
      />
    </Stack>
  );
}
