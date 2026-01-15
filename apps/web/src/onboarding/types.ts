export type HousingStatus = "rent" | "own_existing";

export type InvestmentAssetClass = "equity" | "bond" | "fund" | "crypto";

export type InsuranceType = "life" | "savings" | "accident" | "medical";

export type InsurancePremiumMode = "monthly" | "annual";

export type OnboardingDraft = {
  initialCash: number;
  housingStatus: HousingStatus;
  rentMonthly: number;
  existingHome: {
    marketValue: number;
    mortgageBalance: number;
    annualRatePct: number;
    remainingTermMonths: number;
    holdingCostMonthly?: number;
    appreciationPct?: number;
  };
  salaryMonthly: number;
  expenseItems: Array<{
    label: string;
    monthlyAmount: number;
  }>;
  annualBudgetItems: Array<{
    label: string;
    annualAmount: number;
  }>;
  investments: Array<{
    assetClass: InvestmentAssetClass;
    marketValue: number;
    expectedAnnualReturnPct?: number;
    monthlyContribution?: number;
  }>;
  insurances: Array<{
    insuranceType: InsuranceType;
    premiumMode: InsurancePremiumMode;
    premiumAmount: number;
    hasCashValue?: boolean;
    cashValueAsOf?: number;
    cashValueAnnualGrowthPct?: number;
    coverageMeta?: Record<string, unknown>;
  }>;
};
