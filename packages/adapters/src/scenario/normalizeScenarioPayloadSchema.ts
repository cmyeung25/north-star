type UnknownRecord = Record<string, unknown>;

const EVENT_SCHEMA_VERSION = 2;

const normalizeScenarioEntry = (entry: unknown): unknown => {
  if (!entry || typeof entry !== "object") {
    return entry;
  }

  const scenario = entry as UnknownRecord;
  const meta = scenario.meta && typeof scenario.meta === "object" ? (scenario.meta as UnknownRecord) : {};

  return {
    ...scenario,
    events: Array.isArray(scenario.events) ? scenario.events : [],
    meta: {
      ...meta,
      schemaVersion: EVENT_SCHEMA_VERSION,
    },
  };
};

export const normalizeScenarioPayloadSchema = <TPayload extends UnknownRecord>(payload: TPayload): TPayload => {
  const scenarios = Array.isArray(payload.scenarios) ? payload.scenarios.map(normalizeScenarioEntry) : [];
  const meta = payload.meta && typeof payload.meta === "object" ? (payload.meta as UnknownRecord) : {};

  const activeScenarioId =
    typeof payload.activeScenarioId === "string"
      ? payload.activeScenarioId
      : (scenarios.find(
          (entry) => entry && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string",
        ) as { id?: string } | undefined)?.id ?? "";

  return {
    ...payload,
    schemaVersion: EVENT_SCHEMA_VERSION,
    scenarios,
    activeScenarioId,
    meta: {
      ...meta,
      schemaVersion: EVENT_SCHEMA_VERSION,
    },
  };
};
