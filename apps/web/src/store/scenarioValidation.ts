// Shape note: HomePosition schema originally validated purchase/downPayment/month/appreciation/mortgage (+feesOneTime).
// Added fields: holdingCostMonthly and holdingCostAnnualGrowthPct (percent) with non-negative bounds.
// Back-compat: absence of new fields is allowed.
import { z } from "zod";
import type { CarPosition, HomePosition, InvestmentPosition, LoanPosition } from "./scenarioStore";

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
      .min(-100, "validation.annualAppreciationMin")
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

export const CarPositionSchema = z
  .object({
    purchaseMonth: z
      .string({ required_error: "validation.purchaseMonthRequired" })
      .regex(monthPattern, "validation.useYearMonth"),
    purchasePrice: z
      .number({ required_error: "validation.purchasePriceRequired" })
      .positive("validation.purchasePricePositive"),
    downPayment: z.number().min(0, "validation.downPaymentMin"),
    annualDepreciationRatePct: z
      .number({ required_error: "validation.annualDepreciationRequired" })
      .min(0, "validation.annualDepreciationMin")
      .max(100, "validation.annualDepreciationMax"),
    holdingCostMonthly: z
      .number({ required_error: "validation.holdingCostMonthlyRequired" })
      .min(0, "validation.holdingCostMonthlyMin"),
    holdingCostAnnualGrowthPct: z
      .number({ required_error: "validation.holdingCostGrowthRequired" })
      .min(0, "validation.holdingCostGrowthMin")
      .max(100, "validation.holdingCostGrowthMax"),
    loan: z
      .object({
        principal: z
          .number({ required_error: "validation.loanPrincipalRequired" })
          .positive("validation.loanPrincipalPositive"),
        annualInterestRatePct: z
          .number({ required_error: "validation.loanRateRequired" })
          .min(0, "validation.loanRateMin")
          .max(100, "validation.loanRateMax"),
        termYears: z
          .number({ required_error: "validation.loanTermRequired" })
          .min(1, "validation.loanTermMin")
          .max(50, "validation.loanTermMax"),
        monthlyPayment: z.number().min(0, "validation.loanPaymentMin").optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.downPayment > data.purchasePrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.downPaymentExceedsPrice",
        path: ["downPayment"],
      });
    }
  });

export const InvestmentPositionSchema = z.object({
  startMonth: z
    .string({ required_error: "validation.startMonthRequired" })
    .regex(monthPattern, "validation.useYearMonth"),
  initialValue: z
    .number({ required_error: "validation.initialValueRequired" })
    .min(0, "validation.initialValueMin"),
  assetClass: z.enum(["equity", "bond", "fund", "crypto"]).optional(),
  expectedAnnualReturnPct: z
    .number()
    .min(-100, "validation.returnRateMin")
    .max(100, "validation.returnRateMax")
    .optional(),
  monthlyContribution: z
    .number()
    .min(0, "validation.monthlyContributionMin")
    .optional(),
  monthlyWithdrawal: z
    .number()
    .min(0, "validation.monthlyWithdrawalMin")
    .optional(),
  feeAnnualRatePct: z
    .number()
    .min(0, "validation.feeRateMin")
    .max(100, "validation.feeRateMax")
    .optional(),
});

export const LoanPositionSchema = z.object({
  startMonth: z
    .string({ required_error: "validation.startMonthRequired" })
    .regex(monthPattern, "validation.useYearMonth"),
  principal: z
    .number({ required_error: "validation.loanPrincipalRequired" })
    .positive("validation.loanPrincipalPositive"),
  annualInterestRatePct: z
    .number({ required_error: "validation.loanRateRequired" })
    .min(0, "validation.loanRateMin")
    .max(100, "validation.loanRateMax"),
  termYears: z
    .number({ required_error: "validation.loanTermRequired" })
    .min(1, "validation.loanTermMin")
    .max(50, "validation.loanTermMax"),
  monthlyPayment: z.number().min(0, "validation.loanPaymentMin").optional(),
  feesOneTime: z.number().min(0, "validation.feesOneTimeMin").optional(),
});

export const getCarPositionErrors = (
  error: z.ZodError<CarPosition>,
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

export const getInvestmentPositionErrors = (
  error: z.ZodError<InvestmentPosition>,
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

export const getLoanPositionErrors = (
  error: z.ZodError<LoanPosition>,
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
