"use client";

import { useEffect, useState, type ReactNode } from "react";
import { importScenarioState } from "../../../../../../../src/store/scenarioState";
import { normalizeScenario } from "../../../../../../../src/store/scenarioStore";
import { useScenarioStore } from "../../../../../../../src/store/scenarioStore";
import { useScenarioCloudStore } from "../../../../../../../src/store/scenarioCloudStore";

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
    importScenarioState(payload as never);
    initializeCloudMeta({
      caseId,
      scenarioId,
      revision,
      lastSavedAt,
      payloadHash: JSON.stringify(payload),
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
