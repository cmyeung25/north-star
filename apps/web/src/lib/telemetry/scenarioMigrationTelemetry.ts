import type { ScenarioDraftSource } from "../../domain/scenarioDraft/submitScenarioDraft";

const STORAGE_KEY = "scenario:migration:telemetry";
const EVENT_LIMIT = 200;

export type ScenarioMigrationTelemetryEvent = {
  name:
    | "scenario_draft_compile_failed"
    | "scenario_submission_started"
    | "scenario_submission_succeeded"
    | "scenario_submission_failed"
    | "scenario_double_count_warning_detected"
    | "onboarding_started"
    | "onboarding_completed"
    | "lifecycle_resolved"
    | "scenario_save_failed"
    | "route_redirect_anomaly";
  ts: string;
  scenarioId?: string;
  source?: ScenarioDraftSource;
  route?: string;
  lifecycle?: "draft" | "active";
  reason?: string;
  details?: Record<string, unknown>;
};

const loadEvents = (): ScenarioMigrationTelemetryEvent[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) {
      return [];
    }
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const recordScenarioMigrationEvent = (event: ScenarioMigrationTelemetryEvent) => {
  if (typeof window === "undefined") {
    return;
  }

  const next = [...loadEvents(), event].slice(-EVENT_LIMIT);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const readScenarioMigrationEvents = loadEvents;
export const scenarioMigrationTelemetryStorageKey = STORAGE_KEY;
