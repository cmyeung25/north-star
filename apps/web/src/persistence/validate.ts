import type { EventDefinition } from "../domain/events/types";
import type { Scenario } from "../store/scenarioStore";

export const PERSISTED_SCHEMA_VERSION = 1;

export type StorePersistedState = {
  scenarios: Scenario[];
  eventLibrary: EventDefinition[];
  activeScenarioId: string;
};

export type PersistedDocument = {
  schemaVersion: number;
  savedAt: string;
  appVersion?: string;
  payload: StorePersistedState;
};

type ValidationSuccess = {
  ok: true;
  value: PersistedDocument;
};

type ValidationFailure = {
  ok: false;
  error: string;
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isValidDate = (value: string) => !Number.isNaN(Date.parse(value));

const validateStorePayload = (payload: unknown): payload is StorePersistedState => {
  if (!isRecord(payload)) {
    return false;
  }

  const record = payload as StorePersistedState;

  return (
    Array.isArray(record.scenarios) &&
    Array.isArray(record.eventLibrary) &&
    typeof record.activeScenarioId === "string"
  );
};

export const migratePersistedState = (
  document: PersistedDocument
): PersistedDocument | null => {
  if (document.schemaVersion === PERSISTED_SCHEMA_VERSION) {
    return document;
  }

  return null;
};

export const validatePersistedState = (input: unknown): ValidationResult => {
  if (!isRecord(input)) {
    return { ok: false, error: "Invalid backup format." };
  }

  const schemaVersion = input.schemaVersion;
  const savedAt = input.savedAt;
  const payload = input.payload;

  if (typeof schemaVersion !== "number") {
    return { ok: false, error: "Missing schema version." };
  }

  if (typeof savedAt !== "string" || !isValidDate(savedAt)) {
    return { ok: false, error: "Invalid saved timestamp." };
  }

  if (!validateStorePayload(payload)) {
    return { ok: false, error: "Missing required data." };
  }

  const document: PersistedDocument = {
    schemaVersion,
    savedAt,
    payload,
    appVersion: typeof input.appVersion === "string" ? input.appVersion : undefined,
  };

  if (schemaVersion !== PERSISTED_SCHEMA_VERSION) {
    const migrated = migratePersistedState(document);
    if (!migrated) {
      return { ok: false, error: "Unsupported schema version." };
    }
    return { ok: true, value: migrated };
  }

  return { ok: true, value: document };
};
