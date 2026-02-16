import type { ScenarioPayload } from "@north-star/adapters";

type ScenarioRecord = {
  id?: string;
  assumptions?: Record<string, unknown>;
  events?: unknown[];
  assets?: unknown[];
  liabilities?: unknown[];
  positions?: {
    homes?: unknown[];
    cars?: unknown[];
    investments?: unknown[];
    insurances?: unknown[];
    loans?: unknown[];
    cashBuckets?: unknown[];
  };
};

const hasEntries = (value: unknown) => Array.isArray(value) && value.length > 0;

const hasMeaningfulAssumptions = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(([key, entry]) => {
    if (key === "horizonMonths" && entry === 60) {
      return false;
    }

    if (key === "initialCash" && entry === 0) {
      return false;
    }

    if (key === "baseMonth" && (entry === null || entry === "")) {
      return false;
    }

    if (entry === null || entry === undefined || entry === "") {
      return false;
    }

    if (Array.isArray(entry)) {
      return entry.length > 0;
    }

    if (typeof entry === "object") {
      return Object.keys(entry).length > 0;
    }

    return true;
  });
};

const resolveActiveScenario = (payload: Record<string, unknown>): ScenarioRecord | null => {
  const scenarios = payload.scenarios;
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    return null;
  }

  const activeScenarioId = payload.activeScenarioId;
  const activeScenario =
    typeof activeScenarioId === "string"
      ? scenarios.find(
          (scenario) =>
            scenario &&
            typeof scenario === "object" &&
            (scenario as { id?: unknown }).id === activeScenarioId,
        )
      : null;

  const selected = activeScenario ?? scenarios[0];
  return selected && typeof selected === "object" ? (selected as ScenarioRecord) : null;
};

export const isScenarioStarted = (payload: ScenarioPayload): boolean => {
  const source = payload as Record<string, unknown>;
  const meta = source.meta;

  if (meta && typeof meta === "object" && (meta as { onboarded?: unknown }).onboarded === true) {
    return true;
  }

  if (hasEntries(source.members)) {
    return true;
  }

  const activeScenario = resolveActiveScenario(source);
  if (!activeScenario) {
    return false;
  }

  if (
    hasEntries(activeScenario.events) ||
    hasEntries(activeScenario.assets) ||
    hasEntries(activeScenario.liabilities)
  ) {
    return true;
  }

  const positions = activeScenario.positions;
  if (
    positions &&
    [
      positions.homes,
      positions.cars,
      positions.investments,
      positions.insurances,
      positions.loans,
      positions.cashBuckets,
    ].some(hasEntries)
  ) {
    return true;
  }

  return hasMeaningfulAssumptions(activeScenario.assumptions);
};
