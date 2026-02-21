import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../store/scenarioStore";
import { submitScenarioDraft } from "../submitScenarioDraft";
import type { OnboardingV2Draft } from "../../onboarding/v2/draftTypes";
import { applyOnboardingV2DraftToScenarioV2 } from "../../onboarding/v2/applyOnboardingV2DraftToScenarioV2";
import { materializePlanLabDraft } from "../../planLab/materializePlanLabDraft";

const buildBaseScenario = (): Scenario => ({
  id: "scenario-1",
  name: "Scenario",
  baseCurrency: "HKD",
  updatedAt: 0,
  kpis: { lowestMonthlyBalance: 0, runwayMonths: 0, netWorthYear5: 0, riskLevel: "Low" },
  assumptions: { horizonMonths: 120, initialCash: 0, baseMonth: "2025-01", inflationRate: 2, salaryGrowthRate: 3, emergencyFundMonths: 6 },
  members: [],
  assets: [],
  liabilities: [],
  events: [],
  eventRefs: [],
  meta: { schemaVersion: 2 },
  clientComputed: {},
});

const buildOnboardingDraft = (): OnboardingV2Draft => ({
  profile: { baseCurrency: "HKD", startMonth: "2025-01", horizonYears: 10 },
  household: { members: [{ id: "self", role: "self", name: "Alex", birthMonth: "1990-01" }] },
  assumptions: {
    inflationPct: 2,
    incomeGrowthPct: 3,
    investmentReturnPct: 5,
    rentGrowthPct: 2,
    propertyAppreciationPct: 2,
    carDepreciationPct: 12,
    cashYieldPct: 2,
    taxInputMode: "gross",
  },
  incomes: [],
  livingSpend: {
    fixed: { amount: 0, startMonth: "2025-01" },
    variable: { amount: 0 },
    categoryBreakdown: {
      enabled: false,
      categories: { food: 0, transport: 0, entertainment: 0, medical: 0, education: 0, misc: 0 },
    },
    travel: { mode: "monthly", monthlyAmount: 0, annualAmount: 0, months: [], growthMode: "none", growthRate: null },
    tax: { mode: "monthly", monthlyAmount: 0, annualAmount: 0, months: [], growthMode: "none", growthRate: null },
    otherFixed: [],
  },
  housing: {
    mode: "rent",
    rent: { amount: 0, startMonth: "2025-01" },
    own: {
      propertyMarketValue: 0,
      startMonth: "2025-01",
      downPaymentMode: "amount",
      downPaymentAmount: 0,
      mortgageEnabled: false,
      fees: [],
      ongoingCosts: [],
      rental: { enabled: false, amount: 0 },
    },
  },
  assets: {
    cash: { amount: 100000, startMonth: "2025-01" },
    investment: { totalAmount: 0, startMonth: "2025-01", breakdownEnabled: false, breakdown: [] },
    contributions: [],
    car: { enabled: false, value: 0 },
    insurances: [],
  },
  debts: [],
  insurance: { mode: "quick", quick: { amount: 0, startMonth: "2025-01" }, policies: [] },
});

describe("scenario create payload integration parity", () => {
  it("keeps assumptions/events/meta/clientComputed consistent across onboarding, seed, and plan-lab", () => {
    const base = buildBaseScenario();
    const onboardingScenario = applyOnboardingV2DraftToScenarioV2(buildOnboardingDraft(), base);
    const onboardingPayload = submitScenarioDraft({
      source: "onboarding",
      target: { scenarioId: base.id },
      draft: {
        assumptions: onboardingScenario.assumptions,
        events: onboardingScenario.events,
        meta: { schemaVersion: 2, onboardingVersion: 2, onboarded: true },
        clientComputed: { onboardingCompleted: true },
        baseCurrency: onboardingScenario.baseCurrency,
      },
      context: { assumptionsBase: base.assumptions },
    }).payload;

    const seedPayload = submitScenarioDraft({
      source: "seed",
      target: { scenarioId: base.id },
      draft: {
        assumptions: { ...onboardingScenario.assumptions },
        events: [...(onboardingScenario.events ?? [])],
        meta: { schemaVersion: 2, onboardingVersion: 2, isSeeded: true, skipOnboarding: true },
        clientComputed: { onboardingCompleted: true },
        baseCurrency: onboardingScenario.baseCurrency,
      },
      context: { assumptionsBase: base.assumptions, metaBase: base.meta, clientComputedBase: base.clientComputed },
    }).payload;

    const planLabScenario = materializePlanLabDraft(
      { ...onboardingScenario, meta: { schemaVersion: 2, onboardingVersion: 2, onboarded: true }, clientComputed: { onboardingCompleted: true } },
      {},
      { scenarioId: "scenario-1", budgetRules: [] }
    ).scenario;

    expect(seedPayload.assumptions).toEqual(onboardingPayload.assumptions);
    expect(planLabScenario.assumptions).toEqual(onboardingPayload.assumptions);

    expect(seedPayload.events).toEqual(onboardingPayload.events);
    expect(planLabScenario.events).toEqual(onboardingPayload.events);

    expect(onboardingPayload.meta.schemaVersion).toBe(2);
    expect(seedPayload.meta.schemaVersion).toBe(2);
    expect(planLabScenario.meta?.schemaVersion).toBe(2);

    expect(onboardingPayload.clientComputed.onboardingCompleted).toBe(true);
    expect(seedPayload.clientComputed.onboardingCompleted).toBe(true);
    expect(planLabScenario.clientComputed?.onboardingCompleted).toBe(true);
  });
});
