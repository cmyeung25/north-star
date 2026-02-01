import { nanoid } from "nanoid";
import type { PlanSnapshot } from "../domain/planLab/types";

export const PLAN_LIBRARY_KEY = "northstar.planlab.library.v2";

const isBrowser =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readLibrary = (): Record<string, PlanSnapshot[]> => {
  if (!isBrowser) {
    return {};
  }
  const raw = localStorage.getItem(PLAN_LIBRARY_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, PlanSnapshot[]>;
    return parsed ?? {};
  } catch {
    return {};
  }
};

const writeLibrary = (library: Record<string, PlanSnapshot[]>) => {
  if (!isBrowser) {
    return;
  }
  localStorage.setItem(PLAN_LIBRARY_KEY, JSON.stringify(library));
};

export const listPlanSnapshots = (scenarioId: string): PlanSnapshot[] => {
  const library = readLibrary();
  return library[scenarioId] ?? [];
};

export const listAllPlanSnapshots = (): PlanSnapshot[] => {
  const library = readLibrary();
  return Object.values(library).flat();
};

export const savePlanSnapshot = (plan: PlanSnapshot): PlanSnapshot => {
  const library = readLibrary();
  const existing = library[plan.scenarioId] ?? [];
  const next = [...existing.filter((entry) => entry.id !== plan.id), plan];
  library[plan.scenarioId] = next;
  writeLibrary(library);
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
  return savePlanSnapshot(copy);
};

export const deletePlanSnapshot = (scenarioId: string, planId: string) => {
  const library = readLibrary();
  const next = (library[scenarioId] ?? []).filter((plan) => plan.id !== planId);
  library[scenarioId] = next;
  writeLibrary(library);
};

export const renamePlanSnapshot = (
  scenarioId: string,
  planId: string,
  name: string
) => {
  const library = readLibrary();
  library[scenarioId] = (library[scenarioId] ?? []).map((plan) =>
    plan.id === planId ? { ...plan, name, updatedAt: Date.now() } : plan
  );
  writeLibrary(library);
};
