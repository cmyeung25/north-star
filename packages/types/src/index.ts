import { z } from "zod";

export const EventSchema = z.object({
  enabled: z.boolean(),
  startMonth: z.string(),
  endMonth: z.string().nullable(),
  monthlyAmount: z.number().optional(),
  oneTimeAmount: z.number().optional(),
  annualGrowthPct: z.number().optional(),
});

export const AssumptionsSchema = z.object({
  horizonMonths: z.number().int().positive(),
  emergencyFundMonths: z.number().min(0),
});

export const ScenarioSchema = z.object({
  schemaVersion: z.string(),
  engineVersion: z.string(),
  name: z.string(),
  createdAt: z.string(),
  assumptions: AssumptionsSchema,
  events: z.array(EventSchema),
});

export type Event = z.infer<typeof EventSchema>;
export type Assumptions = z.infer<typeof AssumptionsSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
