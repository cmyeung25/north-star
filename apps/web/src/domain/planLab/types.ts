export type PlanLabHousingBuyDraft = {
  purchaseMonth?: string;
  purchasePrice?: number;
  downPaymentAmount?: number;
  downPaymentPct?: number;
  mortgageRatePct?: number;
  termYears?: number;
  oneTimeFees?: number;
  holdingCostMonthly?: number;
};

export type PlanLabHousingRentDraft = {
  startMonth?: string;
  monthlyRent?: number;
  annualRentGrowthPct?: number;
};

export type PlanLabHousingDraft =
  | ({ kind: "buy" } & PlanLabHousingBuyDraft)
  | ({ kind: "rent" } & PlanLabHousingRentDraft);

export type PlanLabBabyPlanDraft = {
  targetMonth?: string;
  monthlyBabyBudget?: number;
  durationMonths?: number;
};

export type PlanLabDraft = {
  baseMonth?: string;
  targetMonth?: string;
  initialCash?: number;
  housing?: PlanLabHousingDraft;
  babyPlan?: PlanLabBabyPlanDraft;
};

export type OnboardingDraftBaseline = {
  monthlyIncomeTotal: number;
  monthlyExpenseTotal: number;
  initialCash: number;
};

export type OnboardingDraft = {
  baseline: OnboardingDraftBaseline;
  option?: {
    planLabDraft?: PlanLabDraft;
  };
};
