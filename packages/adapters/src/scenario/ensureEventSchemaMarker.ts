const EVENT_SCHEMA_VERSION = 2;

type UnknownRecord = Record<string, unknown>;

const ensureScenarioEventMeta = (scenario: unknown): unknown => {
  if (!scenario || typeof scenario !== "object") {
    return scenario;
  }

  const scenarioRecord = scenario as UnknownRecord;
  const currentMeta =
    scenarioRecord.meta && typeof scenarioRecord.meta === "object"
      ? (scenarioRecord.meta as UnknownRecord)
      : {};

  if (currentMeta.schemaVersion === EVENT_SCHEMA_VERSION) {
    if (Array.isArray(scenarioRecord.events)) {
      return scenario;
    }

    return {
      ...scenarioRecord,
      events: [],
    };
  }

  return {
    ...scenarioRecord,
    events: Array.isArray(scenarioRecord.events) ? scenarioRecord.events : [],
    meta: {
      ...currentMeta,
      schemaVersion: EVENT_SCHEMA_VERSION,
    },
  };
};

export const ensureEventSchemaMarker = <TPayload extends UnknownRecord>(payload: TPayload): TPayload => {
  const currentMeta =
    payload.meta && typeof payload.meta === "object"
      ? (payload.meta as UnknownRecord)
      : {};

  const nextScenarios = Array.isArray(payload.scenarios)
    ? payload.scenarios.map(ensureScenarioEventMeta)
    : payload.scenarios;

  return {
    ...payload,
    schemaVersion: EVENT_SCHEMA_VERSION,
    scenarios: nextScenarios,
    meta: {
      ...currentMeta,
      schemaVersion: EVENT_SCHEMA_VERSION,
    },
  };
};
