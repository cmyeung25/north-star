import { z } from "zod";

const PERCENTAGE_HARD_FLOOR = -99.99;

const growthRateSchema = z
  .number()
  .min(PERCENTAGE_HARD_FLOOR, "validation.assumptionGrowthHardMin")
  .min(-50, "validation.assumptionGrowthMin")
  .max(50, "validation.assumptionGrowthMax");

const nonNegativePctSchema = z
  .number()
  .min(0, "validation.assumptionNonNegativeMin")
  .max(50, "validation.assumptionGrowthMax");

export const scenarioAssumptionConstraints = {
  inflationRate: { min: -50, max: 50, step: 0.1 },
  salaryGrowthRate: { min: -50, max: 50, step: 0.1 },
  rentAnnualGrowthPct: { min: -50, max: 50, step: 0.1 },
  propertyAppreciationPct: { min: -50, max: 50, step: 0.1 },
  cashYieldPct: { min: -50, max: 50, step: 0.1 },
  carDepreciationRatePct: { min: 0, max: 50, step: 0.1 },
  emergencyFundMonths: { min: 0, max: 24, step: 1 },
} as const;

export const scenarioAssumptionSchema = z.object({
  inflationRate: growthRateSchema.optional(),
  salaryGrowthRate: growthRateSchema.optional(),
  rentAnnualGrowthPct: growthRateSchema.optional(),
  propertyAppreciationPct: growthRateSchema.optional(),
  cashYieldPct: growthRateSchema.optional(),
  carDepreciationRatePct: nonNegativePctSchema.optional(),
  emergencyFundMonths: z
    .number()
    .min(scenarioAssumptionConstraints.emergencyFundMonths.min, "validation.assumptionNonNegativeMin")
    .max(scenarioAssumptionConstraints.emergencyFundMonths.max, "validation.emergencyFundMax")
    .optional(),
});

export type ScenarioAssumptionSchemaInput = z.input<typeof scenarioAssumptionSchema>;
