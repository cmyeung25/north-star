import type { PlanLabExperiment } from "./types";

export const selectEnabledPlanLabExperiments = (
  experiments?: PlanLabExperiment[] | null
): PlanLabExperiment[] => (experiments ?? []).filter((experiment) => experiment.isEnabled !== false);
