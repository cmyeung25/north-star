import { nanoid } from "nanoid";
import { defaultCurrency } from "../../lib/i18n";
import type { OnboardingDraft } from "../onboarding/types";
import {
  createHomePositionId,
  type HomePositionDraft,
  type Scenario,
  type TimelineEvent,
} from "../store/scenarioStore";

const ONBOARDING_VERSION = 1;
const DEFAULT_HORIZON_MONTHS = 240;
const DEFAULT_INFLATION_RATE = 2;
const DEFAULT_SALARY_GROWTH_RATE = 3;
const DEFAULT_RENT_GROWTH_RATE = 3;
const DEFAULT_HOME_APPRECIATION = 3;
const DEFAULT_INVESTMENT_RETURN_PCTS = {
  equity: 7,
  bond: 3,
  fund: 5,
  crypto: 8,
} as const;

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const buildEvent = (
  partial: Omit<TimelineEvent, "id" | "currency" | "enabled" | "oneTimeAmount"> & {
    currency?: string;
  }
): TimelineEvent => ({
  id: `event-${nanoid(8)}`,
  enabled: true,
  oneTimeAmount: 0,
  currency: partial.currency ?? defaultCurrency,
  ...partial,
});

const buildExistingHomePosition = (
  draft: OnboardingDraft,
  baseMonth: string
): HomePositionDraft => ({
  id: createHomePositionId(),
  usage: "primary",
  mode: "existing",
  annualAppreciationPct:
    typeof draft.existingHome.appreciationPct === "number"
      ? Math.max(0, draft.existingHome.appreciationPct)
      : DEFAULT_HOME_APPRECIATION,
  holdingCostMonthly: Math.max(0, draft.existingHome.holdingCostMonthly ?? 0),
  holdingCostAnnualGrowthPct: 0,
  existing: {
    asOfMonth: baseMonth,
    marketValue: Math.max(0, draft.existingHome.marketValue),
    mortgageBalance: Math.max(0, draft.existingHome.mortgageBalance),
    remainingTermMonths: Math.max(1, draft.existingHome.remainingTermMonths),
    annualRatePct: Math.max(0, draft.existingHome.annualRatePct),
  },
});

