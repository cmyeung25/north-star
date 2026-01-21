import type { OnboardingIncomeDraft } from "./applyDraft";

export const hasIncomeAttribution = (income: OnboardingIncomeDraft): boolean => {
  return Boolean(income.memberId && income.memberId.trim().length > 0);
};
