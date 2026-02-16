"use client";

import { useMemo } from "react";
import { useScenarioCloudStore } from "../store/scenarioCloudStore";

export type ScenarioContextValue = {
  caseId: string;
  scenarioId: string;
  revision: number;
  lastSavedAt?: string;
};

export function useScenarioContext(): ScenarioContextValue | null {
  const meta = useScenarioCloudStore((state) => state.active);

  return useMemo(() => {
    if (!meta) {
      return null;
    }

    return {
      caseId: meta.caseId,
      scenarioId: meta.scenarioId,
      revision: meta.revision,
      lastSavedAt: meta.lastSavedAt,
    } satisfies ScenarioContextValue;
  }, [meta]);
}
