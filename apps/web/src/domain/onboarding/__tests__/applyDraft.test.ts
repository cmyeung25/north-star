import { beforeEach, describe, expect, it } from "vitest";
import {
  applyOnboardingDraftToScenario,
  type OnboardingDraft,
} from "../applyDraft";
import type { Scenario } from "../../../store/scenarioStore";
import { useScenarioStore } from "../../../store/scenarioStore";
import { buildOnboardingEventId } from "../../../features/onboarding/utils";

const buildScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "scenario-test",
  name: "Test Plan",
  baseCurrency: "USD",
  updatedAt: Date.now(),
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Medium",
  },
  assumptions: {
    horizonMonths: 240,
    initialCash: 0,
    baseMonth: "2024-01",
    includeBudgetRulesInProjection: true,
  },
  members: [],
  budgetRules: [],
  eventRefs: [],
  positions: {},
  ...overrides,
});

const buildDraft = (overrides: Partial<OnboardingDraft> = {}): OnboardingDraft => ({
  persona: "C",
  basics: {
    baseMonth: "2024-01",
    initialCash: 0,
    horizonMonths: 240,
  },
  income: {
    monthlyAmount: 50000,
    annualGrowthPct: 0,
    retirementMonth: null,
  },
  lifestyle: {
    rentEnabled: false,
    rentMonthly: 0,
    rentStartMonth: "2024-01",
    rentDurationYears: undefined,
    carEnabled: false,
    car: {
      purchaseMonth: "2024-01",
      purchasePrice: 0,
      downPayment: 0,
      loanTermYears: 5,
      loanRatePct: 4,
      holdingCostMonthly: 0,
      depreciationPct: 12,
    },
    travelEnabled: false,
    travelAnnualBudget: 0,
  },
  family: {
    partnerEnabled: false,
    partnerName: "",
    childEnabled: false,
    childBirthMonth: "",
    childcareStartAge: 0,
    educationStartAge: 6,
    childcareLevel: "mid",
    educationLevel: "mid",
    parentEnabled: false,
    parentMonthlyCost: 0,
    petEnabled: false,
    petMonthlyCost: 0,
  },
  decisions: {
    homeEnabled: false,
    home: {
      purchaseMonth: "2024-01",
      purchasePrice: 0,
      downPaymentPct: 0,
      mortgageTermYears: 30,
      mortgageRatePct: 4,
      feesOneTime: 0,
      holdingCostMonthly: 0,
      appreciationPct: 3,
    },
    investmentEnabled: false,
    investment: {
      monthlyContribution: 0,
      expectedAnnualReturnPct: 5,
      feeAnnualRatePct: undefined,
      startMonth: "2024-01",
    },
    loanEnabled: false,
    loan: {
      startMonth: "2024-01",
      principal: 0,
      annualInterestRatePct: 4,
      termYears: 5,
      monthlyPayment: undefined,
    },
  },
  ...overrides,
});

beforeEach(() => {
  const scenario = buildScenario();
  useScenarioStore.setState({
    scenarios: [scenario],
    eventLibrary: [],
    activeScenarioId: scenario.id,
  });
});

describe("applyOnboardingDraftToScenario", () => {
  it("does not create rent events when rent is disabled", () => {
    const scenario = useScenarioStore.getState().scenarios[0];
    const draft = buildDraft({
      lifestyle: {
        ...buildDraft().lifestyle,
        rentEnabled: false,
      },
    });

    applyOnboardingDraftToScenario(scenario, draft, useScenarioStore.getState());

    const state = useScenarioStore.getState();
    const rentEventId = buildOnboardingEventId(scenario.id, "rent");
    expect(state.eventLibrary.some((event) => event.id === rentEventId)).toBe(false);
    expect(state.scenarios[0]?.eventRefs?.some((ref) => ref.refId === rentEventId)).toBe(
      false
    );
  });

  it("does not create child budget rules when child is disabled", () => {
    const scenario = useScenarioStore.getState().scenarios[0];
    const draft = buildDraft({
      family: {
        ...buildDraft().family,
        childEnabled: false,
      },
    });

    applyOnboardingDraftToScenario(scenario, draft, useScenarioStore.getState());

    const updated = useScenarioStore.getState().scenarios[0];
    expect(updated?.budgetRules?.length ?? 0).toBe(0);
  });

  it("removes rent events when rent is toggled off", () => {
    const scenario = useScenarioStore.getState().scenarios[0];
    const rentEventId = buildOnboardingEventId(scenario.id, "rent");

    const enabledDraft = buildDraft({
      lifestyle: {
        ...buildDraft().lifestyle,
        rentEnabled: true,
        rentMonthly: 18000,
        rentStartMonth: "2024-02",
      },
    });

    applyOnboardingDraftToScenario(scenario, enabledDraft, useScenarioStore.getState());

    let state = useScenarioStore.getState();
    expect(state.eventLibrary.some((event) => event.id === rentEventId)).toBe(true);

    const disabledDraft = buildDraft({
      lifestyle: {
        ...enabledDraft.lifestyle,
        rentEnabled: false,
      },
    });

    applyOnboardingDraftToScenario(scenario, disabledDraft, useScenarioStore.getState());

    state = useScenarioStore.getState();
    expect(state.eventLibrary.some((event) => event.id === rentEventId)).toBe(false);
    expect(state.scenarios[0]?.eventRefs?.some((ref) => ref.refId === rentEventId)).toBe(
      false
    );
  });
});
