"use client";

import { useEffect, useState, type ReactNode } from "react";
import { importScenarioState } from "../../../../../../../src/store/scenarioState";
import { useScenarioCloudStore } from "../../../../../../../src/store/scenarioCloudStore";

type Props = {
  caseId: string;
  scenarioId: string;
  payload: Record<string, unknown>;
  revision: number;
  lastSavedAt: string;
  children: ReactNode;
};

export default function ScenarioHydrator({ caseId, scenarioId, payload, revision, lastSavedAt, children }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const initializeCloudMeta = useScenarioCloudStore((state) => state.initialize);

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

  if (!hydrated) {
    return <p>Hydrating scenario…</p>;
  }

  return <>{children}</>;
}
