export type HousingStatus = "rent" | "own";

export type OnboardingDraft = {
  initialCash: number;
  housingStatus: HousingStatus;
  rentMonthly: number;
  salaryMonthly: number;
  expenseMonthly: number;
  travelAnnual: number;
};
