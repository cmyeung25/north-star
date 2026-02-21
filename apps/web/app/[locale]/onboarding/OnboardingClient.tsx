"use client";

import { Skeleton, Stack } from "@mantine/core";
import { useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import OnboardingEntry from "../../../src/features/onboarding/OnboardingEntry";
import { isScenarioOnboarded as isScenarioOnboardedHelper } from "../../../lib/onboarding/isScenarioOnboarded";
import { recordScenarioMigrationEvent } from "../../../src/lib/telemetry/scenarioMigrationTelemetry";
import {
  getActiveScenario,
  getScenarioById,
  useScenarioStore,
} from "../../../src/store/scenarioStore";

export default function OnboardingClient() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const didHydrate = useScenarioStore((state) => state.didHydrate);
  const isHydrating = useScenarioStore((state) => state.isHydrating);

  const routeScenarioId = searchParams.get("scenarioId");
  const routeCaseId = searchParams.get("caseId");
  const onboardingStartedScenarioRef = useRef<string | null>(null);

  const activeScenario = useMemo(
    () => (routeScenarioId ? getScenarioById(scenarios, routeScenarioId) : getActiveScenario(scenarios, activeScenarioId)),
    [activeScenarioId, routeScenarioId, scenarios],
  );

  useEffect(() => {
    if (!didHydrate || isHydrating || !routeScenarioId || activeScenarioId === routeScenarioId) {
      return;
    }

    if (scenarios.some((entry) => entry.id === routeScenarioId)) {
      setActiveScenario(routeScenarioId);
    }
  }, [activeScenarioId, didHydrate, isHydrating, routeScenarioId, scenarios, setActiveScenario]);

  useEffect(() => {
    if (!didHydrate || isHydrating) {
      return;
    }

    if (!activeScenario) {
      recordScenarioMigrationEvent({
        name: "route_redirect_anomaly",
        ts: new Date().toISOString(),
        route: "onboarding",
        reason: "missing-active-scenario",
      });
      router.replace(`/${locale}/member/cases`);
      return;
    }

    if (isScenarioOnboardedHelper(activeScenario)) {
      recordScenarioMigrationEvent({
        name: "route_redirect_anomaly",
        ts: new Date().toISOString(),
        route: "onboarding",
        scenarioId: activeScenario.id,
        reason: "already-onboarded-redirect-dashboard",
      });
      const query = routeCaseId && activeScenario.id
        ? `?caseId=${encodeURIComponent(routeCaseId)}&scenarioId=${encodeURIComponent(activeScenario.id)}`
        : "";
      router.replace(`/${locale}/dashboard${query}`);
    }
  }, [activeScenario, didHydrate, isHydrating, locale, routeCaseId, router]);


  useEffect(() => {
    if (!didHydrate || isHydrating || !activeScenario?.id) {
      return;
    }
    if (onboardingStartedScenarioRef.current === activeScenario.id) {
      return;
    }

    onboardingStartedScenarioRef.current = activeScenario.id;
    recordScenarioMigrationEvent({
      name: "onboarding_started",
      ts: new Date().toISOString(),
      scenarioId: activeScenario.id,
      source: "onboarding",
      route: "onboarding",
    });
  }, [activeScenario?.id, didHydrate, isHydrating]);

  if (!didHydrate || isHydrating || (routeScenarioId && !activeScenario)) {
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

  return <OnboardingEntry />;
}
