import { loadAutosave, saveAutosave } from "../persistence/storage";
import {
  hydrateFromPersistedState,
  selectPersistedState,
  useScenarioStore,
} from "./scenarioStore";

const SAVE_DEBOUNCE_MS = 800;

export const hydrateScenarioStore = async () => {
  if (typeof window === "undefined") {
    return;
  }

  const persisted = loadAutosave();

  if (persisted.ok && persisted.value) {
    hydrateFromPersistedState(persisted.value.payload);
    return;
  }

  if (!persisted.ok) {
    window.alert(`Autosave could not be loaded: ${persisted.error}`);
  }

  const snapshot = selectPersistedState(useScenarioStore.getState());
  const saved = saveAutosave(snapshot);
  if (!saved.ok) {
    console.warn(saved.error);
  }
};

export const initializeScenarioPersistence = () => {
  if (typeof window === "undefined") {
    return () => {};
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = (state: ReturnType<typeof selectPersistedState>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      const result = saveAutosave(state);
      if (!result.ok) {
        console.warn(result.error);
      }
    }, SAVE_DEBOUNCE_MS);
  };

  const unsubscribe = useScenarioStore.subscribe((state) => {
    scheduleSave(selectPersistedState(state));
  });

  return () => {
    unsubscribe();
    if (timeout) {
      clearTimeout(timeout);
    }
  };
};
