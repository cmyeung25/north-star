export const PLANNING_HORIZON_YEARS = [3, 5, 10] as const;
export type PlanningHorizonYears = (typeof PLANNING_HORIZON_YEARS)[number];

export const DEFAULT_PLANNING_HORIZON_YEARS: PlanningHorizonYears = 5;

export const isPlanningHorizonYears = (
  value: number | undefined
): value is PlanningHorizonYears =>
  PLANNING_HORIZON_YEARS.includes(value as PlanningHorizonYears);

export const resolvePlanningHorizonMonths = (years?: number) => {
  if (years === 3) {
    return 36;
  }
  if (years === 10) {
    return 120;
  }
  return 60;
};
