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

export type PlanLabBaselineEdit = {
  id: string;
  refType: "event" | "position";
  refId: string;
  kind: "rent" | "car_running";
  action: "keep" | "end" | "replace";
  endMonth?: string;
  isEnabled?: boolean;
};

export type PlanLabExperimentType =
  | "oneOffExpense"
  | "rangeExpense"
  | "homeBuy"
  | "carPlan"
  | "incomeAdjust"
  | "travelAnnual";

export type PlanLabExperimentBase = {
  id: string;
  type: PlanLabExperimentType;
  isEnabled?: boolean;
};

export type PlanLabOneOffExpenseExperiment = PlanLabExperimentBase & {
  type: "oneOffExpense";
  month?: string;
  amount?: number;
  note?: string;
};

export type PlanLabRangeExpenseExperiment = PlanLabExperimentBase & {
  type: "rangeExpense";
  startMonth?: string;
  endMonth?: string;
  monthlyAmount?: number;
};

export type PlanLabHomeBuyExperiment = PlanLabExperimentBase & {
  type: "homeBuy";
  purchaseMonth?: string;
  purchasePrice?: number;
  downPaymentAmount?: number;
  downPaymentPct?: number;
  mortgageRatePct?: number;
  termYears?: number;
  oneTimeFees?: number;
  holdingCostMonthly?: number;
  annualAppreciationPct?: number;
};

export type PlanLabCarPlanExperiment = PlanLabExperimentBase & {
  type: "carPlan";
  purchaseMonth?: string;
  purchasePrice?: number;
  downPayment?: number;
  annualDepreciationRatePct?: number;
  holdingCostMonthly?: number;
  holdingCostAnnualGrowthPct?: number;
  loanPrincipal?: number;
  loanInterestRatePct?: number;
  loanTermYears?: number;
  loanMonthlyPayment?: number;
};

export type PlanLabIncomeAdjustExperiment = PlanLabExperimentBase & {
  type: "incomeAdjust";
  startMonth?: string;
  monthlyAmount?: number;
};

export type PlanLabTravelAnnualExperiment = PlanLabExperimentBase & {
  type: "travelAnnual";
  startMonth?: string;
  annualAmount?: number;
};

export type PlanLabExperiment =
  | PlanLabOneOffExpenseExperiment
  | PlanLabRangeExpenseExperiment
  | PlanLabHomeBuyExperiment
  | PlanLabCarPlanExperiment
  | PlanLabIncomeAdjustExperiment
  | PlanLabTravelAnnualExperiment;

export type PlanLabScorecardSettings = {
  firstBucketTargetAmount?: number;
};

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
  baselineEdits?: PlanLabBaselineEdit[];
  experiments?: PlanLabExperiment[];
  scorecardSettings?: PlanLabScorecardSettings;
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
