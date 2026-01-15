export type HousingStatus = "rent" | "own";

export type OnboardingDraft = {
  initialCash: number;
  housingStatus: HousingStatus;
  rentMonthly: number;
  salaryMonthly: number;
  expenseItems: Array<{
    label: string;
    monthlyAmount: number;
  }>;
  travelAnnual: number;
};
