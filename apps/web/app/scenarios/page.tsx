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
import { defaultCurrency, t } from "../../lib/i18n";
import ScenarioActionsMenu from "../../features/scenarios/components/ScenarioActionsMenu";
import ScenarioCard from "../../features/scenarios/components/ScenarioCard";
import ConfirmDeleteDialog from "../../features/scenarios/components/ConfirmDeleteDialog";
import NewScenarioModal from "../../features/scenarios/components/NewScenarioModal";
import RenameScenarioModal from "../../features/scenarios/components/RenameScenarioModal";
import type { Scenario } from "../../features/scenarios/types";
import { formatRelativeTime } from "../../features/scenarios/utils";

const floatingButtonStyle = {
  position: "fixed" as const,
  right: 20,
  bottom: 92,
  zIndex: 10,
};

const initialScenarios: Scenario[] = [
  {
    id: "scenario-1",
    name: "方案 A · 租屋 + 寶寶",
    baseCurrency: defaultCurrency,
    updatedAt: Date.now() - 1000 * 60 * 60 * 12,
    kpis: {
      lowestMonthlyBalance: -12000,
      runwayMonths: 18,
      netWorthYear5: 1650000,
      riskLevel: "Medium",
    },
    isActive: true,
  },
  {
    id: "scenario-2",
    name: "方案 B · 買樓",
    baseCurrency: defaultCurrency,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    kpis: {
      lowestMonthlyBalance: -32000,
      runwayMonths: 10,
      netWorthYear5: 2100000,
      riskLevel: "High",
    },
    isActive: false,
  },
  {
    id: "scenario-3",
    name: "方案 C · 延後買車",
    baseCurrency: defaultCurrency,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 9,
    kpis: {
      lowestMonthlyBalance: 8000,
      runwayMonths: 24,
      netWorthYear5: 1350000,
      riskLevel: "Low",
    },
    isActive: false,
  },
];

const buildScenario = (name: string): Scenario => ({
  id: `scenario-${Date.now()}`,
  name,
  baseCurrency: defaultCurrency,
  updatedAt: Date.now(),
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 12,
    netWorthYear5: 1000000,
    riskLevel: "Medium",
  },
  isActive: false,
});

type ToastState = {
  message: string;
  color?: string;
};

export default function ScenariosPage() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenarios);
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    initialScenarios[0]?.id ?? ""
  );
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [renameScenario, setRenameScenario] = useState<Scenario | null>(null);
  const [deleteScenario, setDeleteScenario] = useState<Scenario | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.isActive) ?? scenarios[0],
    [scenarios]
  );

  const selectedScenario = useMemo(() => {
    const current = scenarios.find(
      (scenario) => scenario.id === selectedScenarioId
    );
    return current ?? activeScenario ?? scenarios[0];
  }, [activeScenario, scenarios, selectedScenarioId]);

  const showToast = (message: string, color?: string) => {
    setToast({ message, color });
  };

  const setActiveScenario = (id: string) => {
    setScenarios((current) =>
      current.map((scenario) => ({
        ...scenario,
        isActive: scenario.id === id,
        updatedAt: scenario.id === id ? Date.now() : scenario.updatedAt,
      }))
    );
    setSelectedScenarioId(id);
    showToast(t("scenariosActiveUpdated"), "teal");
  };

  const createScenario = (name: string) => {
    const newScenario = buildScenario(name);
    setScenarios((current) => [newScenario, ...current]);
    setSelectedScenarioId(newScenario.id);
    showToast(t("scenariosCreated"), "teal");
  };

  const renameScenarioById = (id: string, newName: string) => {
    setScenarios((current) =>
      current.map((scenario) =>
        scenario.id === id
          ? { ...scenario, name: newName, updatedAt: Date.now() }
          : scenario
      )
    );
    showToast(t("scenariosRenamed"), "teal");
  };

  const duplicateScenario = (id: string) => {
    const source = scenarios.find((scenario) => scenario.id === id);
    if (!source) {
      return;
    }
    const copy = {
      ...source,
      id: `scenario-${Date.now()}`,
      name: t("scenariosCopyOf", { name: source.name }),
      isActive: false,
      updatedAt: Date.now(),
    };
    setScenarios((current) => [copy, ...current]);
    setSelectedScenarioId(copy.id);
    showToast(t("scenariosDuplicated"), "teal");
  };

  const deleteScenarioById = (id: string) => {
    if (scenarios.length <= 1) {
      showToast(t("scenariosDeleteMinimum"), "red");
      return;
    }
    const target = scenarios.find((scenario) => scenario.id === id);
    if (!target) {
      return;
    }

    const remaining = scenarios.filter((scenario) => scenario.id !== id);
    const nextActive = target.isActive
      ? remaining[0]
      : remaining.find((scenario) => scenario.isActive) ?? remaining[0];

    setScenarios(
      remaining.map((scenario) => ({
        ...scenario,
        isActive: scenario.id === nextActive?.id,
      }))
    );

    if (target.isActive && nextActive) {
      showToast(
        t("scenariosActiveSwitched", { name: nextActive.name }),
        "yellow"
      );
    } else {
      showToast(t("scenariosDeleted"), "teal");
    }

    setSelectedScenarioId(nextActive?.id ?? remaining[0]?.id ?? "");
  };

  const handleOpenTimeline = (scenarioId: string) => {
    router.push(`/timeline?scenarioId=${scenarioId}`);
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
                    {scenario.isActive && (
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
                    onClick={() => setActiveScenario(selectedScenario.id)}
                    disabled={selectedScenario.isActive}
                  >
                    {t("scenariosSetActive")}
                  </Button>
                  <Button
                    variant="light"
                    onClick={() => handleOpenTimeline(selectedScenario.id)}
                    disabled={!selectedScenario.isActive}
                  >
                    {t("scenariosGoToTimeline")}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setRenameScenario(selectedScenario)}
                  >
                    {t("scenariosRename")}
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => duplicateScenario(selectedScenario.id)}
                  >
                    {t("scenariosDuplicate")}
                  </Button>
                  <Button
                    color="red"
                    variant="light"
                    onClick={() => setDeleteScenario(selectedScenario)}
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
                      onRename={() => setRenameScenario(scenario)}
                      onDuplicate={() => duplicateScenario(scenario.id)}
                      onDelete={() => setDeleteScenario(scenario)}
                    />
                  }
                  actions={
                    <Group grow>
                      <Button
                        onClick={() => setActiveScenario(scenario.id)}
                        disabled={scenario.isActive}
                      >
                        {t("scenariosSetActive")}
                      </Button>
                      <Button
                        variant="light"
                        onClick={() => handleOpenTimeline(scenario.id)}
                        disabled={!scenario.isActive}
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
        onCreate={createScenario}
      />
      <RenameScenarioModal
        opened={Boolean(renameScenario)}
        currentName={renameScenario?.name ?? ""}
        onClose={() => setRenameScenario(null)}
        onSave={(name) => {
          if (renameScenario) {
            renameScenarioById(renameScenario.id, name);
          }
        }}
      />
      <ConfirmDeleteDialog
        opened={Boolean(deleteScenario)}
        scenarioName={deleteScenario?.name ?? ""}
        onCancel={() => setDeleteScenario(null)}
        onConfirm={() => {
          if (deleteScenario) {
            deleteScenarioById(deleteScenario.id);
            setDeleteScenario(null);
          }
        }}
      />
    </Stack>
  );
}
