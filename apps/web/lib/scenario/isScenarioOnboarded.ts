import type { ScenarioPayload } from "@north-star/adapters";
import { isScenarioOnboarded as isOnboardedByScenario } from "../onboarding/isScenarioOnboarded";

type ScenarioRecord = {
  id?: string;
  meta?: {
    onboarded?: unknown;
    onboardedAt?: unknown;
  };
  clientComputed?: {
    onboardingCompleted?: unknown;
  };
};

export const isScenarioOnboardedV2 = (scenario: ScenarioRecord | null) =>
  isOnboardedByScenario(scenario);

const resolveScenario = (payload: Record<string, unknown>, scenarioId?: string) => {
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
  const source = payload as Record<string, unknown>;
  const selectedScenario = resolveScenario(source, scenarioId);
  return isOnboardedByScenario(selectedScenario);
};
