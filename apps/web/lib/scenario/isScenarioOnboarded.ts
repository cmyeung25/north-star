import type { ScenarioPayload } from "@north-star/adapters";

type ScenarioRecord = {
  id?: string;
  meta?: {
    schemaVersion?: unknown;
    onboarded?: unknown;
  };
  clientComputed?: {
    onboardingCompleted?: unknown;
  };
  events?: unknown[];
};

export const isScenarioOnboardedV2 = (scenario: ScenarioRecord | null) => {
  if (!scenario || scenario.meta?.schemaVersion !== 2 || !Array.isArray(scenario.events)) {
    return false;
  }

  return scenario.meta?.onboarded === true || scenario.clientComputed?.onboardingCompleted === true;
};

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
  return isScenarioOnboardedV2(selectedScenario);
};
