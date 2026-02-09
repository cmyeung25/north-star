import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../../store/scenarioStore";
import type { HousingEvent, InsuranceEvent, LoanEvent } from "../../../scenarioV2/events";
import type { OnboardingV2Draft } from "../draftTypes";
import { applyOnboardingV2DraftToScenarioV2 } from "../applyOnboardingV2DraftToScenarioV2";

const baseScenario: Scenario = {
  id: "scenario-test",
  name: "Test",
  baseCurrency: "USD",
  updatedAt: 0,
  version: 2,
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Medium",
  },
  assumptions: {
    horizonMonths: 60,
    initialCash: 0,
    baseMonth: "2024-01",
    includeBudgetRulesInProjection: true,
  },
  members: [],
  assets: [],
  liabilities: [],
  events: [],
  meta: { schemaVersion: 2 },
};

const buildDraft = (overrides: Partial<OnboardingV2Draft> = {}): OnboardingV2Draft => ({
  profile: {
    baseCurrency: "USD",
    horizonYears: 5,
    startMonth: "2024-01",
    ...overrides.profile,
  },
  household: {
    members: [{ id: "self", role: "self", name: "Alex" }],
    ...overrides.household,
  },
  assumptions: {
    inflationPct: 2,
    incomeGrowthPct: 3,
    investmentReturnPct: 5,
    rentGrowthPct: null,
    propertyAppreciationPct: null,
    carDepreciationPct: null,
    cashYieldPct: null,
    taxInputMode: null,
    ...overrides.assumptions,
  },
  incomes: overrides.incomes ?? [],
  livingSpend: {
    fixed: { amount: 0, startMonth: "2024-01" },
    variable: { amount: 0 },
    categoryBreakdown: {
      enabled: false,
      categories: {
        food: 0,
        transport: 0,
        entertainment: 0,
        medical: 0,
        education: 0,
        misc: 0,
      },
    },
    travel: { mode: "monthly", monthlyAmount: 0, annualAmount: 0, months: [] },
    tax: { mode: "monthly", monthlyAmount: 0, annualAmount: 0, months: [] },
    otherFixed: [],
    ...overrides.livingSpend,
  },
  housing: {
    mode: "rent",
    rent: { amount: 0 },
    own: {
      propertyMarketValue: 0,
      mortgageBaseValue: 0,
      mortgageBaseMode: "SYNC",
      downPaymentMode: "percent",
      mortgageEnabled: false,
      mortgageRatePct: 0,
      mortgageTermYears: 0,
      mortgagePayment: 0,
      fees: [],
      ongoingCosts: [],
      rental: { enabled: false, amount: 0 },
    },
    ...overrides.housing,
  },
  assets: {
    cash: { amount: 0, startMonth: "2024-01" },
    investment: {
      totalAmount: 0,
      startMonth: "2024-01",
      breakdownEnabled: false,
      breakdown: [],
    },
    contributions: [],
    car: { enabled: false, value: 0 },
    insurances: [],
    ...overrides.assets,
  },
  debts: overrides.debts ?? [],
  insurance: {
    mode: "quick",
    quick: { amount: 0 },
    policies: [],
    ...overrides.insurance,
  },
});

