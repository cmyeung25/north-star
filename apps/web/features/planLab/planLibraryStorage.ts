import type { PlanSnapshot } from "../../src/domain/planLab/types";

type PlanLibraryState = {
  version: 1;
  plansByScenario: Record<string, PlanSnapshot[]>;
};

const STORAGE_KEY = "planLabLibrary:v1";

const readState = (): PlanLibraryState => {
  if (typeof window === "undefined") {
    return { version: 1, plansByScenario: {} };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { version: 1, plansByScenario: {} };
  }
  try {
    const parsed = JSON.parse(raw) as PlanLibraryState;
    if (!parsed || parsed.version !== 1) {
      return { version: 1, plansByScenario: {} };
    }
    return {
      version: 1,
      plansByScenario: parsed.plansByScenario ?? {},
    };
  } catch {
    return { version: 1, plansByScenario: {} };
  }
};

const writeState = (state: PlanLibraryState) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const listPlansByScenario = (scenarioId: string): PlanSnapshot[] => {
  const state = readState();
  return state.plansByScenario[scenarioId] ?? [];
};

export const listAllPlans = (): PlanSnapshot[] => {
  const state = readState();
  return Object.values(state.plansByScenario).flat();
};

export const savePlanSnapshot = (plan: PlanSnapshot) => {
  const state = readState();
  const plans = state.plansByScenario[plan.scenarioId] ?? [];
  state.plansByScenario[plan.scenarioId] = [...plans, plan];
  writeState(state);
};

export const updatePlanSnapshot = (plan: PlanSnapshot) => {
  const state = readState();
  const plans = state.plansByScenario[plan.scenarioId] ?? [];
  state.plansByScenario[plan.scenarioId] = plans.map((entry) =>
    entry.id === plan.id ? plan : entry
  );
  writeState(state);
};

export const deletePlanSnapshot = (scenarioId: string, planId: string) => {
  const state = readState();
  const plans = state.plansByScenario[scenarioId] ?? [];
  state.plansByScenario[scenarioId] = plans.filter((plan) => plan.id !== planId);
  writeState(state);
};

export const renamePlanSnapshot = (
  scenarioId: string,
  planId: string,
  name: string
) => {
  const state = readState();
  const plans = state.plansByScenario[scenarioId] ?? [];
  state.plansByScenario[scenarioId] = plans.map((plan) =>
    plan.id === planId ? { ...plan, name, updatedAt: Date.now() } : plan
  );
  writeState(state);
};

export const duplicatePlanSnapshot = (plan: PlanSnapshot) => {
  const state = readState();
  const plans = state.plansByScenario[plan.scenarioId] ?? [];
  state.plansByScenario[plan.scenarioId] = [...plans, plan];
  writeState(state);
};
