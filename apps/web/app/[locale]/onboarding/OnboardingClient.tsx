"use client";

import { Button, Card, Group, Modal, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import OnboardingWizard from "../../../src/features/onboarding/OnboardingWizard";
import {
  getActiveScenario,
  resetScenarioStore,
  selectHasExistingProfile,
  useScenarioStore,
} from "../../../src/store/scenarioStore";

export default function OnboardingClient() {
  const router = useRouter();
  const locale = useLocale();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const createScenario = useScenarioStore((state) => state.createScenario);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const skipOnboardingForScenario = useScenarioStore(
    (state) => state.skipOnboardingForScenario
  );
  const hasExistingProfile = useScenarioStore(selectHasExistingProfile);
  const didHydrate = useScenarioStore((state) => state.didHydrate);
  const isHydrating = useScenarioStore((state) => state.isHydrating);

  const [gateDismissed, setGateDismissed] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const activeScenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  useEffect(() => {
    if (!didHydrate || isHydrating) {
      return;
    }
    if (!activeScenario && scenarios.length === 0) {
      const scenario = createScenario("New Plan");
      setActiveScenario(scenario.id);
    }
  }, [
    activeScenario,
    createScenario,
    didHydrate,
    isHydrating,
    scenarios.length,
    setActiveScenario,
  ]);

  const handleResume = () => {
    const scenarioId = activeScenario?.id ?? activeScenarioId;
    if (scenarioId) {
      skipOnboardingForScenario(scenarioId);
    }
    setGateDismissed(true);
    router.push(`/${locale}/overview`);
  };

  const handleCreateNewPlan = () => {
    const scenario = createScenario("New Plan");
    setActiveScenario(scenario.id);
    setGateDismissed(true);
  };

  const handleReset = () => {
    resetScenarioStore();
    setGateDismissed(true);
    setResetConfirmOpen(false);
  };

  const showGate = hasExistingProfile && !gateDismissed;

  if (!didHydrate || isHydrating) {
    return (
      <Stack gap="xl">
        <Stack gap={4}>
          <Skeleton height={28} width="40%" />
          <Skeleton height={16} width="60%" />
        </Stack>
        <Card withBorder radius="md" padding="lg">
          <Stack gap="lg">
            <Skeleton height={18} width="30%" />
            <Skeleton height={140} />
            <Skeleton height={36} width="100%" />
            <Skeleton height={36} width="100%" />
          </Stack>
        </Card>
      </Stack>
    );
  }

  if (showGate) {
    return (
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>發現你之前已有計劃</Title>
          <Text size="sm" c="dimmed">
            你可以繼續上次計劃、建立新計劃，或重新開始。
          </Text>
        </Stack>
        <Card withBorder radius="md" padding="lg">
          <Stack gap="md">
            <Button onClick={handleResume}>Resume</Button>
            <Button variant="light" onClick={handleCreateNewPlan}>
              Create New Plan
            </Button>
            <Button color="red" variant="light" onClick={() => setResetConfirmOpen(true)}>
              Reset
            </Button>
          </Stack>
        </Card>
        <Modal
          opened={resetConfirmOpen}
          onClose={() => setResetConfirmOpen(false)}
          title="確認重置"
          centered
        >
          <Stack gap="md">
            <Text size="sm">這會清除本機所有資料，確定要重置嗎？</Text>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setResetConfirmOpen(false)}>
                取消
              </Button>
              <Button color="red" onClick={handleReset}>
                確認重置
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    );
  }

  if (!activeScenario) {
    return null;
  }

  return <OnboardingWizard />;
}
