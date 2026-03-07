import type { OnboardingV2Draft } from "../../../domain/onboarding/v2/draftTypes";

export type ReviewFlagSeverity = "critical" | "warning";

export type ReviewFlagAction =
  | { type: "scenarioList" }
  | {
      type: "step";
      step: "income" | "livingSpend" | "housing" | "assets" | "debts" | "insurance";
    };

export type ReviewFlagDefinition = {
  id: string;
  severity: ReviewFlagSeverity;
  messageKey: string;
  messageValues?: Record<string, string | number>;
  action: ReviewFlagAction;
};

export type OnboardingReviewFlagSummary = {
  incomeTotal: number;
  expenseTotal: number;
  cashNow: number;
};

const toNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export const buildOnboardingReviewFlagDefinitions = ({
  draft,
  scenarioIsV2,
  summary,
}: {
  draft: OnboardingV2Draft;
  scenarioIsV2: boolean;
  summary: OnboardingReviewFlagSummary;
}): ReviewFlagDefinition[] => {
  const flags: ReviewFlagDefinition[] = [];

  if (!scenarioIsV2) {
    return [
      {
        id: "scenario-legacy",
        severity: "critical",
        messageKey: "flagScenarioV2Required",
        action: { type: "scenarioList" },
      },
    ];
  }

  const own = draft.housing.own;
  const propertyMarketValue = toNumber(own.propertyMarketValue);
  const mortgageBaseValue =
    own.mortgageBaseMode === "CUSTOM"
      ? toNumber(own.mortgageBaseValue ?? propertyMarketValue)
      : propertyMarketValue;
  const downPaymentPercent =
    own.downPaymentMode === "percent"
      ? toNumber(own.downPaymentPercent ?? 0)
      : propertyMarketValue > 0
        ? (toNumber(own.downPaymentAmount ?? 0) / propertyMarketValue) * 100
        : 0;
  const downPaymentAmount =
    own.downPaymentMode === "percent"
      ? (propertyMarketValue * downPaymentPercent) / 100
      : toNumber(own.downPaymentAmount ?? 0);
  const loanAmount = Math.max(0, mortgageBaseValue - downPaymentAmount);
  const mortgageRate = toNumber(own.mortgageRatePct ?? 0);
  const mortgageTerm = toNumber(own.mortgageTermYears ?? 0);

  if (summary.incomeTotal <= 0 && summary.expenseTotal > 0) {
    flags.push({
      id: "income-zero",
      severity: "critical",
      messageKey: "flagIncomeZero",
      action: { type: "step", step: "income" },
    });
  }

  if (summary.expenseTotal <= 0 && summary.incomeTotal > 0) {
    flags.push({
      id: "expense-zero",
      severity: "critical",
      messageKey: "flagExpenseZero",
      action: { type: "step", step: "livingSpend" },
    });
  }

  if (summary.cashNow <= 0 && summary.expenseTotal > 0) {
    flags.push({
      id: "cash-zero",
      severity: "critical",
      messageKey: "flagCashZero",
      action: { type: "step", step: "assets" },
    });
  }

  if (
    draft.housing.mode === "rent" &&
    (propertyMarketValue > 0 || own.rental.enabled || own.mortgageEnabled)
  ) {
    flags.push({
      id: "housing-mode-conflict",
      severity: "warning",
      messageKey: "flagHousingModeConflict",
      action: { type: "step", step: "housing" },
    });
  }

  if (draft.housing.mode === "own" && propertyMarketValue <= 0) {
    flags.push({
      id: "property-value-missing",
      severity: "critical",
      messageKey: "flagPropertyValueMissing",
      action: { type: "step", step: "housing" },
    });
  }

  if (
    draft.housing.mode === "own" &&
    own.mortgageEnabled &&
    own.mortgageBaseMode === "CUSTOM" &&
    mortgageBaseValue <= 0
  ) {
    flags.push({
      id: "mortgage-base-missing",
      severity: "warning",
      messageKey: "flagMortgageBaseMissing",
      action: { type: "step", step: "housing" },
    });
  }

  if (
    draft.housing.mode === "own" &&
    own.mortgageEnabled &&
    propertyMarketValue > 0 &&
    mortgageBaseValue > propertyMarketValue
  ) {
    flags.push({
      id: "mortgage-base-exceeds-property",
      severity: "warning",
      messageKey: "flagMortgageBaseExceedsProperty",
      action: { type: "step", step: "housing" },
    });
  }

  if (
    draft.housing.mode === "own" &&
    own.mortgageEnabled &&
    mortgageBaseValue > 0 &&
    downPaymentAmount > mortgageBaseValue
  ) {
    flags.push({
      id: "down-payment-exceeds-base",
      severity: "warning",
      messageKey: "flagDownPaymentExceedsMortgageBase",
      action: { type: "step", step: "housing" },
    });
  }

  if (
    draft.housing.mode === "own" &&
    own.mortgageEnabled &&
    (loanAmount <= 0 || mortgageRate <= 0 || mortgageTerm <= 0)
  ) {
    flags.push({
      id: "mortgage-missing-details",
      severity: "warning",
      messageKey: "flagMortgageMissingDetails",
      action: { type: "step", step: "housing" },
    });
  }

  draft.debts.forEach((debt) => {
    const principal = toNumber(debt.principalOutstanding ?? 0);
    const interestRate = debt.interestRatePct;
    const termYears = debt.termYears;
    if (principal <= 0 || interestRate === null || termYears === null) {
      flags.push({
        id: `loan-missing-${debt.id}`,
        severity: "warning",
        messageKey: "flagLoanMissingDetails",
        messageValues: {
          label: debt.label || "Loan",
        },
        action: { type: "step", step: "debts" },
      });
    }
  });

  const savingsPoliciesMissingValue = draft.insurance.policies.filter(
    (policy) =>
      policy.type === "savings" &&
      policy.cashValueKnown &&
      (!policy.cashValue || policy.cashValue <= 0)
  );
  if (savingsPoliciesMissingValue.length > 0) {
    flags.push({
      id: "savings-missing-cash-value",
      severity: "warning",
      messageKey: "flagSavingsMissingCashValue",
      messageValues: {
        count: savingsPoliciesMissingValue.length,
      },
      action: { type: "step", step: "insurance" },
    });
  }

  return flags;
};