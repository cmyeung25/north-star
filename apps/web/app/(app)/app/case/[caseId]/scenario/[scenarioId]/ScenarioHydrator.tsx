"use client";

import { useEffect, useState, type ReactNode } from "react";
import { importScenarioState } from "../../../../../../../src/store/scenarioState";

type Props = {
  caseId: string;
  scenarioId: string;
  payload: Record<string, unknown>;
  children: ReactNode;
};

export default function ScenarioHydrator({ caseId, scenarioId, payload, children }: Props) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    importScenarioState(payload as never);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "aurin:lastOpened",
        JSON.stringify({ caseId, scenarioId, at: new Date().toISOString() }),
      );
    }
    setHydrated(true);
  }, [caseId, payload, scenarioId]);

  if (!hydrated) {
    return <p>Hydrating scenario…</p>;
  }

  return <>{children}</>;
}
