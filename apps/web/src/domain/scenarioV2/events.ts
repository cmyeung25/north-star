import { z } from "zod";

export type MonthKey = string;

const monthKeyPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export const MonthKeySchema = z.string().regex(monthKeyPattern, "validation.useYearMonth");

export const EventTagSchema = z.array(z.string()).optional();

const BaseEventSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  memberId: z.string().optional(),
  tags: EventTagSchema,
});

export const CashflowEventSchemaBase = BaseEventSchema.extend({
  type: z.literal("cashflow"),
  kind: z.enum(["income", "expense"]),
  cadence: z.enum(["monthly", "quarterly", "yearly", "oneOff", "everyNMonths"]),
  amount: z.number(),
  startMonth: MonthKeySchema.optional(),
  endMonth: MonthKeySchema.optional(),
  occurrenceMonth: MonthKeySchema.optional(),
  everyNMonths: z.number().int().min(1).optional(),
});

export const CashflowEventSchema = CashflowEventSchemaBase.superRefine(
  (event, ctx) => {
    if (event.cadence === "oneOff") {
      if (!event.occurrenceMonth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validation.occurrenceMonthRequired",
          path: ["occurrenceMonth"],
        });
      }
      return;
    }

    if (!event.startMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.startMonthRequired",
        path: ["startMonth"],
      });
    }

    if (event.cadence === "everyNMonths" && !event.everyNMonths) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.everyNMonthsRequired",
        path: ["everyNMonths"],
      });
    }
  }
);

const validateCashflowFields = (
  event: z.infer<typeof CashflowEventSchemaBase>,
  ctx: z.RefinementCtx
) => {
  if (event.cadence === "oneOff") {
    if (!event.occurrenceMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.occurrenceMonthRequired",
        path: ["occurrenceMonth"],
      });
    }
    return;
  }

  if (!event.startMonth) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validation.startMonthRequired",
      path: ["startMonth"],
    });
  }

  if (event.cadence === "everyNMonths" && !event.everyNMonths) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validation.everyNMonthsRequired",
      path: ["everyNMonths"],
    });
  }
};

export const HousingEventSchema = BaseEventSchema.extend({
  type: z.literal("housing"),
  kind: z.enum(["rent", "own"]),
  startMonth: MonthKeySchema,
  endMonth: MonthKeySchema.optional(),
  rentMonthly: z.number().optional(),
  rentAnnualGrowthPct: z.number().optional(),
  purchasePrice: z.number().optional(),
  downPayment: z.number().optional(),
  mortgageRatePct: z.number().optional(),
  mortgageTermYears: z.number().optional(),
  holdingCostMonthly: z.number().optional(),
  holdingCostAnnualGrowthPct: z.number().optional(),
  linkedAssetId: z.string().optional(),
});

export const LoanEventSchema = BaseEventSchema.extend({
  type: z.literal("loan"),
  kind: z.enum(["mortgage", "loan", "carLoan", "other"]),
  startMonth: MonthKeySchema,
  principal: z.number(),
  annualInterestRatePct: z.number(),
  termYears: z.number(),
  monthlyPayment: z.number().optional(),
  paymentMethod: z.enum(["amortization", "manual"]).optional(),
  linkedLiabilityId: z.string().optional(),
});

export const InsuranceEventSchema = BaseEventSchema.extend({
  type: z.literal("insurance"),
  kind: z.enum(["protection", "savings"]),
  startMonth: MonthKeySchema,
  endMonth: MonthKeySchema.optional(),
  premiumMonthly: z.number(),
  premiumAnnualGrowthPct: z.number().optional(),
  initialCashValue: z.number().optional(),
  expectedAnnualReturnPct: z.number().optional(),
});

export const AdjustmentEventSchema = BaseEventSchema.extend({
  type: z.literal("adjustment"),
  kind: z.enum(["asset", "liability", "cash"]),
  month: MonthKeySchema,
  amount: z.number(),
});

export const ScenarioEventSchema = z
  .discriminatedUnion("type", [
    CashflowEventSchemaBase,
    HousingEventSchema,
    LoanEventSchema,
    InsuranceEventSchema,
    AdjustmentEventSchema,
  ])
  .superRefine((event, ctx) => {
    if (event.type === "cashflow") {
      validateCashflowFields(event, ctx);
    }
  });

export type CashflowEvent = z.infer<typeof CashflowEventSchemaBase>;
export type HousingEvent = z.infer<typeof HousingEventSchema>;
export type LoanEvent = z.infer<typeof LoanEventSchema>;
export type InsuranceEvent = z.infer<typeof InsuranceEventSchema>;
export type AdjustmentEvent = z.infer<typeof AdjustmentEventSchema>;
export type ScenarioEvent =
  | CashflowEvent
  | HousingEvent
  | LoanEvent
  | InsuranceEvent
  | AdjustmentEvent;

export type ScenarioEventDraft =
  | (Omit<CashflowEvent, "id"> & { id?: string })
  | (Omit<HousingEvent, "id"> & { id?: string })
  | (Omit<LoanEvent, "id"> & { id?: string })
  | (Omit<InsuranceEvent, "id"> & { id?: string })
  | (Omit<AdjustmentEvent, "id"> & { id?: string });
