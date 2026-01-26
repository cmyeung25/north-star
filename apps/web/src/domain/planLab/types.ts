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
  oneOffBabyCost?: number;
  durationMonths?: number;
};

export type PlanLabGoalType = "classic" | "family-launch";

export type FamilyLaunchWeddingDraft = {
  weddingMonth?: string;
  weddingBudget?: number;
  honeymoonBudget?: number;
};

export type FamilyLaunchBabyDraft = {
  dueMonth?: string;
  babyMonthlyBudget?: number;
  babyOneOffBudget?: number;
  babyDurationMonths?: number;
};

export type FamilyLaunchHousingDraft = {
  housingMode?: "keep-rent" | "rent-upgrade" | "buy-home";
  currentRent?: number;
  upgradedRent?: number;
  rentStartMonth?: string;
  purchaseMonth?: string;
  homePrice?: number;
  downPaymentAmount?: number;
  downPaymentPct?: number;
  mortgageRatePct?: number;
  mortgageTermYears?: number;
  oneOffFees?: number;
  monthlyHoldingCost?: number;
  annualAppreciationPct?: number;
};

export type FamilyLaunchDraft = {
  wedding?: FamilyLaunchWeddingDraft;
  baby?: FamilyLaunchBabyDraft;
  housing?: FamilyLaunchHousingDraft;
};

export type PlanLabDraft = {
  goalType?: PlanLabGoalType;
  baseMonth?: string;
  targetMonth?: string;
  initialCash?: number;
  housing?: PlanLabHousingDraft;
  babyPlan?: PlanLabBabyPlanDraft;
  familyLaunch?: FamilyLaunchDraft;
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
