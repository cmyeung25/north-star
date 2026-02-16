"use client";

import { Button, Menu, Text } from "@mantine/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import NewScenarioModal from "../features/scenarios/components/NewScenarioModal";
import { createEmptyScenarioStatePayload } from "../lib/scenario/payload";
import { useCaseScenarioRepo } from "../src/contexts/CaseScenarioProvider";

type ScenarioOption = {
  id: string;
  title: string;
};

export default function ScenarioSwitcher() {
  const router = useRouter();
  const t = useTranslations("scenarios");
  const { ensureDefaultCaseAndScenario, createScenario, listScenarios } = useCaseScenarioRepo();
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioOption[]>([]);

  const refreshScenarios = useCallback(async () => {
    const ensured = await ensureDefaultCaseAndScenario();
    const scenarioRows = await listScenarios(ensured.caseId);
    setCaseId(ensured.caseId);
    setActiveScenarioId(ensured.scenarioId);
    setScenarios(scenarioRows.map((entry) => ({ id: entry.id, title: entry.title })));
  }, [ensureDefaultCaseAndScenario, listScenarios]);

  useEffect(() => {
    void refreshScenarios();
  }, [refreshScenarios]);

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeScenarioId) ?? null,
    [activeScenarioId, scenarios],
  );

  const handleCreateScenario = async (name: string) => {
    const ensured = await ensureDefaultCaseAndScenario();
    const newScenario = await createScenario(ensured.caseId, {
      title: name,
      payload: createEmptyScenarioStatePayload(),
    });
    setActiveScenarioId(newScenario.id);
    await refreshScenarios();
    router.push(`/app/case/${ensured.caseId}/scenario/${newScenario.id}/onboarding`);
  };

  const handleSwitchScenario = (scenarioId: string) => {
    if (!caseId) {
      return;
    }
    setActiveScenarioId(scenarioId);
    router.push(`/app/case/${caseId}/scenario/${scenarioId}/dashboard`);
  };

  if (scenarios.length === 0) {
    return (
      <>
        <Button size="xs" onClick={() => setNewModalOpen(true)}>
          {t("newScenario")}
        </Button>
        <NewScenarioModal
          opened={newModalOpen}
          onClose={() => setNewModalOpen(false)}
          onCreate={(name) => {
            void handleCreateScenario(name);
          }}
        />
      </>
    );
  }

  return (
    <>
      <Menu withinPortal position="bottom-end">
        <Menu.Target>
          <Button size="xs" variant="light">
            {activeScenario?.title ?? t("title")}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {scenarios.map((scenario) => (
            <Menu.Item key={scenario.id} onClick={() => handleSwitchScenario(scenario.id)}>
              <Text fw={scenario.id === activeScenarioId ? 600 : 400}>{scenario.title}</Text>
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item onClick={() => setNewModalOpen(true)}>+ {t("newScenario")}</Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <NewScenarioModal
        opened={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreate={(name) => {
          void handleCreateScenario(name);
        }}
      />
    </>
  );
}
