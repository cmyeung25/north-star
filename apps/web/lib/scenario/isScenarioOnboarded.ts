import type { ScenarioPayload } from "@north-star/adapters";
import { resolveScenarioLifecycle } from "../../src/domain/scenarioStateModel";

type ScenarioRecord = {
  id?: string;
  meta?: {
    onboarded?: unknown;
    onboardedAt?: unknown;
    skipOnboarding?: unknown;
    isSeeded?: unknown;
  };
  clientComputed?: {
    onboardingCompleted?: unknown;
  };
};

export const isScenarioOnboardedV2 = (scenario: ScenarioRecord | null) =>
  resolveScenarioLifecycle(scenario) === "active";

export const resolveScenarioFromPayload = (payload: Record<string, unknown>, scenarioId?: string) => {
  const scenarios = payload.scenarios;
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    return null;
  }

  const routeScenario =
    typeof scenarioId === "string"
      ? scenarios.find(
          (entry) => entry && typeof entry === "object" && (entry as { id?: unknown }).id === scenarioId,
        )
      : null;

  const activeScenarioId = typeof payload.activeScenarioId === "string" ? payload.activeScenarioId : null;
  const activeScenario =
    activeScenarioId
      ? scenarios.find(
          (entry) => entry && typeof entry === "object" && (entry as { id?: unknown }).id === activeScenarioId,
        )
      : null;

  const selected = routeScenario ?? activeScenario ?? scenarios[0];
  return selected && typeof selected === "object" ? (selected as ScenarioRecord) : null;
};

export const isScenarioOnboarded = (payload: ScenarioPayload, scenarioId?: string) => {
  return resolveScenarioLifecycleFromPayload(payload, scenarioId) === "active";
};

export const resolveScenarioLifecycleFromPayload = (payload: ScenarioPayload, scenarioId?: string) => {
  const source = payload as Record<string, unknown>;
  const selectedScenario = resolveScenarioFromPayload(source, scenarioId);
  return resolveScenarioLifecycle(selectedScenario);
};
