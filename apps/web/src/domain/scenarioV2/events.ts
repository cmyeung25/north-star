import { z } from "zod";

export type MonthKey = string;

const monthKeyPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export const MonthKeySchema = z.string().regex(monthKeyPattern, "validation.useYearMonth");

export const EventTagSchema = z.array(z.string()).optional();

export const EventSourceSchema = z
  .object({
    bundleInstanceId: z.string().optional(),
    templateId: z.string().optional(),
    componentKey: z.string().optional(),
    bundleTitle: z.string().optional(),
  })
  .optional();

const BaseEventSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  memberId: z.string().optional(),
  tags: EventTagSchema,
  source: EventSourceSchema,
  seriesId: z.string().optional(),
  parentEventId: z.string().optional(),
  groupId: z.string().optional(),
  groupRole: z.enum(["base", "adjustment"]).optional(),
  effectiveMonth: MonthKeySchema.optional(),
  meta: z
    .object({
      kind: z.enum(["base", "adjustment"]).optional(),
      adjustsEventId: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export const CashflowEventSchemaBase = BaseEventSchema.extend({
  type: z.literal("cashflow"),
  kind: z.enum(["income", "expense"]),
  cadence: z.enum(["monthly", "quarterly", "yearly", "oneOff", "everyNMonths"]),
  amount: z.number(),
  growthMode: z.enum(["none", "assumption", "custom"]).optional(),
  growthSource: z.enum(["inflation", "rentGrowth"]).optional(),
  customGrowthRatePct: z.number().optional(),
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

const HousingEventSchemaBase = BaseEventSchema.extend({
  type: z.literal("housing"),
  kind: z.enum(["rent", "mortgage"]),
  startMonth: MonthKeySchema,
  endMonth: MonthKeySchema.optional(),
  rentMonthly: z.number().optional(),
  rentAnnualGrowthPct: z.number().optional(),
  rentGrowthMode: z.enum(["none", "assumption", "custom"]).optional(),
  purchasePrice: z.number().optional(),
  propertyMarketValue: z.number().optional(),
  propertyAnnualGrowthPct: z.number().optional(),
  propertyGrowthMode: z.enum(["none", "assumption", "custom"]).optional(),
  mortgageBaseValue: z.number().optional(),
  mortgageBaseMode: z.enum(["SYNC", "CUSTOM"]).optional(),
  downPaymentMode: z.enum(["percent", "amount"]).optional(),
  downPaymentPercent: z.number().optional(),
  downPaymentAmount: z.number().optional(),
  mortgageRatePct: z.number().optional(),
  mortgageTermYears: z.number().optional(),
  mortgagePayment: z.number().optional(),
  mortgagePaymentIsEstimated: z.boolean().optional(),
  feesOneOff: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        amount: z.number(),
        month: MonthKeySchema,
      })
    )
    .optional(),
  ongoingCosts: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().optional(),
        amount: z.number(),
        startMonth: MonthKeySchema,
        endMonth: MonthKeySchema.optional(),
      })
    )
    .optional(),
  rental: z
    .object({
      enabled: z.boolean().optional(),
      rentMonthly: z.number().optional(),
      startMonth: MonthKeySchema.optional(),
      endMonth: MonthKeySchema.optional(),
      vacancyRatePct: z.number().optional(),
      rentAnnualGrowthPct: z.number().optional(),
      rentGrowthMode: z.enum(["none", "assumption", "custom"]).optional(),
    })
    .optional(),
  propertyAssetId: z.string().optional(),
  mortgageLiabilityId: z.string().optional(),
});

const validateHousingEvent = (
  event: z.infer<typeof HousingEventSchemaBase>,
  ctx: z.RefinementCtx
) => {
  if (event.kind === "rent") {
    if (typeof event.rentMonthly !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.rentMonthlyRequired",
        path: ["rentMonthly"],
      });
    }
    return;
  }

  if (!event.propertyAssetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validation.propertyAssetIdRequired",
      path: ["propertyAssetId"],
    });
  }
  if (!event.mortgageLiabilityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validation.mortgageLiabilityIdRequired",
      path: ["mortgageLiabilityId"],
    });
  }
  if (
    typeof event.purchasePrice !== "number" &&
    typeof event.propertyMarketValue !== "number"
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validation.purchasePriceRequired",
      path: ["purchasePrice"],
    });
  }
  if (typeof event.mortgageRatePct !== "number") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validation.mortgageRateRequired",
      path: ["mortgageRatePct"],
    });
  }
  if (typeof event.mortgageTermYears !== "number") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validation.mortgageTermRequired",
      path: ["mortgageTermYears"],
    });
  }
  if (event.rental?.enabled) {
    if (typeof event.rental.rentMonthly !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.rentalMonthlyRequired",
        path: ["rental", "rentMonthly"],
      });
    }
    if (!event.rental.startMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.rentalStartMonthRequired",
        path: ["rental", "startMonth"],
      });
    }
  }
};

