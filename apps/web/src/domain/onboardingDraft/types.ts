export type OnboardingDraftMember = {
  id: string;
  name?: string;
  ageAtBaseMonth?: number | null;
};

export type OnboardingDraftBaselineTotals = {
  monthlyIncomeTotal: number;
  monthlyExpenseTotal: number;
  initialCash?: number | null;
};

export type OnboardingDraftHousingDraft =
  | {
      kind: "rent";
      startMonth?: string;
      monthlyRent?: number;
    }
  | {
      kind: "buy";
      purchaseMonth?: string;
      purchasePrice?: number;
      downPaymentAmount?: number;
      downPaymentPct?: number;
      mortgageRatePct?: number;
      termYears?: number;
    };

export type OnboardingDraftBabyDraft = {
  dueMonth?: string;
  monthlyBudget?: number;
  oneOffCost?: number;
};

export type OnboardingDraftMicroPlan =
  | {
      kind: "housing";
      housing: OnboardingDraftHousingDraft;
    }
  | {
      kind: "baby";
      baby: OnboardingDraftBabyDraft;
    };

export type OnboardingDraft = {
  members: OnboardingDraftMember[];
  baseline: OnboardingDraftBaselineTotals;
  microPlan: OnboardingDraftMicroPlan;
};

export type OnboardingDraftProjectionSettings = {
  baseMonth: string;
  horizonMonths: number;
};

export type OnboardingDraftValidationError = {
  field: string;
  reason: "invalid-month";
};
