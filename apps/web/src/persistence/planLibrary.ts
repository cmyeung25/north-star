import { nanoid } from "nanoid";
import type { PlanSnapshot } from "../domain/planLab/types";

export const PLAN_LIBRARY_KEY = "northstar:planlab:snapshots:v1";
const LEGACY_PLAN_LIBRARY_KEY = "northstar.planlab.library.v2";

const isBrowser =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

type SnapshotPatch = Partial<Omit<PlanSnapshot, "id" | "createdAt">>;

const normalizeSnapshot = (value: unknown): PlanSnapshot | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Partial<PlanSnapshot> & {
    scenarioId?: string;
    baselineFingerprint?: string;
  };
  if (typeof record.id !== "string" || typeof record.name !== "string") {
    return null;
  }
  const baselineScenarioId =
    typeof record.baselineScenarioId === "string"
      ? record.baselineScenarioId
      : typeof record.scenarioId === "string"
        ? record.scenarioId
        : "";
  if (!baselineScenarioId) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    notes: typeof record.notes === "string" ? record.notes : undefined,
    tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
    createdAt: typeof record.createdAt === "number" ? record.createdAt : Date.now(),
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : undefined,
    baselineScenarioId,
    baselineSignature:
      typeof record.baselineSignature === "string"
        ? record.baselineSignature
        : typeof record.baselineFingerprint === "string"
          ? record.baselineFingerprint
          : undefined,
    payload: record.payload ?? { eventsPatch: { add: [], update: [], remove: [] } },
    snapshot: record.snapshot ?? {},
  };
};

const parseSnapshots = (raw: string | null): PlanSnapshot[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => normalizeSnapshot(entry))
      .filter((entry): entry is PlanSnapshot => Boolean(entry));
  } catch {
    return [];
  }
};

const readLibrary = (): PlanSnapshot[] => {
  if (!isBrowser) {
    return [];
  }
  const snapshots = parseSnapshots(localStorage.getItem(PLAN_LIBRARY_KEY));
  if (snapshots.length > 0) {
    return snapshots;
  }
  const legacyRaw = localStorage.getItem(LEGACY_PLAN_LIBRARY_KEY);
  if (!legacyRaw) {
    return [];
  }
  try {
    const parsed = JSON.parse(legacyRaw) as Record<string, unknown[]>;
    const migrated = Object.values(parsed ?? {})
      .flat()
      .map((entry) => normalizeSnapshot(entry))
      .filter((entry): entry is PlanSnapshot => Boolean(entry));
    if (migrated.length > 0) {
      localStorage.setItem(PLAN_LIBRARY_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return [];
  }
};

const writeLibrary = (snapshots: PlanSnapshot[]) => {
  if (!isBrowser) {
    return;
  }
  localStorage.setItem(PLAN_LIBRARY_KEY, JSON.stringify(snapshots));
};

export const loadSnapshots = (): PlanSnapshot[] => {
  return readLibrary().sort((a, b) => {
    const aTime = a.updatedAt ?? a.createdAt;
    const bTime = b.updatedAt ?? b.createdAt;
    return bTime - aTime;
  });
};

export const saveSnapshot = (newSnapshot: PlanSnapshot): void => {
  const snapshots = readLibrary();
  const next = [
    newSnapshot,
    ...snapshots.filter((entry) => entry.id !== newSnapshot.id),
  ];
  writeLibrary(next);
};

export const updateSnapshot = (id: string, patch: SnapshotPatch): void => {
  const snapshots = readLibrary();
  const next = snapshots.map((snapshot) =>
    snapshot.id === id
      ? {
          ...snapshot,
          ...patch,
        }
      : snapshot
  );
  writeLibrary(next);
};

export const deleteSnapshot = (id: string): void => {
  const snapshots = readLibrary();
  writeLibrary(snapshots.filter((snapshot) => snapshot.id !== id));
};

export const duplicateSnapshot = (id: string): void => {
  const snapshots = readLibrary();
  const target = snapshots.find((snapshot) => snapshot.id === id);
  if (!target) {
    return;
  }
  const timestamp = Date.now();
  const copy: PlanSnapshot = {
    ...target,
    id: nanoid(),
    name: `${target.name} (copy)`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  writeLibrary([copy, ...snapshots]);
};

export const listPlanSnapshots = (scenarioId: string): PlanSnapshot[] => {
  return loadSnapshots().filter((snapshot) => snapshot.baselineScenarioId === scenarioId);
};

export const listAllPlanSnapshots = (): PlanSnapshot[] => {
  return loadSnapshots();
};

export const savePlanSnapshot = (plan: PlanSnapshot): PlanSnapshot => {
  saveSnapshot(plan);
  return plan;
};

export const duplicatePlanSnapshot = (plan: PlanSnapshot): PlanSnapshot => {
  const timestamp = Date.now();
  const copy: PlanSnapshot = {
    ...plan,
    id: nanoid(),
    name: `${plan.name} (copy)`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  saveSnapshot(copy);
  return copy;
};

export const deletePlanSnapshot = (_scenarioId: string, planId: string) => {
  deleteSnapshot(planId);
};

export const renamePlanSnapshot = (_scenarioId: string, planId: string, name: string) => {
  updateSnapshot(planId, { name, updatedAt: Date.now() });
};