export const HousingEventSchema = HousingEventSchemaBase.superRefine(
  validateHousingEvent
);

const LoanEventSchemaBase = BaseEventSchema.extend({
  type: z.literal("loan"),
  loanKind: z.enum(["car", "personal", "credit", "other"]),
  startMonth: MonthKeySchema,
  principal: z.number(),
  annualInterestRatePct: z.number(),
  termYears: z.number(),
  monthlyPayment: z.number().optional(),
  paymentMethod: z.enum(["amortization", "manual"]).optional(),
  paymentIsEstimated: z.boolean().optional(),
  purchasePrice: z.number().optional(),
  downPaymentMode: z.enum(["percent", "amount"]).optional(),
  downPaymentPercent: z.number().optional(),
  downPaymentAmount: z.number().optional(),
  liabilityId: z.string(),
});

const validateLoanEvent = (
  event: z.infer<typeof LoanEventSchemaBase>,
  ctx: z.RefinementCtx
) => {
  if (event.loanKind === "car") {
    if (typeof event.purchasePrice !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.purchasePriceRequired",
        path: ["purchasePrice"],
      });
    }
  }
};

export const LoanEventSchema = LoanEventSchemaBase.superRefine(validateLoanEvent);

const InsurancePolicySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  kind: z.enum(["protection", "savings"]),
  startMonth: MonthKeySchema,
  endMonth: MonthKeySchema.optional(),
  premiumMonthly: z.number(),
  premiumAnnualGrowthPct: z.number().optional(),
  cashValue: z.number().optional(),
  expectedAnnualReturnPct: z.number().optional(),
  policyId: z.string().optional(),
  policyAssetId: z.string().optional(),
});

const InsuranceEventSchemaBase = BaseEventSchema.extend({
  type: z.literal("insurance"),
  mode: z.enum(["quick", "detailed"]),
  startMonth: MonthKeySchema.optional(),
  endMonth: MonthKeySchema.optional(),
  premiumMonthly: z.number().optional(),
  premiumAnnualGrowthPct: z.number().optional(),
  policies: z.array(InsurancePolicySchema).optional(),
});

const validateInsuranceEvent = (
  event: z.infer<typeof InsuranceEventSchemaBase>,
  ctx: z.RefinementCtx
) => {
  if (event.mode === "quick") {
    if (!event.startMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.startMonthRequired",
        path: ["startMonth"],
      });
    }
    if (typeof event.premiumMonthly !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.premiumMonthlyRequired",
        path: ["premiumMonthly"],
      });
    }
    return;
  }

  if (!event.policies || event.policies.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validation.policiesRequired",
      path: ["policies"],
    });
    return;
  }

  event.policies.forEach((policy, index) => {
    if (policy.kind === "savings") {
      if (!policy.policyId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validation.policyIdRequired",
          path: ["policies", index, "policyId"],
        });
      }
      if (!policy.policyAssetId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validation.policyAssetIdRequired",
          path: ["policies", index, "policyAssetId"],
        });
      }
    }
  });
};

export const InsuranceEventSchema = InsuranceEventSchemaBase.superRefine(
  validateInsuranceEvent
);

export const AdjustmentEventSchema = BaseEventSchema.extend({
  type: z.literal("adjustment"),
  kind: z.enum(["asset", "liability", "cash"]),
  month: MonthKeySchema,
  amount: z.number(),
});

export const ScenarioEventSchema = z
  .discriminatedUnion("type", [
    CashflowEventSchemaBase,
    HousingEventSchemaBase,
    LoanEventSchemaBase,
    InsuranceEventSchemaBase,
    AdjustmentEventSchema,
  ])
  .superRefine((event, ctx) => {
    if (event.type === "cashflow") {
      validateCashflowFields(event, ctx);
      return;
    }
    if (event.type === "housing") {
      validateHousingEvent(event, ctx);
      return;
    }
    if (event.type === "loan") {
      validateLoanEvent(event, ctx);
      return;
    }
    if (event.type === "insurance") {
      validateInsuranceEvent(event, ctx);
    }
  });

export type EventSource = z.infer<typeof EventSourceSchema>;
export type CashflowEvent = z.infer<typeof CashflowEventSchemaBase>;
export type IncomeGrowthMode = NonNullable<CashflowEvent["growthMode"]>;
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
