import { create } from "zustand";

export type ScenarioSaveStatus = "saved" | "unsaved" | "saving" | "error";

export type ScenarioCloudMeta = {
  caseId: string;
  scenarioId: string;
  revision: number;
  lastSavedAt?: string;
  lastSaveError?: string;
  saveStatus: ScenarioSaveStatus;
  dirty: boolean;
  lastChangeAt?: number;
  lastSavedHash: string;
};

type InitializeInput = {
  caseId: string;
  scenarioId: string;
  revision: number;
  lastSavedAt?: string;
  payloadHash: string;
};

type ScenarioCloudState = {
  active?: ScenarioCloudMeta;
  initialize: (input: InitializeInput) => void;
  clear: () => void;
  markUnsaved: (scenarioId: string, payloadHash: string) => void;
  markSaving: (scenarioId: string) => void;
  markSaved: (scenarioId: string, payloadHash: string, revision: number, lastSavedAt: string) => void;
  markError: (scenarioId: string, message: string) => void;
};

export const useScenarioCloudStore = create<ScenarioCloudState>((set) => ({
  active: undefined,
  initialize: (input) =>
    set((state) => {
      if (
        state.active?.scenarioId === input.scenarioId &&
        state.active?.caseId === input.caseId &&
        state.active?.revision === input.revision &&
        state.active?.lastSavedHash === input.payloadHash
      ) {
        return state;
      }

      return {
        active: {
          caseId: input.caseId,
          scenarioId: input.scenarioId,
          revision: input.revision,
          lastSavedAt: input.lastSavedAt,
          saveStatus: "saved",
          dirty: false,
          lastSavedHash: input.payloadHash,
        },
      };
    }),
  clear: () => set({ active: undefined }),
  markUnsaved: (scenarioId, payloadHash) =>
    set((state) => {
      if (!state.active || state.active.scenarioId !== scenarioId) {
        return state;
      }

      if (state.active.lastSavedHash === payloadHash) {
        return {
          active: {
            ...state.active,
            dirty: false,
            saveStatus: "saved",
            lastSaveError: undefined,
          },
        };
      }

      return {
        active: {
          ...state.active,
          dirty: true,
          saveStatus: state.active.saveStatus === "saving" ? "saving" : "unsaved",
          lastChangeAt: Date.now(),
        },
      };
    }),
  markSaving: (scenarioId) =>
    set((state) => {
      if (!state.active || state.active.scenarioId !== scenarioId) {
        return state;
      }

      return {
        active: {
          ...state.active,
          saveStatus: "saving",
          lastSaveError: undefined,
        },
      };
    }),
  markSaved: (scenarioId, payloadHash, revision, lastSavedAt) =>
    set((state) => {
      if (!state.active || state.active.scenarioId !== scenarioId) {
        return state;
      }

      return {
        active: {
          ...state.active,
          revision,
          lastSavedAt,
          saveStatus: "saved",
          dirty: false,
          lastSavedHash: payloadHash,
          lastSaveError: undefined,
          lastChangeAt: undefined,
        },
      };
    }),
  markError: (scenarioId, message) =>
    set((state) => {
      if (!state.active || state.active.scenarioId !== scenarioId) {
        return state;
      }

      return {
        active: {
          ...state.active,
          saveStatus: "error",
          lastSaveError: message,
        },
      };
    }),
}));