export const applyOnboardingToScenario = (
  baseScenario: Scenario,
  draft: OnboardingDraft
): Scenario => {
  const baseMonth = getCurrentMonth();
  const currency = baseScenario.baseCurrency ?? defaultCurrency;
  const salaryMonthly = Math.max(0, draft.salaryMonthly);
  const rentMonthly = Math.max(0, draft.rentMonthly);
  const recurringExpenses = (draft.expenseItems ?? [])
    .map((item, index) => ({
      label: item.label.trim() || `Expense ${index + 1}`,
      monthlyAmount: Math.max(0, item.monthlyAmount),
    }))
    .filter((item) => item.monthlyAmount > 0);
  const annualBudgetItems = (draft.annualBudgetItems ?? [])
    .map((item, index) => ({
      label: item.label.trim() || `Annual budget ${index + 1}`,
      annualAmount: Math.max(0, item.annualAmount),
    }))
    .filter((item) => item.annualAmount > 0);

  const events: TimelineEvent[] = [
    buildEvent({
      type: "salary",
      name: "Salary",
      startMonth: baseMonth,
      endMonth: null,
      monthlyAmount: salaryMonthly,
      annualGrowthPct: DEFAULT_SALARY_GROWTH_RATE,
      currency,
    }),
  ];

  recurringExpenses.forEach((expense) => {
    events.push(
      buildEvent({
        type: "custom",
        name: expense.label,
        startMonth: baseMonth,
        endMonth: null,
        monthlyAmount: expense.monthlyAmount,
        annualGrowthPct: DEFAULT_INFLATION_RATE,
        currency,
      })
    );
  });

  annualBudgetItems.forEach((item) => {
    events.push(
      buildEvent({
        type: "custom",
        name: item.label,
        startMonth: baseMonth,
        endMonth: null,
        monthlyAmount: item.annualAmount / 12,
        annualGrowthPct: DEFAULT_INFLATION_RATE,
        currency,
      })
    );
  });

  if (draft.housingStatus === "rent") {
    events.push(
      buildEvent({
        type: "rent",
        name: "Rent",
        startMonth: baseMonth,
        endMonth: null,
        monthlyAmount: rentMonthly,
        annualGrowthPct: DEFAULT_RENT_GROWTH_RATE,
        currency,
      })
    );
  }

  const positions =
    draft.housingStatus === "own_existing"
      ? {
          homes: [buildExistingHomePosition(draft, baseMonth)],
          investments: draft.investments.map((investment) => ({
            assetClass: investment.assetClass,
            marketValue: Math.max(0, investment.marketValue),
            expectedAnnualReturnPct:
              typeof investment.expectedAnnualReturnPct === "number"
                ? Math.max(0, investment.expectedAnnualReturnPct)
                : undefined,
            monthlyContribution:
              typeof investment.monthlyContribution === "number"
                ? investment.monthlyContribution
                : undefined,
          })),
          insurances: draft.insurances.map((insurance) => ({
            insuranceType: insurance.insuranceType,
            premiumMode: insurance.premiumMode,
            premiumAmount: Math.max(0, insurance.premiumAmount),
            hasCashValue: insurance.hasCashValue,
            cashValueAsOf:
              typeof insurance.cashValueAsOf === "number"
                ? Math.max(0, insurance.cashValueAsOf)
                : undefined,
            cashValueAnnualGrowthPct:
              typeof insurance.cashValueAnnualGrowthPct === "number"
                ? Math.max(0, insurance.cashValueAnnualGrowthPct)
                : undefined,
            coverageMeta: insurance.coverageMeta,
          })),
        }
      : {
          homes: [],
          investments: draft.investments.map((investment) => ({
            assetClass: investment.assetClass,
            marketValue: Math.max(0, investment.marketValue),
            expectedAnnualReturnPct:
              typeof investment.expectedAnnualReturnPct === "number"
                ? Math.max(0, investment.expectedAnnualReturnPct)
                : undefined,
            monthlyContribution:
              typeof investment.monthlyContribution === "number"
                ? investment.monthlyContribution
                : undefined,
          })),
          insurances: draft.insurances.map((insurance) => ({
            insuranceType: insurance.insuranceType,
            premiumMode: insurance.premiumMode,
            premiumAmount: Math.max(0, insurance.premiumAmount),
            hasCashValue: insurance.hasCashValue,
            cashValueAsOf:
              typeof insurance.cashValueAsOf === "number"
                ? Math.max(0, insurance.cashValueAsOf)
                : undefined,
            cashValueAnnualGrowthPct:
              typeof insurance.cashValueAnnualGrowthPct === "number"
                ? Math.max(0, insurance.cashValueAnnualGrowthPct)
                : undefined,
            coverageMeta: insurance.coverageMeta,
          })),
        };

  return {
    ...baseScenario,
    updatedAt: Date.now(),
    assumptions: {
      ...baseScenario.assumptions,
      baseMonth,
      horizonMonths: DEFAULT_HORIZON_MONTHS,
      initialCash: Math.max(0, draft.initialCash),
      inflationRate: DEFAULT_INFLATION_RATE,
      salaryGrowthRate: DEFAULT_SALARY_GROWTH_RATE,
      rentAnnualGrowthPct: DEFAULT_RENT_GROWTH_RATE,
      rentMonthly: draft.housingStatus === "rent" ? rentMonthly : undefined,
      investmentReturnAssumptions: DEFAULT_INVESTMENT_RETURN_PCTS,
    },
    events,
    positions,
    meta: {
      ...baseScenario.meta,
      onboardingVersion: ONBOARDING_VERSION,
    },
  };
};
