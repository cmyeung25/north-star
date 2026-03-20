import { describe, expect, it } from "vitest";
import { getDraftStorageKey as getOnboardingV2DraftStorageKey } from "../../draftStorage";
import { buildOnboardingDraftStateFromSeed } from "../../seedPrefill";
import {
  clearOnboardingDraftState,
  convertOnboardingV2DraftToV3State,
  getOnboardingV3DraftStorageKey,
  loadOnboardingV3DraftState,
} from "../draftStorage";
import { createInitialScenarioDraftV3State } from "../types";
import { getScenarioSeeds } from "../../../../scenarios/scenarioSeeds";
import type { DraftStorageState as OnboardingV2DraftStorageState } from "../../draftStorage";

const t = Object.assign((key: string) => key, {
  raw: () => [],
});

const labels = {
  dailyExpenseLabel: "Daily living",
  incomeBonusLabel: "Bonus",
  incomeSalaryLabel: "Salary",
  rentExpenseLabel: "Rent",
  taxExpenseLabel: "Tax",
  travelExpenseLabel: "Travel",
};

const createFallbackState = () =>
  createInitialScenarioDraftV3State({ defaultMemberName: "Me" });

const createLegacyDraft = (
  overrides: Partial<OnboardingV2DraftStorageState> = {}
): OnboardingV2DraftStorageState => ({
  step: 0,
  profile: {
    baseCurrency: "HKD",
    startMonth: "2026-01",
    horizonYears: 10,
    ...overrides.profile,
  },
  household: {
    hasPartner: false,
    childCount: 0,
    petCount: 0,
    members: [{ id: "self", role: "self", name: "Me", birthMonth: "" }],
    ...overrides.household,
  },
  assumptions: {
    inflationPct: 2,
    incomeGrowthPct: 3,
    investmentReturnPct: 4,
    rentGrowthPct: 2,
    propertyAppreciationPct: 3,
    carDepreciationPct: 12,
    cashYieldPct: 1,
    taxInputMode: "gross",
    ...overrides.assumptions,
  },
  incomes: overrides.incomes ?? [],
  livingSpend: overrides.livingSpend ?? {
    fixed: { amount: 0, startMonth: "2026-01", endMonth: "" },
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
    travel: {
      mode: "monthly",
      monthlyAmount: 0,
      annualAmount: 0,
      months: [],
      growthMode: "follow_env",
      growthRate: null,
    },
    tax: {
      mode: "monthly",
      monthlyAmount: 0,
      annualAmount: 0,
      months: [],
      growthMode: "follow_env",
      growthRate: null,
    },
    otherFixed: [],
  },
  housing: overrides.housing ?? {
    mode: "rent",
    rent: { amount: 0, noPayment: true, startMonth: "2026-01", endMonth: "", rentGrowthPct: null },
    own: {
      propertyMarketValue: 0,
      mortgageBaseValue: 0,
      mortgageBaseMode: "SYNC",
      startMonth: "2026-01",
      downPaymentMode: "percent",
      downPaymentPercent: 0,
      downPaymentAmount: 0,
      mortgageEnabled: false,
      mortgageRatePct: 0,
      mortgageTermYears: 0,
      mortgagePayment: 0,
      mortgagePaymentSource: "estimated",
      fees: [],
      ongoingCosts: [],
      rental: { enabled: false, amount: 0, startMonth: "2026-01", endMonth: "", discountAmount: 0 },
    },
  },
  assets: overrides.assets ?? {
    cash: { amount: 0, startMonth: "2026-01" },
    investment: {
      totalAmount: 0,
      startMonth: "2026-01",
      breakdownEnabled: false,
      breakdown: [],
    },
    car: {
      enabled: false,
      value: 0,
      startMonth: "2026-01",
      depreciationPct: null,
    },
    contributions: [],
    insurances: [],
  },
  debts: overrides.debts ?? [],
  insurance: overrides.insurance ?? {
    mode: "quick",
    quick: { amount: 0, startMonth: "2026-01", endMonth: "" },
    policies: [],
  },
});

const createStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    dump: () => store,
  };
};

