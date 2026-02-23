import { create } from "zustand";

export type ScenarioSaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict";

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

type SaveNowInput = {
  payload: Record<string, unknown>;
  payloadHash: string;
  save: (input: {
    caseId: string;
    scenarioId: string;
    payload: Record<string, unknown>;
    expectedRevision: number;
  }) => Promise<{ ok: true; revision: number; lastSavedAt: string } | { ok: false; reason: "conflict" }>;
};

type SaveNowResult = { ok: true } | { ok: false; reason: "missing-meta" | "already-saving" | "error" | "conflict" };

type ScenarioCloudState = {
  active?: ScenarioCloudMeta;
  initialize: (input: InitializeInput) => void;
  clear: () => void;
  markDirty: (scenarioId: string) => void;
  markUnsaved: (scenarioId: string, payloadHash: string) => void;
  markSaving: (scenarioId: string) => void;
  markSaved: (scenarioId: string, payloadHash: string, revision: number, lastSavedAt: string) => void;
  markError: (scenarioId: string, message: string) => void;
  markConflict: (scenarioId: string) => void;
  saveNow: (input: SaveNowInput) => Promise<SaveNowResult>;
};

export const useScenarioCloudStore = create<ScenarioCloudState>((set, get) => ({
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
  markDirty: (scenarioId) =>
    set((state) => {
      if (!state.active || state.active.scenarioId !== scenarioId) {
        return state;
      }

      return {
        active: {
          ...state.active,
          dirty: true,
          saveStatus: state.active.saveStatus === "saving" ? "saving" : "unsaved",
          lastSaveError: undefined,
          lastChangeAt: Date.now(),
        },
      };
    }),
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
  markConflict: (scenarioId) =>
    set((state) => {
      if (!state.active || state.active.scenarioId !== scenarioId) {
        return state;
      }

      return {
        active: {
          ...state.active,
          saveStatus: "conflict",
          lastSaveError: "Revision conflict",
        },
      };
    }),
  saveNow: async ({ payload, payloadHash, save }) => {
    const meta = get().active;
    if (!meta) {
      return { ok: false, reason: "missing-meta" };
    }
    if (meta.saveStatus === "saving") {
      return { ok: false, reason: "already-saving" };
    }

    get().markSaving(meta.scenarioId);

    try {
      const result = await save({
        caseId: meta.caseId,
        scenarioId: meta.scenarioId,
        payload,
        expectedRevision: meta.revision,
      });

      if (!result.ok) {
        get().markConflict(meta.scenarioId);
        return { ok: false, reason: "conflict" };
      }

      get().markSaved(meta.scenarioId, payloadHash, result.revision, result.lastSavedAt);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      get().markError(meta.scenarioId, message);
      return { ok: false, reason: "error" };
    }
  },
}));
