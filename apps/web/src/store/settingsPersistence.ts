import { get, set } from "idb-keyval";
import { useSettingsStore } from "./settingsStore";

const STORAGE_KEY = "north-star-settings";
const SAVE_DEBOUNCE_MS = 300;

type PersistedSettings = {
  autoSyncEnabled: boolean;
};

const isPersistedSettings = (value: unknown): value is PersistedSettings => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as PersistedSettings;

  return typeof record.autoSyncEnabled === "boolean";
};

export const loadSettingsFromIndexedDB = async () => {
  if (typeof window === "undefined") {
    return null;
  }

  const value = await get(STORAGE_KEY);

  if (!isPersistedSettings(value)) {
    return null;
  }

  return value;
};

export const saveSettingsToIndexedDB = async (settings: PersistedSettings) => {
  if (typeof window === "undefined") {
    return;
  }

  await set(STORAGE_KEY, settings);
};

export const hydrateSettingsStore = async () => {
  if (typeof window === "undefined") {
    return;
  }

  const persisted = await loadSettingsFromIndexedDB();

  if (persisted) {
    useSettingsStore.setState({
      autoSyncEnabled: persisted.autoSyncEnabled,
    });
    return;
  }

  const snapshot = useSettingsStore.getState();
  await saveSettingsToIndexedDB({
    autoSyncEnabled: snapshot.autoSyncEnabled,
  });
};

export const initializeSettingsPersistence = () => {
  if (typeof window === "undefined") {
    return () => {};
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = (autoSyncEnabled: boolean) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      void saveSettingsToIndexedDB({ autoSyncEnabled });
    }, SAVE_DEBOUNCE_MS);
  };

  const unsubscribe = useSettingsStore.subscribe((state) => {
    scheduleSave(state.autoSyncEnabled);
  });

  return () => {
    unsubscribe();
    if (timeout) {
      clearTimeout(timeout);
    }
  };
};