describe("onboarding v3 draft storage", () => {
  it("maps renter preset into separate rent and living expense rows without double counting", () => {
    const seed = getScenarioSeeds(t).find((entry) => entry.id === "single-renter");

    expect(Boolean(seed)).toBe(true);

    const legacyDraft = buildOnboardingDraftStateFromSeed(seed!.payload);
    const v3Draft = convertOnboardingV2DraftToV3State({
      draftState: legacyDraft,
      fallbackState: createFallbackState(),
      labels,
    });

    const rentExpense = v3Draft.events.find((event) => event.id === "prefill-expense-rent");
    const dailyExpense = v3Draft.events.find((event) => event.id === "prefill-expense-daily");
    const monthlyExpenseTotal = v3Draft.events.reduce(
      (sum, event) =>
        event.type === "cashflow" && event.kind === "expense" && event.cadence === "monthly"
          ? sum + event.amount
          : sum,
      0
    );

    expect(rentExpense && rentExpense.type === "cashflow" ? rentExpense.amount : 0).toBe(12000);
    expect(dailyExpense && dailyExpense.type === "cashflow" ? dailyExpense.amount : 6000).toBe(6000);
    expect(monthlyExpenseTotal).toBe(18000);
  });

  it("maps owned-home preset into a property asset with mortgage details", () => {
    const seed = getScenarioSeeds(t).find((entry) => entry.id === "dual-income-home");

    expect(Boolean(seed)).toBe(true);

    const legacyDraft = buildOnboardingDraftStateFromSeed(seed!.payload);
    const v3Draft = convertOnboardingV2DraftToV3State({
      draftState: legacyDraft,
      fallbackState: createFallbackState(),
      labels,
    });

    const propertyAsset = v3Draft.assets.find((asset) => asset.assetType === "property");

    expect(propertyAsset?.assetType).toBe("property");
    expect(propertyAsset?.currentValue).toBe(6000000);
    expect(propertyAsset?.usage).toBe("self");
    expect(propertyAsset?.mortgagePrincipalOutstanding).toBe(4800000);
    expect(propertyAsset?.holdingCostMonthly).toBe(1500);
    expect(v3Draft.assetToggles.propertyEnabled).toBe(true);
  });

  it("preserves seed-derived assumptions in the hidden v3 assumptions bag", () => {
    const seed = getScenarioSeeds(t).find((entry) => entry.id === "dual-income-rental");

    expect(Boolean(seed)).toBe(true);

    const legacyDraft = buildOnboardingDraftStateFromSeed(seed!.payload);
    const v3Draft = convertOnboardingV2DraftToV3State({
      draftState: legacyDraft,
      fallbackState: createFallbackState(),
      labels,
    });

    expect(v3Draft.assumptions.baseMonth).toBe("2026-02");
    expect(v3Draft.assumptions.horizonMonths).toBe(120);
    expect(v3Draft.assumptions.salaryGrowthRate).toBe(3);
    expect(v3Draft.assumptions.rentAnnualGrowthPct).toBe(2);
    expect(v3Draft.assumptions.propertyAppreciationPct).toBe(2);
    expect(v3Draft.assumptions.mortgageRatePct).toBe(3.25);
  });

  it("keeps down-payment percentage anchored to property value when migrating custom mortgage base", () => {
    const legacyDraft = createLegacyDraft({
      housing: {
        mode: "own",
        rent: { amount: 0, noPayment: true, startMonth: "2026-01", endMonth: "", rentGrowthPct: null },
        own: {
          propertyMarketValue: 1_000_000,
          mortgageBaseValue: 1_200_000,
          mortgageBaseMode: "CUSTOM",
          startMonth: "2026-01",
          downPaymentMode: "percent",
          downPaymentPercent: 20,
          downPaymentAmount: 0,
          mortgageEnabled: true,
          mortgageRatePct: 3.5,
          mortgageTermYears: 30,
          mortgagePayment: 0,
          mortgagePaymentSource: "estimated",
          fees: [],
          ongoingCosts: [],
          rental: { enabled: false, amount: 0, startMonth: "2026-01", endMonth: "", discountAmount: 0 },
        },
      },
    });

    const v3Draft = convertOnboardingV2DraftToV3State({
      draftState: legacyDraft,
      fallbackState: createFallbackState(),
      labels,
    });

    const propertyAsset = v3Draft.assets.find((asset) => asset.assetType === "property");

    expect(propertyAsset?.assetType).toBe("property");
    expect(propertyAsset?.mortgagePrincipalOutstanding).toBe(1_000_000);
  });

  it("prefers an existing v3 draft over v2 migration", () => {
    const storage = createStorage();
    const v2Key = getOnboardingV2DraftStorageKey("scenario-v3-priority");
    const v3Key = getOnboardingV3DraftStorageKey("scenario-v3-priority");
    const seed = getScenarioSeeds(t).find((entry) => entry.id === "single-renter");
    const legacyDraft = buildOnboardingDraftStateFromSeed(seed!.payload);
    const existingV3Draft = {
      ...createFallbackState(),
      profile: {
        baseCurrency: "USD",
        startMonth: "2030-01",
        horizonMonths: 360,
      },
    };

    storage.setItem(v2Key, JSON.stringify(legacyDraft));
    storage.setItem(v3Key, JSON.stringify(existingV3Draft));

    const loaded = loadOnboardingV3DraftState({
      fallbackState: createFallbackState(),
      labels,
      scenarioId: "scenario-v3-priority",
      storage,
    });

    expect(loaded.profile.startMonth).toBe("2030-01");
    expect(loaded.profile.baseCurrency).toBe("USD");
  });

  it("falls back to v2 draft migration and writes the migrated v3 draft", () => {
    const storage = createStorage();
    const scenarioId = "scenario-v2-fallback";
    const seed = getScenarioSeeds(t).find((entry) => entry.id === "new-baby-helper");
    const legacyDraft = buildOnboardingDraftStateFromSeed(seed!.payload);

    storage.setItem(getOnboardingV2DraftStorageKey(scenarioId), JSON.stringify(legacyDraft));

    const loaded = loadOnboardingV3DraftState({
      fallbackState: createFallbackState(),
      labels,
      scenarioId,
      storage,
    });

    expect(loaded.members.some((member) => member.id === "child-1")).toBe(true);
    expect(storage.dump().has(getOnboardingV3DraftStorageKey(scenarioId))).toBe(true);
  });

  it("clears both v2 and v3 scenario-scoped draft keys", () => {
    const storage = createStorage();
    const scenarioId = "scenario-clear";

    storage.setItem(getOnboardingV2DraftStorageKey(scenarioId), "legacy");
    storage.setItem(getOnboardingV3DraftStorageKey(scenarioId), "current");

    clearOnboardingDraftState(scenarioId, storage);

    expect(storage.dump().has(getOnboardingV2DraftStorageKey(scenarioId))).toBe(false);
    expect(storage.dump().has(getOnboardingV3DraftStorageKey(scenarioId))).toBe(false);
  });
});
