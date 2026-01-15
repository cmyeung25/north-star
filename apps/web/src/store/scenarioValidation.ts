import { z } from "zod";
import type { HomePosition } from "./scenarioStore";

const monthPattern = /^\d{4}-\d{2}$/;

export const HomePositionSchema = z
  .object({
    purchasePrice: z
      .number({ required_error: "Purchase price is required." })
      .positive("Purchase price must be greater than 0."),
    downPayment: z
      .number({ required_error: "Down payment is required." })
      .min(0, "Down payment must be 0 or higher."),
    purchaseMonth: z.string().regex(monthPattern, "Use YYYY-MM (e.g. 2025-01)."),
    annualAppreciationPct: z
      .number({ required_error: "Annual appreciation is required." })
      .min(0, "Annual appreciation must be 0 or higher.")
      .max(100, "Annual appreciation must be 100 or lower."),
    mortgageRatePct: z
      .number({ required_error: "Mortgage rate is required." })
      .min(0, "Mortgage rate must be 0 or higher.")
      .max(100, "Mortgage rate must be 100 or lower."),
    mortgageTermYears: z
      .number({ required_error: "Mortgage term is required." })
      .min(1, "Mortgage term must be at least 1 year.")
      .max(50, "Mortgage term must be 50 years or less."),
    feesOneTime: z
      .number()
      .min(0, "One-time fees must be 0 or higher.")
      .optional(),
  })
  .refine((data) => data.downPayment <= data.purchasePrice, {
    message: "Down payment must not exceed purchase price.",
    path: ["downPayment"],
  });

export const getHomePositionErrors = (error: z.ZodError<HomePosition>) => {
  const result: Partial<Record<keyof HomePosition, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path[0] as keyof HomePosition | undefined;
    if (field && !result[field]) {
      result[field] = issue.message;
    }
  }

  return result;
};
