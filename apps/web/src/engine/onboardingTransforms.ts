import { nanoid } from "nanoid";
import { defaultCurrency } from "../../lib/i18n";
import type { OnboardingDraft } from "../onboarding/types";
import type { EventDefinition, ScenarioEventRef } from "../domain/events/types";
import { buildDefinitionFromTimelineEvent } from "../domain/events/utils";
import {
  createHomePositionId,
  createMemberId,
  type HomePositionDraft,
  type Scenario,
  type ScenarioMember,
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

const clampPct = (value: number, min = -100, max = 100) =>
  Math.min(Math.max(value, min), max);

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
};

const buildEventDefinition = (
  partial: Omit<
    Parameters<typeof buildDefinitionFromTimelineEvent>[0],
    "id" | "enabled" | "oneTimeAmount"
  > & {
    currency?: string;
  }
): EventDefinition =>
  buildDefinitionFromTimelineEvent({
    id: `event-${nanoid(8)}`,
    enabled: true,
    oneTimeAmount: 0,
    ...partial,
    currency: partial.currency ?? defaultCurrency,
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
      ? clampPct(draft.existingHome.appreciationPct)
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
  draft: OnboardingDraft,
  eventLibrary: EventDefinition[]
): { scenario: Scenario; eventLibrary: EventDefinition[] } => {
  const baseMonth = getCurrentMonth();
  const currency = baseScenario.baseCurrency ?? defaultCurrency;
  const members: ScenarioMember[] =
    draft.members.map((member) => ({
      id: member.id,
      name: member.name.trim() || "本人",
      kind: member.kind as ScenarioMember["kind"],
    })) ?? [];
  const normalizedMembers: ScenarioMember[] =
    members.length > 0
      ? members
      : [
          {
            id: createMemberId(),
            name: "本人",
            kind: "person",
          },
        ];
  const defaultMemberId = normalizedMembers[0]?.id;
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

  const eventDefinitions: EventDefinition[] = [
    buildEventDefinition({
      type: "salary",
      name: "Salary",
      startMonth: baseMonth,
      endMonth: null,
      monthlyAmount: salaryMonthly,
      annualGrowthPct: DEFAULT_SALARY_GROWTH_RATE,
      currency,
      memberId: defaultMemberId,
    }),
  ];

  recurringExpenses.forEach((expense) => {
    eventDefinitions.push(
      buildEventDefinition({
        type: "custom",
        name: expense.label,
        startMonth: baseMonth,
        endMonth: null,
        monthlyAmount: expense.monthlyAmount,
        annualGrowthPct: DEFAULT_INFLATION_RATE,
        currency,
        memberId: defaultMemberId,
      })
    );
  });

  annualBudgetItems.forEach((item) => {
    eventDefinitions.push(
      buildEventDefinition({
        type: "custom",
        name: item.label,
        startMonth: baseMonth,
        endMonth: null,
        monthlyAmount: item.annualAmount / 12,
        annualGrowthPct: DEFAULT_INFLATION_RATE,
        currency,
        memberId: defaultMemberId,
      })
    );
  });

  if (draft.housingStatus === "rent") {
    eventDefinitions.push(
      buildEventDefinition({
        type: "rent",
        name: "Rent",
        startMonth: baseMonth,
        endMonth: null,
        monthlyAmount: rentMonthly,
        annualGrowthPct: DEFAULT_RENT_GROWTH_RATE,
        currency,
        memberId: defaultMemberId,
      })
    );
  }

  const positions =
    draft.housingStatus === "own_existing"
      ? {
          homes: [buildExistingHomePosition(draft, baseMonth)],
          investments: draft.investments.map((investment) => ({
            assetClass: investment.assetClass,
            startMonth: baseMonth,
            initialValue: Math.max(0, investment.marketValue),
            expectedAnnualReturnPct:
              typeof investment.expectedAnnualReturnPct === "number"
                ? Math.max(0, investment.expectedAnnualReturnPct)
                : undefined,
            monthlyContribution:
              typeof investment.monthlyContribution === "number"
                ? investment.monthlyContribution
                : undefined,
            monthlyWithdrawal:
              typeof investment.monthlyWithdrawal === "number"
                ? investment.monthlyWithdrawal
                : undefined,
            feeAnnualRatePct:
              typeof investment.feeAnnualRatePct === "number"
                ? Math.max(0, investment.feeAnnualRatePct)
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
            startMonth: baseMonth,
            initialValue: Math.max(0, investment.marketValue),
            expectedAnnualReturnPct:
              typeof investment.expectedAnnualReturnPct === "number"
                ? Math.max(0, investment.expectedAnnualReturnPct)
                : undefined,
            monthlyContribution:
              typeof investment.monthlyContribution === "number"
                ? investment.monthlyContribution
                : undefined,
            monthlyWithdrawal:
              typeof investment.monthlyWithdrawal === "number"
                ? investment.monthlyWithdrawal
                : undefined,
            feeAnnualRatePct:
              typeof investment.feeAnnualRatePct === "number"
                ? Math.max(0, investment.feeAnnualRatePct)
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

  const scenario: Scenario = {
    ...baseScenario,
    updatedAt: Date.now(),
    members: normalizedMembers,
    eventRefs: eventDefinitions.map<ScenarioEventRef>((definition) => ({
      refId: definition.id,
      enabled: true,
    })),
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
    positions,
    meta: {
      ...baseScenario.meta,
      onboardingVersion: ONBOARDING_VERSION,
    },
  };

  return {
    scenario,
    eventLibrary: [...eventLibrary, ...eventDefinitions],
  };
};
