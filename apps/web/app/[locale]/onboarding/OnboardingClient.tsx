"use client";

import { Skeleton, Stack } from "@mantine/core";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import OnboardingWizard from "../../../src/features/onboarding/OnboardingWizard";
import {
  getActiveScenario,
  useScenarioStore,
} from "../../../src/store/scenarioStore";

export default function OnboardingClient() {
  const router = useRouter();
  const locale = useLocale();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const didHydrate = useScenarioStore((state) => state.didHydrate);
  const isHydrating = useScenarioStore((state) => state.isHydrating);

  const activeScenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );

  useEffect(() => {
    if (!didHydrate || isHydrating) {
      return;
    }
    if (!activeScenario) {
      router.replace(`/${locale}/scenarios`);
    }
  }, [activeScenario, didHydrate, isHydrating, locale, router]);

  if (!didHydrate || isHydrating) {
    return (
      <Stack gap="xl">
        <Stack gap={4}>
          <Skeleton height={28} width="40%" />
          <Skeleton height={16} width="60%" />
        </Stack>
        <Stack gap="lg">
          <Skeleton height={18} width="30%" />
          <Skeleton height={140} />
          <Skeleton height={36} width="100%" />
          <Skeleton height={36} width="100%" />
        </Stack>
      </Stack>
    );
  }

  if (!activeScenario) {
    return null;
  }

  return <OnboardingWizard />;
}
