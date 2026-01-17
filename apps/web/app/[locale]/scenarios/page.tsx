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
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import ScenarioActionsMenu from "../../../features/scenarios/components/ScenarioActionsMenu";
import ScenarioCard from "../../../features/scenarios/components/ScenarioCard";
import ConfirmDeleteDialog from "../../../features/scenarios/components/ConfirmDeleteDialog";
import NewScenarioModal from "../../../features/scenarios/components/NewScenarioModal";
import RenameScenarioModal from "../../../features/scenarios/components/RenameScenarioModal";
import type { Scenario } from "../../../features/scenarios/types";
import { formatRelativeTime } from "../../../features/scenarios/utils";
import { useScenarioSummary } from "../../../src/scenarios/useScenarioSummary";
import {
  getActiveScenario,
  getScenarioById,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";

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

type ScenarioCardWithSummaryProps = {
  scenario: Scenario;
  actions?: ReactNode;
  menu?: ReactNode;
  footer?: ReactNode;
};

function ScenarioCardWithSummary({
  scenario,
  actions,
  menu,
  footer,
}: ScenarioCardWithSummaryProps) {
  const { summary } = useScenarioSummary(scenario.id);
  return (
    <ScenarioCard
      scenario={scenario}
      kpis={summary?.kpis}
      actions={actions}
      menu={menu}
      footer={footer}
    />
  );
}

export default function ScenariosPage() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("scenarios");
  const common = useTranslations("common");
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

  useEffect(() => {
    if (!activeScenarioId) return;
    setSelectedScenarioId((prev) => (prev !== activeScenarioId ? activeScenarioId : prev));
  }, [activeScenarioId]);

  const selectedScenario = useMemo(() => {
    return (
      getScenarioById(scenarios, selectedScenarioId) ??
      activeScenario ??
      scenarios[0]
    );
  }, [activeScenario, scenarios, selectedScenarioId]);
  const { summary: selectedSummary } = useScenarioSummary(selectedScenario?.id);

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
    showToast(t("activeUpdated"), "teal");
  };

  const handleCreateScenario = (name: string) => {
    const newScenario = createScenario(name);
    setSelectedScenarioId(newScenario.id);
    setActiveScenario(newScenario.id);
    showToast(t("created"), "teal");
    router.push(`/${locale}/onboarding`);
  };

  const handleRenameScenario = (id: string, newName: string) => {
    renameScenario(id, newName);
    showToast(t("renamed"), "teal");
  };

  const handleDuplicateScenario = (id: string) => {
    const copy = duplicateScenario(id);
    if (!copy) {
      return;
    }
    setSelectedScenarioId(copy.id);
    setRenameScenarioTarget(copy);
    showToast(t("duplicated"), "teal");
  };

  const handleDeleteScenario = (id: string) => {
    const remaining = scenarios.filter((scenario) => scenario.id !== id);
    const nextActive =
      id === activeScenarioId
        ? remaining[0]
        : remaining.find((scenario) => scenario.id === activeScenarioId) ??
          remaining[0];

    deleteScenario(id);
    setSelectedScenarioId(nextActive?.id ?? remaining[0]?.id ?? "");

    if (remaining.length === 0) {
      showToast(t("deleted"), "teal");
      return;
    }

    if (id === activeScenarioId && nextActive) {
      showToast(t("activeSwitched", { name: nextActive.name }), "yellow");
    } else {
      showToast(t("deleted"), "teal");
    }
  };

  const handleOpenTimeline = (scenarioId: string) => {
    router.push(`/${locale}${buildScenarioUrl("/timeline", scenarioId)}`);
  };

  if (!selectedScenario && scenarios.length === 0) {
    return (
      <Stack gap="xl" pb={isDesktop ? undefined : 120}>
        <Stack gap={4}>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("subtitle")}
          </Text>
        </Stack>
        <Card withBorder radius="md" padding="lg">
          <Stack gap="sm">
            <Text fw={600}>{t("emptyTitle")}</Text>
            <Text size="sm" c="dimmed">
              {t("emptySubtitle")}
            </Text>
            <Button
              onClick={() => {
                const scenario = createScenario(t("emptyDefaultName"));
                setActiveScenario(scenario.id);
                router.push(`/${locale}/onboarding`);
              }}
            >
              {t("emptyCta")}
            </Button>
          </Stack>
        </Card>
      </Stack>
    );
  }

  if (!selectedScenario) {
    return null;
  }

  return (
    <Stack gap="xl" pb={isDesktop ? undefined : 120}>
      <Stack gap={4}>
        <Title order={2}>{t("title")}</Title>
        <Text c="dimmed" size="sm">
          {t("subtitle")}
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
              <Text fw={600}>{t("yourScenarios")}</Text>
              <Button onClick={() => setNewModalOpen(true)}>
                {t("newScenario")}
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
                        {t("updatedAt", {
                          time: formatRelativeTime(common, scenario.updatedAt, locale),
                        })}
                      </Text>
                    </Box>
                    {scenario.id === activeScenarioId && (
                      <Badge color="teal" variant="light">
                        {t("active")}
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
              kpis={selectedSummary?.kpis}
              actions={
                <Group wrap="wrap" gap="sm">
                  <Button
                    onClick={() => handleSetActiveScenario(selectedScenario.id)}
                    disabled={selectedScenario.id === activeScenarioId}
                  >
                    {t("setActive")}
                  </Button>
                  <Button
                    variant="light"
                    onClick={() => handleOpenTimeline(selectedScenario.id)}
                    disabled={selectedScenario.id !== activeScenarioId}
                  >
                    {t("goToTimeline")}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setRenameScenarioTarget(selectedScenario)}
                  >
                    {t("rename")}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => handleDuplicateScenario(selectedScenario.id)}
                  >
                    {t("duplicate")}
                  </Button>
                  <Button
                    color="red"
                    variant="light"
                    onClick={() => setDeleteScenarioTarget(selectedScenario)}
                  >
                    {t("delete")}
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
                <ScenarioCardWithSummary
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
                        {t("setActive")}
                      </Button>
                      <Button
                        variant="light"
                        onClick={() => handleOpenTimeline(scenario.id)}
                        disabled={scenario.id !== activeScenarioId}
                      >
                        {t("goToTimeline")}
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
          {t("newScenario")}
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
