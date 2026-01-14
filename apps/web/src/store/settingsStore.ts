import { create } from "zustand";

type SettingsState = {
  autoSyncEnabled: boolean;
  lastAutoSyncAt: number | null;
  autoSyncError: string | null;
  setAutoSyncEnabled: (enabled: boolean) => void;
  setLastAutoSyncAt: (value: number | null) => void;
  setAutoSyncError: (error: string | null) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  autoSyncEnabled: false,
  lastAutoSyncAt: null,
  autoSyncError: null,
  setAutoSyncEnabled: (enabled) => set({ autoSyncEnabled: enabled }),
  setLastAutoSyncAt: (value) => set({ lastAutoSyncAt: value }),
  setAutoSyncError: (error) => set({ autoSyncError: error }),
}));
