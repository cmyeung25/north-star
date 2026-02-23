import type { ScenarioAssumptions } from "../../store/scenarioStore";

export type AssumptionsPresetKey = "conservative" | "baseline" | "growth";

export type AssumptionsPreset = Partial<
  Pick<
    ScenarioAssumptions,
    | "inflationRate"
    | "salaryGrowthRate"
    | "emergencyFundMonths"
    | "rentAnnualGrowthPct"
    | "propertyAppreciationPct"
    | "cashYieldPct"
    | "carDepreciationRatePct"
  >
>;

export const ASSUMPTION_PRESETS: Record<AssumptionsPresetKey, AssumptionsPreset> = {
  conservative: {
    inflationRate: 3,
    salaryGrowthRate: 1,
    emergencyFundMonths: 9,
    rentAnnualGrowthPct: 3,
    propertyAppreciationPct: 1,
    cashYieldPct: 2,
    carDepreciationRatePct: 16,
  },
  baseline: {
    inflationRate: 2,
    salaryGrowthRate: 2,
    emergencyFundMonths: 6,
    rentAnnualGrowthPct: 2,
    propertyAppreciationPct: 2,
    cashYieldPct: 2,
    carDepreciationRatePct: 14,
  },
  growth: {
    inflationRate: 2,
    salaryGrowthRate: 4,
    emergencyFundMonths: 4,
    rentAnnualGrowthPct: 2.5,
    propertyAppreciationPct: 4,
    cashYieldPct: 3,
    carDepreciationRatePct: 12,
  },
};

