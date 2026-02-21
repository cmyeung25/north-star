import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../store/scenarioStore";
import { submitScenarioDraft } from "../submitScenarioDraft";
import type { OnboardingV2Draft } from "../../onboarding/v2/draftTypes";
import { applyOnboardingV2DraftToScenarioV2 } from "../../onboarding/v2/applyOnboardingV2DraftToScenarioV2";
import { buildScenarioDraftFromPlanLab, materializePlanLabDraft } from "../../planLab/materializePlanLabDraft";
import { applyPlanLabScenarioV2Patches, emptyPlanLabScenarioV2Patches } from "../../planLab/scenarioV2Patches";
import { buildScenarioV2FromScenario } from "../../planLab/scenarioV2Bridge";

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



  it("keeps payload structure and generated metadata consistent for onboarding -> plan-lab save-as", () => {
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

    const draftBuild = buildScenarioDraftFromPlanLab(
      {},
      {
        ...onboardingScenario,
        id: "scenario-planlab",
        meta: { schemaVersion: 2, onboardingVersion: 2, onboarded: true },
        clientComputed: { onboardingCompleted: true },
      },
      { budgetRules: [] }
    );

    const savedAsPayload = submitScenarioDraft({
      source: "plan-lab",
      target: { scenarioId: "scenario-planlab-copy" },
      draft: draftBuild.scenarioDraft,
      context: {
        assumptionsBase: onboardingScenario.assumptions,
        metaBase: onboardingScenario.meta,
        clientComputedBase: onboardingScenario.clientComputed,
      },
    }).payload;

    const scenarioV2 = buildScenarioV2FromScenario(onboardingScenario, []);
    const patchedScenarioV2 = applyPlanLabScenarioV2Patches(scenarioV2, {
      ...emptyPlanLabScenarioV2Patches(),
      events: {
        add: [
          {
            id: "evt-plan-lab-housing",
            type: "housing",
            kind: "mortgage",
            label: "Buy home",
            memberId: "self",
            startMonth: "2025-02",
            purchasePrice: 8000000,
            downPaymentMode: "percent",
            downPaymentPercent: 25,
            mortgageRatePct: 3,
            mortgageTermYears: 30,
          },
        ],
        update: {},
        remove: [],
      },
    });

    expect(Object.keys(savedAsPayload).sort()).toEqual(Object.keys(onboardingPayload).sort());
    expect(savedAsPayload.meta.onboarded).toBe(true);
    expect(savedAsPayload.clientComputed.onboardingCompleted).toBe(true);

    const generatedAsset = (patchedScenarioV2.assets ?? []).find((asset) => asset.createdByEventId === "evt-plan-lab-housing");
    const generatedLiability = (patchedScenarioV2.liabilities ?? []).find((liability) => liability.createdByEventId === "evt-plan-lab-housing");

    expect(generatedAsset?.metadata).toEqual({
      source: "plan-lab",
      origin: "evt-plan-lab-housing",
      ruleId: "plan-lab.housing.asset.v1",
    });
    expect(generatedLiability?.metadata).toEqual({
      source: "plan-lab",
      origin: "evt-plan-lab-housing",
      ruleId: "plan-lab.housing.liability.v1",
    });
  });

  it("reports duplicate mortgage/rental warnings as non-blocking during submit", () => {
    const base = buildBaseScenario();
    const result = submitScenarioDraft({
      source: "onboarding",
      target: { scenarioId: base.id },
      draft: {
        assumptions: base.assumptions,
        events: [
          {
            id: "evt-home",
            type: "housing",
            kind: "mortgage",
            startMonth: "2025-01",
            purchasePrice: 120000,
            downPaymentMode: "percent",
            downPaymentPercent: 20,
            mortgageRatePct: 2,
            mortgageTermYears: 30,
            mortgagePayment: 1200,
            propertyAssetId: "asset-home",
            mortgageLiabilityId: "liability-home",
            rental: {
              enabled: true,
              rentMonthly: 700,
              startMonth: "2025-01",
            },
          },
          {
            id: "evt-manual-mortgage",
            type: "cashflow",
            kind: "expense",
            cadence: "monthly",
            amount: 1200,
            startMonth: "2025-01",
            label: "Mortgage expense",
          },
          {
            id: "evt-manual-rent-income",
            type: "cashflow",
            kind: "income",
            cadence: "monthly",
            amount: 700,
            startMonth: "2025-01",
            label: "Rental income",
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    const warningCodes = result.warnings.map((warning) => warning.code);
    expect(warningCodes).toContain("duplicate-mortgage-cashflow");
    expect(warningCodes).toContain("rental-income-duplicated");
  });
});
