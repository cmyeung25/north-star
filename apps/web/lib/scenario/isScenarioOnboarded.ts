import type { ScenarioPayload } from "@north-star/adapters";

type ScenarioRecord = {
  id?: string;
  meta?: {
    onboarded?: unknown;
  };
  events?: unknown[];
};

const isOnboardedWithEvents = (scenario: ScenarioRecord | null) =>
  Boolean(scenario?.meta?.onboarded === true && Array.isArray(scenario?.events));

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

  if (isOnboardedWithEvents(selectedScenario)) {
    return true;
  }

  const meta = source.meta;
  return Boolean(
    meta &&
      typeof meta === "object" &&
      (meta as { onboarded?: unknown }).onboarded === true &&
      Array.isArray(source.events),
  );
};