describe("applyOnboardingV2DraftToScenarioV2", () => {
  it("maps income entries to cashflow events", () => {
    const draft = buildDraft({
      incomes: [
        {
          id: "income-1",
          label: "Salary",
          amount: 5000,
          frequency: "monthly",
          startMonth: "2024-01",
          memberId: "self",
          followIncomeGrowth: false,
        },
      ],
    });

    const result = applyOnboardingV2DraftToScenarioV2(draft, baseScenario);
    const incomeEvent = result.events?.find(
      (event) => event.type === "cashflow" && event.id.includes("income-income-1")
    );

    expect(incomeEvent !== undefined).toBe(true);
    expect(incomeEvent).toMatchObject({
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 5000,
      startMonth: "2024-01",
      growthMode: "none",
    });
  });

  it("creates breakdown living spend events without the fixed total", () => {
    const draft = buildDraft({
      livingSpend: {
        fixed: { amount: 2000, startMonth: "2024-01" },
        variable: { amount: 300 },
        categoryBreakdown: {
          enabled: true,
          categories: {
            food: 500,
            transport: 300,
            entertainment: 0,
            medical: 0,
            education: 0,
            misc: 0,
          },
        },
        travel: { mode: "monthly", monthlyAmount: 0, annualAmount: 0, months: [] },
        tax: { mode: "monthly", monthlyAmount: 0, annualAmount: 0, months: [] },
        otherFixed: [],
      },
    });

    const result = applyOnboardingV2DraftToScenarioV2(draft, baseScenario);
    const fixedEvent = result.events?.find((event) =>
      event.id.includes("living-fixed")
    );
    const categoryEvents = result.events?.filter(
      (event) => event.type === "cashflow" && event.id.includes("living-category")
    );

    expect(fixedEvent).toBeUndefined();
    expect((categoryEvents ?? []).length > 0).toBe(true);
  });

  it("creates housing mortgage events with stable asset/liability ids", () => {
    const draft = buildDraft({
      housing: {
        mode: "own",
        rent: { amount: 0 },
        own: {
          propertyMarketValue: 500000,
          mortgageBaseValue: 500000,
          mortgageBaseMode: "SYNC",
          startMonth: "2024-01",
          downPaymentMode: "percent",
          downPaymentPercent: 20,
          mortgageEnabled: true,
          mortgageRatePct: 2.5,
          mortgageTermYears: 30,
          mortgagePayment: 0,
          fees: [],
          ongoingCosts: [],
          rental: { enabled: false, amount: 0 },
        },
      },
    });

    const result = applyOnboardingV2DraftToScenarioV2(draft, baseScenario);
    const housingEvent = result.events?.find(
      (event): event is HousingEvent =>
        event.type === "housing" && event.kind === "mortgage"
    );

    expect(housingEvent?.propertyAssetId).toBe(
      "onboarding-v2-scenario-test-housing-property"
    );
    expect(housingEvent?.mortgageLiabilityId).toBe(
      "onboarding-v2-scenario-test-housing-mortgage"
    );
    expect(result.assets?.some((asset) => asset.id === housingEvent?.propertyAssetId)).toBe(
      true
    );
    expect(
      result.liabilities?.some((liability) => liability.id === housingEvent?.mortgageLiabilityId)
    ).toBe(true);
  });

  it("uses mortgage base value for mortgage liabilities and events", () => {
    const draft = buildDraft({
      housing: {
        mode: "own",
        rent: { amount: 0 },
        own: {
          propertyMarketValue: 1000000,
          mortgageBaseValue: 1200000,
          mortgageBaseMode: "CUSTOM",
          startMonth: "2024-01",
          downPaymentMode: "percent",
          downPaymentPercent: 20,
          mortgageEnabled: true,
          mortgageRatePct: 3,
          mortgageTermYears: 25,
          mortgagePayment: 0,
          fees: [],
          ongoingCosts: [],
          rental: { enabled: false, amount: 0 },
        },
      },
    });

    const result = applyOnboardingV2DraftToScenarioV2(draft, baseScenario);
    const mortgageLiability = result.liabilities?.find(
      (entry) => entry.kind === "mortgage"
    );
    const housingEvent = result.events?.find(
      (event): event is HousingEvent =>
        event.type === "housing" && event.kind === "mortgage"
    );

    expect(mortgageLiability?.principalOutstanding).toBe(1000000);
    expect(housingEvent?.propertyMarketValue).toBe(1000000);
    expect(housingEvent?.mortgageBaseValue).toBe(1200000);
    expect(housingEvent?.mortgageBaseMode).toBe("CUSTOM");
  });

  it("skips mortgage liabilities and events when mortgage is disabled", () => {
    const draft = buildDraft({
      housing: {
        mode: "own",
        rent: { amount: 0 },
        own: {
          propertyMarketValue: 500000,
          mortgageBaseValue: 500000,
          mortgageBaseMode: "SYNC",
          startMonth: "2024-01",
          downPaymentMode: "percent",
          downPaymentPercent: 20,
          mortgageEnabled: false,
          mortgageRatePct: 3,
          mortgageTermYears: 25,
          mortgagePayment: 0,
          fees: [],
          ongoingCosts: [],
          rental: { enabled: false, amount: 0 },
        },
      },
    });

    const result = applyOnboardingV2DraftToScenarioV2(draft, baseScenario);
    const mortgageLiability = result.liabilities?.find(
      (entry) => entry.kind === "mortgage"
    );
    const housingEvent = result.events?.find(
      (event): event is HousingEvent =>
        event.type === "housing" && event.kind === "mortgage"
    );

    expect(mortgageLiability).toBeUndefined();
    expect(housingEvent).toBeUndefined();
    expect(result.assets?.some((asset) => asset.kind === "home")).toBe(true);
  });

  it("skips rent events when rent is marked as no payment", () => {
    const draft = buildDraft({
      housing: {
        mode: "rent",
        rent: { amount: 0, noPayment: true, startMonth: "2024-01" },
        own: {
          propertyMarketValue: 0,
          mortgageBaseValue: 0,
          mortgageBaseMode: "SYNC",
          downPaymentMode: "percent",
          mortgageEnabled: false,
          mortgageRatePct: 0,
          mortgageTermYears: 0,
          mortgagePayment: 0,
          fees: [],
          ongoingCosts: [],
          rental: { enabled: false, amount: 0 },
        },
      },
    });

    const result = applyOnboardingV2DraftToScenarioV2(draft, baseScenario);
    const rentEvent = result.events?.find(
      (event): event is HousingEvent =>
        event.type === "housing" && event.kind === "rent"
    );

    expect(rentEvent).toBeUndefined();
  });

  it("maps debts to loan events with stable liability ids", () => {
    const draft = buildDraft({
      debts: [
        {
          id: "debt-1",
          type: "personalLoan",
          label: "Personal Loan",
          principalOutstanding: 120000,
          interestRatePct: 3.2,
          termYears: 10,
          startMonth: "2024-01",
          monthlyPayment: null,
          monthlyPaymentSource: "estimated",
        },
      ],
    });

    const result = applyOnboardingV2DraftToScenarioV2(draft, baseScenario);
    const loanEvent = result.events?.find(
      (event): event is LoanEvent =>
        event.type === "loan" && event.liabilityId.includes("debt-1")
    );

    expect(loanEvent !== undefined).toBe(true);
    expect(loanEvent?.liabilityId).toBe("onboarding-v2-scenario-test-debts-debt-1");
  });

  it("maps savings policies to insurance events with policy asset ids", () => {
    const draft = buildDraft({
      insurance: {
        mode: "detailed",
        quick: { amount: 0 },
        policies: [
          {
            id: "policy-1",
            name: "Savings Policy",
            type: "savings",
            premiumPerMonth: 200,
            startMonth: "2024-01",
            endMonth: "2025-12",
            memberId: "self",
            cashValue: 15000,
            cashValueKnown: true,
            returnPct: 3,
          },
        ],
      },
    });

    const result = applyOnboardingV2DraftToScenarioV2(draft, baseScenario);
    const insuranceEvent = result.events?.find(
      (event): event is InsuranceEvent => event.type === "insurance"
    );
    const policy =
      insuranceEvent && insuranceEvent.type === "insurance"
        ? insuranceEvent.policies?.[0]
        : undefined;

    expect(policy?.policyAssetId).toBe(
      "onboarding-v2-scenario-test-insurance-policy-asset-policy-1"
    );
    expect(
      result.assets?.some((asset) => asset.id === policy?.policyAssetId)
    ).toBe(true);
  });

  it("updates seeded placeholder primary member instead of creating duplicate", () => {
    const draft = buildDraft({
      household: {
        members: [
          {
            id: "self",
            role: "self",
            name: "Alex",
            birthMonth: "1990-02",
          },
        ],
      },
    });
    const scenarioWithPlaceholder: Scenario = {
      ...baseScenario,
      members: [
        {
          id: "member-placeholder",
          name: "主要成員",
          kind: "person",
          applyScope: { scope: "all" },
          milestones: [],
        },
      ],
    };

    const result = applyOnboardingV2DraftToScenarioV2(draft, scenarioWithPlaceholder);

    expect(result.members).toHaveLength(1);
    expect(result.members?.[0]).toMatchObject({
      id: "member-placeholder",
      name: "Alex",
      birthMonth: "1990-02",
      kind: "person",
    });
  });

  it("is idempotent when applying onboarding draft multiple times", () => {
    const draft = buildDraft({
      household: {
        members: [
          {
            id: "self",
            role: "self",
            name: "Alex",
            birthMonth: "1990-02",
          },
        ],
      },
    });
    const scenarioWithPlaceholder: Scenario = {
      ...baseScenario,
      members: [
        {
          id: "member-placeholder",
          name: "主要成員",
          kind: "person",
          applyScope: { scope: "all" },
          milestones: [],
        },
      ],
    };

    const once = applyOnboardingV2DraftToScenarioV2(draft, scenarioWithPlaceholder);
    const twice = applyOnboardingV2DraftToScenarioV2(draft, once);

    expect(once.members).toHaveLength(1);
    expect(twice.members).toHaveLength(1);
    expect(twice.members?.[0]?.id).toBe("member-placeholder");
    expect(twice.members?.[0]?.name).toBe("Alex");
  });
});
