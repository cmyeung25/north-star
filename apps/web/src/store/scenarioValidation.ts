// Shape note: HomePosition schema originally validated purchase/downPayment/month/appreciation/mortgage (+feesOneTime).
// Added fields: holdingCostMonthly and holdingCostAnnualGrowthPct (percent) with non-negative bounds.
// Back-compat: absence of new fields is allowed.
import { z } from "zod";
import type { HomePosition } from "./scenarioStore";

const monthPattern = /^\d{4}-\d{2}$/;

const existingSchema = z.object({
  asOfMonth: z.string().regex(monthPattern, "validation.useYearMonth"),
  marketValue: z
    .number({ required_error: "validation.marketValueRequired" })
    .positive("validation.marketValuePositive"),
  mortgageBalance: z
    .number({ required_error: "validation.mortgageBalanceRequired" })
    .min(0, "validation.mortgageBalanceNonNegative"),
  remainingTermMonths: z
    .number({ required_error: "validation.remainingTermRequired" })
    .min(1, "validation.remainingTermMin")
    .max(600, "validation.remainingTermMax"),
  annualRatePct: z
    .number({ required_error: "validation.mortgageRateRequired" })
    .min(0, "validation.mortgageRateMin")
    .max(100, "validation.mortgageRateMax"),
});

const rentalSchema = z
  .object({
    rentMonthly: z
      .number({ required_error: "validation.rentMonthlyRequired" })
      .min(0, "validation.rentMonthlyMin"),
    rentStartMonth: z
      .string()
      .regex(monthPattern, "validation.useYearMonth"),
    rentEndMonth: z
      .string()
      .regex(monthPattern, "validation.useYearMonth")
      .optional()
      .nullable(),
    rentAnnualGrowthPct: z
      .number()
      .min(0, "validation.rentGrowthMin")
      .max(100, "validation.rentGrowthMax")
      .optional(),
    vacancyRatePct: z
      .number()
      .min(0, "validation.vacancyRateMin")
      .max(100, "validation.vacancyRateMax")
      .optional(),
  })
  .optional();

export const HomePositionSchema = z
  .object({
    usage: z.enum(["primary", "investment"]).optional(),
    mode: z.enum(["new_purchase", "existing"]).optional(),
    purchasePrice: z
      .number()
      .positive("validation.purchasePricePositive")
      .optional(),
    downPayment: z.number().min(0, "validation.downPaymentMin").optional(),
    purchaseMonth: z
      .string()
      .regex(monthPattern, "validation.useYearMonth")
      .optional(),
    annualAppreciationPct: z
      .number({ required_error: "validation.annualAppreciationRequired" })
      .min(0, "validation.annualAppreciationMin")
      .max(100, "validation.annualAppreciationMax"),
    mortgageRatePct: z
      .number()
      .min(0, "validation.mortgageRateMin")
      .max(100, "validation.mortgageRateMax")
      .optional(),
    mortgageTermYears: z
      .number()
      .min(1, "validation.mortgageTermMin")
      .max(50, "validation.mortgageTermMax")
      .optional(),
    feesOneTime: z
      .number()
      .min(0, "validation.feesOneTimeMin")
      .optional(),
    holdingCostMonthly: z
      .number()
      .min(0, "validation.holdingCostMonthlyMin")
      .optional(),
    holdingCostAnnualGrowthPct: z
      .number()
      .min(0, "validation.holdingCostGrowthMin")
      .max(100, "validation.holdingCostGrowthMax")
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
          message: "validation.existingHomeRequired",
          path: ["existing"],
        });
      }
      return;
    }

    if (typeof data.purchasePrice !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.purchasePriceRequired",
        path: ["purchasePrice"],
      });
    }
    if (typeof data.downPayment !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.downPaymentRequired",
        path: ["downPayment"],
      });
    }
    if (!data.purchaseMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.purchaseMonthRequired",
        path: ["purchaseMonth"],
      });
    }
    if (typeof data.mortgageRatePct !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.mortgageRateRequired",
        path: ["mortgageRatePct"],
      });
    }
    if (typeof data.mortgageTermYears !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.mortgageTermRequired",
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
        message: "validation.downPaymentExceedsPrice",
        path: ["downPayment"],
      });
    }
  });

export const getHomePositionErrors = (
  error: z.ZodError<HomePosition>,
  translate?: (key: string) => string
) => {
  const result: Partial<Record<string, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field && !result[field]) {
      result[field] = translate ? translate(issue.message) : issue.message;
    }
  }

  return result;
};
