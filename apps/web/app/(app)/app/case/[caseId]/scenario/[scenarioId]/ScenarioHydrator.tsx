"use client";

import { useEffect, useState, type ReactNode } from "react";
import { importScenarioState } from "../../../../../../../src/store/scenarioState";
import { normalizeScenario } from "../../../../../../../src/store/scenarioStore";
import { useScenarioStore } from "../../../../../../../src/store/scenarioStore";
import { useScenarioCloudStore } from "../../../../../../../src/store/scenarioCloudStore";
import { isScenarioOnboardedV2 } from "../../../../../../../lib/scenario/isScenarioOnboarded";


const normalizeHydratedPayload = (payload: Record<string, unknown>, scenarioId: string) => {
  const nextPayload = { ...payload };
  const scenarios = Array.isArray(nextPayload.scenarios) ? nextPayload.scenarios : [];
  const routeScenario = scenarios.find(
    (entry) => entry && typeof entry === "object" && (entry as { id?: unknown }).id === scenarioId,
  );
  const selectedScenario = routeScenario && typeof routeScenario === "object"
    ? (routeScenario as Parameters<typeof isScenarioOnboardedV2>[0])
    : null;

  if (!isScenarioOnboardedV2(selectedScenario)) {
    return nextPayload;
  }

  const meta =
    nextPayload.meta && typeof nextPayload.meta === "object"
      ? (nextPayload.meta as Record<string, unknown>)
      : {};

  nextPayload.meta = {
    ...meta,
    schemaVersion: 2,
    onboarded: true,
  };

  return nextPayload;
};

type Props = {
  caseId: string;
  scenarioId: string;
  scenarioTitle: string;
  payload: Record<string, unknown>;
  revision: number;
  lastSavedAt: string;
  children: ReactNode;
};

export default function ScenarioHydrator({
  caseId,
  scenarioId,
  scenarioTitle,
  payload,
  revision,
  lastSavedAt,
  children,
}: Props) {
  const [hydrated, setHydrated] = useState(false);
  const initializeCloudMeta = useScenarioCloudStore((state) => state.initialize);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const replaceScenario = useScenarioStore((state) => state.replaceScenario);

  useEffect(() => {
    const normalizedPayload = normalizeHydratedPayload(payload, scenarioId);
    importScenarioState(normalizedPayload as never);
    initializeCloudMeta({
      caseId,
      scenarioId,
      revision,
      lastSavedAt,
      payloadHash: JSON.stringify(normalizedPayload),
    });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "aurin:lastOpened",
        JSON.stringify({ caseId, scenarioId, at: new Date().toISOString() }),
      );
    }
    setHydrated(true);
  }, [caseId, initializeCloudMeta, lastSavedAt, payload, revision, scenarioId]);

  useEffect(() => {
    if (!scenarioId) {
      return;
    }

    const state = useScenarioStore.getState();
    const routeScenario = state.scenarios.find((entry) => entry.id === scenarioId);

    if (!routeScenario) {
      replaceScenario(
        normalizeScenario({
          id: scenarioId,
          name: scenarioTitle,
          baseCurrency: "HKD",
          updatedAt: Date.now(),
          kpis: {
            lowestMonthlyBalance: -8000,
            runwayMonths: 14,
            netWorthYear5: 1200000,
            riskLevel: "Medium",
          },
          assumptions: {
            horizonMonths: 60,
            initialCash: 0,
            baseMonth: null,
            includeBudgetRulesInProjection: true,
          },
          meta: { schemaVersion: 2 },
          events: [],
        })
      );
    }

    setActiveScenario(scenarioId);
  }, [replaceScenario, scenarioId, scenarioTitle, setActiveScenario]);

  if (!hydrated) {
    return <p>Hydrating scenario…</p>;
  }

  return <>{children}</>;
}
