"use client";

import { Button, Menu, Text } from "@mantine/core";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import NewScenarioModal from "../features/scenarios/components/NewScenarioModal";
import {
  getActiveScenario,
  useScenarioStore,
} from "../src/store/scenarioStore";

export default function ScenarioSwitcher() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("scenarios");
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const createScenario = useScenarioStore((state) => state.createScenario);
  const [newModalOpen, setNewModalOpen] = useState(false);

  const activeScenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  const handleCreateScenario = (name: string) => {
    const newScenario = createScenario(name, { onboardingCompleted: false });
    setActiveScenario(newScenario.id);
    router.push(`/${locale}/onboarding`);
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
          onCreate={handleCreateScenario}
        />
      </>
    );
  }

  return (
    <>
      <Menu withinPortal position="bottom-end">
        <Menu.Target>
          <Button size="xs" variant="light">
            {activeScenario?.name ?? t("title")}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {scenarios.map((scenario) => (
            <Menu.Item
              key={scenario.id}
              onClick={() => setActiveScenario(scenario.id)}
            >
              <Text fw={scenario.id === activeScenarioId ? 600 : 400}>
                {scenario.name}
              </Text>
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item onClick={() => setNewModalOpen(true)}>
            + {t("newScenario")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <NewScenarioModal
        opened={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onCreate={handleCreateScenario}
      />
    </>
  );
}
