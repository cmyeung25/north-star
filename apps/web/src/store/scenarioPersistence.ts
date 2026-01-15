import { get, set } from "idb-keyval";
import {
  normalizeScenarioList,
  type Scenario,
  useScenarioStore,
} from "./scenarioStore";
import { SCHEMA_VERSION } from "./scenarioSchema";
import { normalizeActiveScenarioId } from "./scenarioState";

const STORAGE_KEY = "north-star-scenarios";
const SAVE_DEBOUNCE_MS = 500;

type ScenarioStoreSnapshot = {
  scenarios: Scenario[];
  activeScenarioId: string;
};

type PersistedScenarioState = ScenarioStoreSnapshot & {
  schemaVersion: number;
  savedAt: number;
};

const isPersistedScenarioState = (
  value: unknown
): value is PersistedScenarioState => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as PersistedScenarioState;

  return (
    typeof record.schemaVersion === "number" &&
    Array.isArray(record.scenarios) &&
    typeof record.activeScenarioId === "string"
  );
};

export const loadFromIndexedDB = async () => {
  if (typeof window === "undefined") {
    return null;
  }

  const value = await get(STORAGE_KEY);

  if (!isPersistedScenarioState(value)) {
    return null;
  }

  if (value.schemaVersion !== SCHEMA_VERSION) {
    // Schema mismatch falls back to defaults; future migrations can live here.
    return null;
  }

  const normalizedScenarios = normalizeScenarioList(value.scenarios);

  return {
    ...value,
    scenarios: normalizedScenarios,
    activeScenarioId: normalizeActiveScenarioId(
      normalizedScenarios,
      value.activeScenarioId
    ),
  };
};

export const saveToIndexedDB = async (state: ScenarioStoreSnapshot) => {
  if (typeof window === "undefined") {
    return;
  }

  await set(STORAGE_KEY, {
    schemaVersion: SCHEMA_VERSION,
    scenarios: state.scenarios,
    activeScenarioId: state.activeScenarioId,
    savedAt: Date.now(),
  });
};

export const hydrateScenarioStore = async () => {
  if (typeof window === "undefined") {
    return;
  }

  const persisted = await loadFromIndexedDB();

  if (persisted) {
    useScenarioStore.setState({
      scenarios: normalizeScenarioList(persisted.scenarios),
      activeScenarioId: persisted.activeScenarioId,
    });
    return;
  }

  const snapshot = useScenarioStore.getState();
  await saveToIndexedDB({
    scenarios: snapshot.scenarios,
    activeScenarioId: snapshot.activeScenarioId,
  });
};

export const initializeScenarioPersistence = () => {
  if (typeof window === "undefined") {
    return () => {};
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = (state: ScenarioStoreSnapshot) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      void saveToIndexedDB(state);
    }, SAVE_DEBOUNCE_MS);
  };

  const unsubscribe = useScenarioStore.subscribe((state) => {
    scheduleSave({
      scenarios: state.scenarios,
      activeScenarioId: state.activeScenarioId,
    });
  });

  return () => {
    unsubscribe();
    if (timeout) {
      clearTimeout(timeout);
    }
  };
};
