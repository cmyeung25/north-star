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
const DEFAULT_HOME_PRICE = 450000;
const DEFAULT_HOME_APPRECIATION = 3;
const DEFAULT_MORTGAGE_RATE = 6.5;
const DEFAULT_MORTGAGE_TERM_YEARS = 30;

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

const buildHomePosition = (draft: OnboardingDraft, baseMonth: string): HomePositionDraft => {
  const downPayment = Math.min(draft.initialCash, DEFAULT_HOME_PRICE * 0.2);

  return {
    id: createHomePositionId(),
    usage: "primary",
    mode: "new_purchase",
    purchasePrice: DEFAULT_HOME_PRICE,
    downPayment,
    purchaseMonth: baseMonth,
    annualAppreciationPct: DEFAULT_HOME_APPRECIATION,
    mortgageRatePct: DEFAULT_MORTGAGE_RATE,
    mortgageTermYears: DEFAULT_MORTGAGE_TERM_YEARS,
    feesOneTime: 0,
    holdingCostMonthly: 0,
    holdingCostAnnualGrowthPct: 0,
  };
};

export const applyOnboardingToScenario = (
  baseScenario: Scenario,
  draft: OnboardingDraft
): Scenario => {
  const baseMonth = getCurrentMonth();
  const currency = baseScenario.baseCurrency ?? defaultCurrency;
  const salaryMonthly = Math.max(0, draft.salaryMonthly);
  const travelMonthly = Math.max(0, draft.travelAnnual / 12);
  const rentMonthly = Math.max(0, draft.rentMonthly);
  const recurringExpenses = (draft.expenseItems ?? [])
    .map((item, index) => ({
      label: item.label.trim() || `Expense ${index + 1}`,
      monthlyAmount: Math.max(0, item.monthlyAmount),
    }))
    .filter((item) => item.monthlyAmount > 0);

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
    buildEvent({
      type: "travel",
      name: "Travel",
      startMonth: baseMonth,
      endMonth: null,
      monthlyAmount: travelMonthly,
      annualGrowthPct: DEFAULT_INFLATION_RATE,
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
    draft.housingStatus === "own"
      ? { homes: [buildHomePosition(draft, baseMonth)] }
      : { homes: [] };

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
    },
    events,
    positions,
    meta: {
      ...baseScenario.meta,
      onboardingVersion: ONBOARDING_VERSION,
    },
  };
};
