// Shape note: HomePosition schema originally validated purchase/downPayment/month/appreciation/mortgage (+feesOneTime).
// Added fields: holdingCostMonthly and holdingCostAnnualGrowthPct (percent) with non-negative bounds.
// Back-compat: absence of new fields is allowed.
import { z } from "zod";
import type { HomePosition } from "./scenarioStore";

const monthPattern = /^\d{4}-\d{2}$/;

const existingSchema = z.object({
  asOfMonth: z.string().regex(monthPattern, "Use YYYY-MM (e.g. 2025-01)."),
  marketValue: z
    .number({ required_error: "Market value is required." })
    .positive("Market value must be greater than 0."),
  mortgageBalance: z
    .number({ required_error: "Mortgage balance is required." })
    .min(0, "Mortgage balance must be 0 or higher."),
  remainingTermMonths: z
    .number({ required_error: "Remaining term is required." })
    .min(1, "Remaining term must be at least 1 month.")
    .max(600, "Remaining term must be 600 months or less."),
  annualRatePct: z
    .number({ required_error: "Mortgage rate is required." })
    .min(0, "Mortgage rate must be 0 or higher.")
    .max(100, "Mortgage rate must be 100 or lower."),
});

const rentalSchema = z
  .object({
    rentMonthly: z
      .number({ required_error: "Monthly rent is required." })
      .min(0, "Monthly rent must be 0 or higher."),
    rentStartMonth: z
      .string()
      .regex(monthPattern, "Use YYYY-MM (e.g. 2025-01)."),
    rentEndMonth: z
      .string()
      .regex(monthPattern, "Use YYYY-MM (e.g. 2025-01).")
      .optional()
      .nullable(),
    rentAnnualGrowthPct: z
      .number()
      .min(0, "Rent growth must be 0 or higher.")
      .max(100, "Rent growth must be 100 or lower.")
      .optional(),
    vacancyRatePct: z
      .number()
      .min(0, "Vacancy rate must be 0 or higher.")
      .max(100, "Vacancy rate must be 100 or lower.")
      .optional(),
  })
  .optional();

export const HomePositionSchema = z
  .object({
    usage: z.enum(["primary", "investment"]).optional(),
    mode: z.enum(["new_purchase", "existing"]).optional(),
    purchasePrice: z.number().positive("Purchase price must be greater than 0.").optional(),
    downPayment: z.number().min(0, "Down payment must be 0 or higher.").optional(),
    purchaseMonth: z
      .string()
      .regex(monthPattern, "Use YYYY-MM (e.g. 2025-01).")
      .optional(),
    annualAppreciationPct: z
      .number({ required_error: "Annual appreciation is required." })
      .min(0, "Annual appreciation must be 0 or higher.")
      .max(100, "Annual appreciation must be 100 or lower."),
    mortgageRatePct: z
      .number()
      .min(0, "Mortgage rate must be 0 or higher.")
      .max(100, "Mortgage rate must be 100 or lower.")
      .optional(),
    mortgageTermYears: z
      .number()
      .min(1, "Mortgage term must be at least 1 year.")
      .max(50, "Mortgage term must be 50 years or less.")
      .optional(),
    feesOneTime: z
      .number()
      .min(0, "One-time fees must be 0 or higher.")
      .optional(),
    holdingCostMonthly: z
      .number()
      .min(0, "Monthly holding cost must be 0 or higher.")
      .optional(),
    holdingCostAnnualGrowthPct: z
      .number()
      .min(0, "Holding cost growth must be 0 or higher.")
      .max(100, "Holding cost growth must be 100 or lower.")
      .optional(),
    existing: existingSchema.optional(),
    rental: rentalSchema,
  })
  .superRefine((data, ctx) => {
    const mode = data.mode ?? "new_purchase";
    if (mode === "existing") {
      if (!data.existing) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Existing home details are required.",
          path: ["existing"],
        });
      }
      return;
    }

    if (typeof data.purchasePrice !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Purchase price is required.",
        path: ["purchasePrice"],
      });
    }
    if (typeof data.downPayment !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Down payment is required.",
        path: ["downPayment"],
      });
    }
    if (!data.purchaseMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Purchase month is required.",
        path: ["purchaseMonth"],
      });
    }
    if (typeof data.mortgageRatePct !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mortgage rate is required.",
        path: ["mortgageRatePct"],
      });
    }
    if (typeof data.mortgageTermYears !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mortgage term is required.",
        path: ["mortgageTermYears"],
      });
    }

    if (
      typeof data.purchasePrice === "number" &&
      typeof data.downPayment === "number" &&
      data.downPayment > data.purchasePrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Down payment must not exceed purchase price.",
        path: ["downPayment"],
      });
    }
  });

export const getHomePositionErrors = (error: z.ZodError<HomePosition>) => {
  const result: Partial<Record<string, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field && !result[field]) {
      result[field] = issue.message;
    }
  }

  return result;
};
