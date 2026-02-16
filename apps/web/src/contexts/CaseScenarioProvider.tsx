"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { createCaseScenarioRepo, type CaseSummary, type ScenarioPayload, type ScenarioSummary } from "@north-star/adapters";
import { createSupabaseBrowserClient } from "../lib/supabase/browser";
import { createEmptyScenarioStatePayload } from "../../lib/scenario/payload";
import { AUTOSAVE_KEY } from "../persistence/storage";

type CaseScenarioContextValue = {
  listCases: () => Promise<CaseSummary[]>;
  createCase: (input: { title: string; currency?: string }) => Promise<CaseSummary>;
  renameCase: (caseId: string, title: string) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
  listScenarios: (caseId: string) => Promise<ScenarioSummary[]>;
  createScenario: (
    caseId: string,
    input: { title: string; payload: ScenarioPayload; schemaVersion?: number },
  ) => Promise<ScenarioSummary>;
  duplicateScenario: (caseId: string, scenarioId: string) => Promise<ScenarioSummary>;
  deleteScenario: (caseId: string, scenarioId: string) => Promise<void>;
  loadScenarioPayload: (caseId: string, scenarioId: string) => Promise<ScenarioPayload>;
  saveScenarioPayload: (
    caseId: string,
    scenarioId: string,
    payload: ScenarioPayload,
    expectedRevision?: number,
  ) => Promise<{ revision: number; lastSavedAt: string }>;
  ensureDefaultCaseAndScenario: () => Promise<{ caseId: string; scenarioId: string }>;
};

const CaseScenarioContext = createContext<CaseScenarioContextValue | null>(null);

const DEFAULT_CASE_TITLE = "My Plan";
const DEFAULT_SCENARIO_TITLE = "Baseline";
const MIGRATION_FLAG_KEY = "northstar.migratedToCloud.v1";

function parseLegacyAutosaveScenario(): ScenarioPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      payload?: {
        scenarios?: unknown[];
        activeScenarioId?: string;
      };
    };

    const scenarios = parsed.payload?.scenarios;
    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return null;
    }

    const activeScenario =
      scenarios.find(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          (entry as { id?: string }).id === parsed.payload?.activeScenarioId,
      ) ?? scenarios[0];

    if (!activeScenario || typeof activeScenario !== "object") {
      return null;
    }

    return {
      stateVersion: 1,
      schemaVersion: 1,
      scenarios,
      activeScenarioId: parsed.payload?.activeScenarioId ?? (activeScenario as { id?: string }).id ?? "",
      eventLibrary: [],
    };
  } catch {
    return null;
  }
}

export function CaseScenarioProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(
    () =>
      createCaseScenarioRepo({
        mode: "cloud",
        supabaseClient: createSupabaseBrowserClient(),
      }),
    [],
  );

  const ensureDefaultCaseAndScenario = useCallback(async () => {
    const cases = await repo.listCases();
    const activeCase =
      cases[0] ??
      (await repo.createCase({
        title: DEFAULT_CASE_TITLE,
        currency: "HKD",
      }));

    const scenarios = await repo.listScenarios(activeCase.id);
    const activeScenario =
      scenarios[0] ??
      (await repo.createScenario(activeCase.id, {
        title: DEFAULT_SCENARIO_TITLE,
        payload: createEmptyScenarioStatePayload(),
      }));

    return { caseId: activeCase.id, scenarioId: activeScenario.id };
  }, [repo]);

  useEffect(() => {
    let cancelled = false;

    const migrateLegacyLocalScenario = async () => {
      if (typeof window === "undefined") {
        return;
      }

      const alreadyMigrated = window.localStorage.getItem(MIGRATION_FLAG_KEY) === "true";
      if (alreadyMigrated) {
        return;
      }

      const legacyPayload = parseLegacyAutosaveScenario();
      if (!legacyPayload) {
        window.localStorage.setItem(MIGRATION_FLAG_KEY, "true");
        return;
      }

      try {
        const { caseId } = await ensureDefaultCaseAndScenario();
        if (cancelled) {
          return;
        }
        await repo.createScenario(caseId, {
          title: "Migrated Local Scenario",
          payload: legacyPayload,
        });
        window.localStorage.removeItem(AUTOSAVE_KEY);
        window.localStorage.setItem(MIGRATION_FLAG_KEY, "true");
        window.alert("已遷移到雲端");
      } catch {
        // Skip migration silently when unauthenticated / network failures.
      }
    };

    void migrateLegacyLocalScenario();

    return () => {
      cancelled = true;
    };
  }, [ensureDefaultCaseAndScenario, repo]);

  const value = useMemo<CaseScenarioContextValue>(
    () => ({
      listCases: () => repo.listCases(),
      createCase: (input) => repo.createCase(input),
      renameCase: (caseId, title) => repo.renameCase(caseId, title),
      deleteCase: (caseId) => repo.deleteCase(caseId),
      listScenarios: (caseId) => repo.listScenarios(caseId),
      createScenario: (caseId, input) => repo.createScenario(caseId, input),
      duplicateScenario: (caseId, scenarioId) => repo.duplicateScenario(caseId, scenarioId),
      deleteScenario: (caseId, scenarioId) => repo.deleteScenario(caseId, scenarioId),
      loadScenarioPayload: (caseId, scenarioId) => repo.loadScenarioPayload(caseId, scenarioId),
      saveScenarioPayload: (caseId, scenarioId, payload, expectedRevision) =>
        repo.saveScenarioPayload(caseId, scenarioId, payload, expectedRevision),
      ensureDefaultCaseAndScenario,
    }),
    [ensureDefaultCaseAndScenario, repo],
  );

  return <CaseScenarioContext.Provider value={value}>{children}</CaseScenarioContext.Provider>;
}

export function useCaseScenarioRepo() {
  const context = useContext(CaseScenarioContext);
  if (!context) {
    throw new Error("useCaseScenarioRepo must be used within CaseScenarioProvider.");
  }
  return context;
}
