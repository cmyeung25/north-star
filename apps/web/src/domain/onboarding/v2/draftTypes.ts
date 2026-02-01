import type { OnboardingV2DraftAssumptions } from "./assumptions";

export type OnboardingV2MemberRole = "self" | "partner" | "child" | "pet";

export type OnboardingV2DraftMember = {
  id: string;
  role: OnboardingV2MemberRole;
  name?: string;
  birthMonth?: string;
};

export type OnboardingV2DraftProfile = {
  baseCurrency?: string;
  horizonYears?: number;
  startMonth?: string;
};

export type OnboardingV2IncomeFrequency = "monthly" | "quarterly" | "yearly" | "oneOff";

export type OnboardingV2DraftIncome = {
  id: string;
  label: string;
  amount: number;
  frequency: OnboardingV2IncomeFrequency;
  startMonth?: string;
  endMonth?: string;
  memberId?: string;
  followIncomeGrowth: boolean;
};

export type OnboardingV2LivingSpendCategoryKey =
  | "food"
  | "transport"
  | "entertainment"
  | "medical"
  | "education"
  | "misc";

export type OnboardingV2DraftAnnualExpense = {
  mode: "monthly" | "annual";
  monthlyAmount: number;
  annualAmount: number;
  months: string[];
};

export type OnboardingV2DraftLivingSpendOtherItem = {
  id: string;
  label: string;
  amount: number;
  startMonth?: string;
  endMonth?: string;
};

export type OnboardingV2DraftHousingRent = {
  amount: number;
  startMonth?: string;
  endMonth?: string;
  rentGrowthPct?: number | null;
};

export type OnboardingV2DraftHousingFee = {
  id: string;
  label: string;
  amount: number;
  month?: string;
};

export type OnboardingV2DraftHousingOngoingCost = {
  id: string;
  label: string;
  amount: number;
  startMonth?: string;
  endMonth?: string;
};

export type OnboardingV2DraftHousingRental = {
  enabled: boolean;
  amount: number;
  startMonth?: string;
  endMonth?: string;
  discountAmount?: number;
};

export type OnboardingV2DraftHousingOwn = {
  propertyValue: number;
  startMonth?: string;
  downPaymentMode: "percent" | "amount";
  downPaymentPercent?: number;
  downPaymentAmount?: number;
  mortgageEnabled: boolean;
  mortgageRatePct?: number;
  mortgageTermMonths?: number;
  mortgagePayment?: number;
  fees: OnboardingV2DraftHousingFee[];
  ongoingCosts: OnboardingV2DraftHousingOngoingCost[];
  rental: OnboardingV2DraftHousingRental;
};

export type OnboardingV2DraftHousing = {
  mode: "rent" | "own";
  rent: OnboardingV2DraftHousingRent;
  own: OnboardingV2DraftHousingOwn;
};

export type OnboardingV2DraftLivingSpend = {
  fixed: {
    amount: number;
    startMonth?: string;
    endMonth?: string;
  };
  variable: {
    amount: number;
  };
  categoryBreakdown: {
    enabled: boolean;
    categories: Record<OnboardingV2LivingSpendCategoryKey, number>;
  };
  travel: OnboardingV2DraftAnnualExpense;
  tax: OnboardingV2DraftAnnualExpense;
  otherFixed: OnboardingV2DraftLivingSpendOtherItem[];
};

export type OnboardingV2DraftInvestmentBreakdownType =
  | "stock"
  | "etf"
  | "fund"
  | "crypto"
  | "other";

export type OnboardingV2DraftInvestmentBreakdown = {
  id: string;
  type: OnboardingV2DraftInvestmentBreakdownType;
  value: number;
  followGlobalReturn: boolean;
  customReturnPct?: number | null;
};

export type OnboardingV2DraftInvestment = {
  totalAmount: number;
  startMonth?: string;
  breakdownEnabled: boolean;
  breakdown: OnboardingV2DraftInvestmentBreakdown[];
};

export type OnboardingV2DraftInvestmentContribution = {
  id: string;
  amount: number;
  startMonth?: string;
  endMonth?: string;
  memberId?: string;
};

export type OnboardingV2DraftCarAsset = {
  enabled: boolean;
  value: number;
  startMonth?: string;
  depreciationPct?: number | null;
};

export type OnboardingV2DraftInsuranceCashValue = {
  id: string;
  cashValue: number;
  startMonth?: string;
  memberId?: string;
  returnPct?: number | null;
};

export type OnboardingV2DraftInsuranceMode = "quick" | "detailed";

export type OnboardingV2DraftInsuranceQuick = {
  amount: number;
  startMonth?: string;
  endMonth?: string;
};

export type OnboardingV2DraftInsurancePolicy = {
  id: string;
  name?: string;
  type: "protection" | "savings";
  premiumPerMonth: number;
  startMonth?: string;
  endMonth?: string;
  memberId?: string;
  cashValue?: number | null;
  cashValueKnown: boolean;
  returnPct?: number | null;
};

export type OnboardingV2DraftInsurance = {
  mode: OnboardingV2DraftInsuranceMode;
  quick: OnboardingV2DraftInsuranceQuick;
  policies: OnboardingV2DraftInsurancePolicy[];
};

export type OnboardingV2DraftAssets = {
  cash: {
    amount: number;
    startMonth?: string;
  };
  investment: OnboardingV2DraftInvestment;
  contributions: OnboardingV2DraftInvestmentContribution[];
  car: OnboardingV2DraftCarAsset;
  insurances: OnboardingV2DraftInsuranceCashValue[];
};

export type OnboardingV2DraftDebtType =
  | "carLoan"
  | "personalLoan"
  | "creditCard"
  | "other";

export type OnboardingV2DraftDebt = {
  id: string;
  type: OnboardingV2DraftDebtType;
  label: string;
  principalOutstanding: number;
  interestRatePct: number | null;
  termYears: number | null;
  maturityMonth?: string;
  startMonth?: string;
  monthlyPayment: number | null;
  monthlyPaymentSource?: "estimated" | "manual";
  purchasePrice?: number;
  downPaymentMode?: "percent" | "amount";
  downPaymentPercent?: number | null;
  downPaymentAmount?: number | null;
};

export type OnboardingV2Draft = {
  profile: OnboardingV2DraftProfile;
  household: {
    members: OnboardingV2DraftMember[];
  };
  assumptions: OnboardingV2DraftAssumptions;
  incomes: OnboardingV2DraftIncome[];
  livingSpend: OnboardingV2DraftLivingSpend;
  housing: OnboardingV2DraftHousing;
  assets: OnboardingV2DraftAssets;
  debts: OnboardingV2DraftDebt[];
  insurance: OnboardingV2DraftInsurance;
};
