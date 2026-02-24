import type { ScenarioAssumptions } from "../../store/scenarioStore";

type ScenarioAssumptionsGuardrailInput = Partial<
  Pick<ScenarioAssumptions, "inflationRate" | "salaryGrowthRate">
>;

export type AssumptionGuardrailWarning = {
  code: "inflationOutOfComfortRange" | "salaryInflationGapTooWide";
  suggestion: ScenarioAssumptionsGuardrailInput;
  context: {
    inflationRate: number;
    salaryGrowthRate?: number;
    gap?: number;
  };
};

const INFLATION_COMFORT_MIN = -5;
const INFLATION_COMFORT_MAX = 10;
const SALARY_INFLATION_GAP_COMFORT_MAX = 8;

export function getAssumptionGuardrailWarnings(
  values: ScenarioAssumptionsGuardrailInput
): AssumptionGuardrailWarning[] {
  const warnings: AssumptionGuardrailWarning[] = [];
  const inflationRate = values.inflationRate;
  const salaryGrowthRate = values.salaryGrowthRate;

  if (
    typeof inflationRate === "number" &&
    (inflationRate < INFLATION_COMFORT_MIN || inflationRate > INFLATION_COMFORT_MAX)
  ) {
    warnings.push({
      code: "inflationOutOfComfortRange",
      suggestion: { inflationRate: Math.min(Math.max(inflationRate, 1), 4) },
      context: { inflationRate },
    });
  }

  if (typeof salaryGrowthRate === "number" && typeof inflationRate === "number") {
    const gap = Math.abs(salaryGrowthRate - inflationRate);
    if (gap > SALARY_INFLATION_GAP_COMFORT_MAX) {
      warnings.push({
        code: "salaryInflationGapTooWide",
        suggestion: {
          inflationRate: Math.min(Math.max(inflationRate, 1), 4),
          salaryGrowthRate: Math.min(Math.max(salaryGrowthRate, 2), 6),
        },
        context: { salaryGrowthRate, inflationRate, gap },
      });
    }
  }

  return warnings;
}
