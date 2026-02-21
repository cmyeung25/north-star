import { beforeEach, describe, expect, it } from "vitest";
import type { EventDefinition } from "../../domain/events/types";
import { resolveScenarioLifecycle } from "../../domain/scenarioStateModel";
import type { ScenarioSeedPayload } from "../../scenarios/scenarioSeeds";
import {
  normalizeScenario,
  hydrateFromPersistedState,
  isLegacyOnboardingScenario,
  resetAppState,
  resetScenarioStore,
  selectHasExistingProfile,
  useScenarioStore,
  type Scenario,
} from "../scenarioStore";

const buildScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "scenario-original",
  name: "Plan A",
  baseCurrency: "USD",
  updatedAt: 1716806400000,
  kpis: {
    lowestMonthlyBalance: -5000,
    runwayMonths: 12,
    netWorthYear5: 500000,
    riskLevel: "Medium",
  },
  assumptions: {
    horizonMonths: 240,
    initialCash: 10000,
    baseMonth: "2024-01",
    inflationRate: 2,
  },
  eventRefs: [
    {
      refId: "event-1",
      enabled: true,
      highlighted: false,
    },
  ],
  positions: {
    homes: [
      {
        id: "home-1",
        purchasePrice: 600000,
        downPayment: 120000,
        purchaseMonth: "2025-06",
        annualAppreciationPct: 3,
        mortgageRatePct: 5,
        mortgageTermYears: 30,
        feesOneTime: 8000,
        holdingCostMonthly: 350,
        holdingCostAnnualGrowthPct: 2,
      },
    ],
  },
  ...overrides,
});

const buildEventLibrary = (): EventDefinition[] => [
  {
    id: "event-1",
    title: "Starter Rent",
    type: "rent",
    kind: "cashflow",
    rule: {
      mode: "params",
      startMonth: "2024-01",
      endMonth: null,
      monthlyAmount: 1800,
      oneTimeAmount: 0,
      annualGrowthPct: 2,
    },
    currency: "USD",
  },
];

beforeEach(() => {
  const scenario = buildScenario();
  useScenarioStore.setState({
    scenarios: [scenario],
    eventLibrary: buildEventLibrary(),
    activeScenarioId: scenario.id,
    appSettings: {
      globalBaseMonth: scenario.assumptions.baseMonth,
      globalHorizonMonths: scenario.assumptions.horizonMonths,
      annualInflationPct: 0,
      viewMode: "nominal",
    },
    members: [],
    budgetRules: [],
  });
});

describe("duplicateScenario", () => {
  it("returns a new scenario with a new id and deep-copied data", () => {
    const { duplicateScenario } = useScenarioStore.getState();
    const source = useScenarioStore.getState().scenarios[0];

    const copy = duplicateScenario(source.id);

    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe(source.id);
    expect(copy?.name).toBe(`${source.name} (Copy)`);
    expect(copy?.assumptions).toEqual(source.assumptions);
    expect(copy?.kpis).toEqual(source.kpis);
    expect(copy?.eventRefs).toEqual(source.eventRefs);
    expect(copy?.positions).toEqual(source.positions);
    expect(copy?.eventRefs?.[0]).not.toBe(source.eventRefs?.[0]);
    expect(copy?.positions?.homes?.[0]).not.toBe(source.positions?.homes?.[0]);
  });

  it("does not mutate the original scenario when the duplicate is changed", () => {
    const { duplicateScenario } = useScenarioStore.getState();
    const source = useScenarioStore.getState().scenarios[0];

    const copy = duplicateScenario(source.id);
    if (!copy) {
      throw new Error("Expected duplicate scenario to be created.");
    }

    copy.assumptions.horizonMonths = 300;
    copy.eventRefs?.[0] && (copy.eventRefs[0].enabled = false);
    copy.positions?.homes?.[0] && (copy.positions.homes[0].purchasePrice = 750000);

    const original = useScenarioStore
      .getState()
      .scenarios.find((scenario) => scenario.id === source.id);

    expect(original?.assumptions.horizonMonths).toBe(240);
    expect(original?.eventRefs?.[0].enabled).toBe(true);
    expect(original?.positions?.homes?.[0].purchasePrice).toBe(600000);
  });
});

describe("normalizeScenario", () => {
  it("migrates start/end months into date refs", () => {
    const scenario = buildScenario({
      eventRefs: [
        {
          refId: "event-1",
          enabled: true,
          overrides: {
            startMonth: "2024-02",
            endMonth: "2024-12",
          },
        },
      ],
    });

    const normalized = normalizeScenario(scenario);
    const overrides = normalized.eventRefs?.[0]?.overrides;
    expect(overrides?.startAt).toEqual({ mode: "MONTH", month: "2024-02" });
    expect(overrides?.endAt).toEqual({ mode: "MONTH", month: "2024-12" });
  });
});

describe("hydrateFromPersistedState", () => {
  it("migrates event library date refs on hydrate", () => {
    const scenario = buildScenario();
    const payload = {
      scenarios: [scenario],
      eventLibrary: buildEventLibrary(),
      activeScenarioId: scenario.id,
    };

    const hydrated = hydrateFromPersistedState(payload);
    const rule = hydrated.eventLibrary[0]?.rule;
    expect(rule?.startAt).toEqual({ mode: "MONTH", month: "2024-01" });
    expect(rule?.endAt).toEqual(null);
  });
});

describe("position actions", () => {
  it("adds, updates, and removes car positions", () => {
    const { addCarPosition, updateCarPosition, removeCarPosition } =
      useScenarioStore.getState();
    const scenario = useScenarioStore.getState().scenarios[0];

    addCarPosition(scenario.id, {
      purchaseMonth: "2025-03",
      purchasePrice: 30000,
      downPayment: 5000,
      annualDepreciationRatePct: 12,
      holdingCostMonthly: 150,
      holdingCostAnnualGrowthPct: 2,
      loan: {
        principal: 25000,
        annualInterestRatePct: 4,
        termYears: 5,
        monthlyPayment: 500,
      },
    });

    const added = useScenarioStore.getState().scenarios[0].positions?.cars ?? [];
    expect(added).toHaveLength(1);
    expect(added[0]?.id).not.toBeUndefined();

    updateCarPosition(scenario.id, {
      ...added[0],
      holdingCostMonthly: 175,
    });

    const updated = useScenarioStore.getState().scenarios[0].positions?.cars ?? [];
    expect(updated[0]?.holdingCostMonthly).toBe(175);

    removeCarPosition(scenario.id, added[0]?.id ?? "");

    const removed = useScenarioStore.getState().scenarios[0].positions?.cars ?? [];
    expect(removed).toHaveLength(0);
  });

  it("adds, updates, and removes investment positions", () => {
    const { addInvestmentPosition, updateInvestmentPosition, removeInvestmentPosition } =
      useScenarioStore.getState();
    const scenario = useScenarioStore.getState().scenarios[0];

    addInvestmentPosition(scenario.id, {
      startMonth: "2024-06",
      initialValue: 15000,
      expectedAnnualReturnPct: 6,
      monthlyContribution: 500,
      monthlyWithdrawal: 0,
      feeAnnualRatePct: 0.4,
      assetClass: "fund",
    });

    const added =
      useScenarioStore.getState().scenarios[0].positions?.investments ?? [];
    expect(added).toHaveLength(1);
    expect(added[0]?.id).not.toBeUndefined();

    updateInvestmentPosition(scenario.id, {
      ...added[0],
      monthlyContribution: 700,
    });

    const updated =
      useScenarioStore.getState().scenarios[0].positions?.investments ?? [];
    expect(updated[0]?.monthlyContribution).toBe(700);

    removeInvestmentPosition(scenario.id, added[0]?.id ?? "");

    const removed =
      useScenarioStore.getState().scenarios[0].positions?.investments ?? [];
    expect(removed).toHaveLength(0);
  });

  it("adds, updates, and removes loan positions", () => {
    const { addLoanPosition, updateLoanPosition, removeLoanPosition } =
      useScenarioStore.getState();
    const scenario = useScenarioStore.getState().scenarios[0];

    addLoanPosition(scenario.id, {
      startMonth: "2024-08",
      principal: 20000,
      annualInterestRatePct: 5,
      termYears: 3,
      monthlyPayment: 600,
      feesOneTime: 100,
    });

    const added = useScenarioStore.getState().scenarios[0].positions?.loans ?? [];
    expect(added).toHaveLength(1);
    expect(added[0]?.id).not.toBeUndefined();

    updateLoanPosition(scenario.id, {
      ...added[0],
      monthlyPayment: 650,
    });

    const updated = useScenarioStore.getState().scenarios[0].positions?.loans ?? [];
    expect(updated[0]?.monthlyPayment).toBe(650);

    removeLoanPosition(scenario.id, added[0]?.id ?? "");

    const removed = useScenarioStore.getState().scenarios[0].positions?.loans ?? [];
    expect(removed).toHaveLength(0);
  });
});

describe("scenario v2 event asset/liability upserts", () => {
  const buildV2Scenario = (): Scenario => ({
    ...buildScenario({
      id: "scenario-v2",
      events: [],
      assets: [],
      liabilities: [],
      meta: { schemaVersion: 2 },
    }),
  });

  it("upserts housing mortgage assets and liabilities on save", () => {
    const scenario = buildV2Scenario();
    useScenarioStore.setState((state) => ({
      ...state,
      scenarios: [scenario],
      activeScenarioId: scenario.id,
    }));

    const { addEvent } = useScenarioStore.getState();
    const result = addEvent(
      {
        type: "housing",
        kind: "mortgage",
        startMonth: "2025-01",
        purchasePrice: 1000000,
        propertyMarketValue: 1000000,
        mortgageBaseValue: 1200000,
        mortgageBaseMode: "CUSTOM",
        downPaymentMode: "percent",
        downPaymentPercent: 20,
        mortgageRatePct: 4,
        mortgageTermYears: 30,
        propertyAssetId: "asset-home-1",
        mortgageLiabilityId: "liability-mortgage-1",
        label: "Primary Home",
      },
      scenario.id
    );

    expect(result.ok).toBe(true);

    const updated = useScenarioStore.getState().scenarios[0];
    const eventId = result.event?.id ?? "";
    const asset = updated.assets?.find((entry) => entry.id === "asset-home-1");
    const liability = updated.liabilities?.find(
      (entry) => entry.id === "liability-mortgage-1"
    );
    expect(asset).toMatchObject({
      id: "asset-home-1",
      kind: "home",
      currentValue: 1000000,
      source: "eventGenerated",
      createdByEventId: eventId,
      createdByTemplate: "housing_mortgage",
    });
    expect(liability).toMatchObject({
      id: "liability-mortgage-1",
      kind: "mortgage",
      principalOutstanding: 960000,
      annualInterestRatePct: 4,
      termYears: 30,
      source: "eventGenerated",
      createdByEventId: eventId,
      createdByTemplate: "housing_mortgage",
    });
  });

  it("upserts loan liabilities on save", () => {
    const scenario = buildV2Scenario();
    useScenarioStore.setState((state) => ({
      ...state,
      scenarios: [scenario],
      activeScenarioId: scenario.id,
    }));

    const { addEvent } = useScenarioStore.getState();
    const result = addEvent(
      {
        type: "loan",
        loanKind: "personal",
        startMonth: "2024-06",
        principal: 50000,
        annualInterestRatePct: 5,
        termYears: 5,
        liabilityId: "liability-loan-1",
        label: "Personal Loan",
      },
      scenario.id
    );

    expect(result.ok).toBe(true);

    const updated = useScenarioStore.getState().scenarios[0];
    const eventId = result.event?.id ?? "";
    const liability = updated.liabilities?.find(
      (entry) => entry.id === "liability-loan-1"
    );
    expect(liability).toMatchObject({
      id: "liability-loan-1",
      kind: "loan",
      principalOutstanding: 50000,
      annualInterestRatePct: 5,
      termYears: 5,
      source: "eventGenerated",
      createdByEventId: eventId,
      createdByTemplate: "loan",
    });
  });

  it("upserts savings policy assets on save", () => {
    const scenario = buildV2Scenario();
    useScenarioStore.setState((state) => ({
      ...state,
      scenarios: [scenario],
      activeScenarioId: scenario.id,
    }));

    const { addEvent } = useScenarioStore.getState();
    const result = addEvent(
      {
        type: "insurance",
        mode: "detailed",
        policies: [
          {
            id: "policy-1",
            policyId: "policy-1",
            policyAssetId: "asset-policy-1",
            name: "Savings Policy",
            kind: "savings",
            startMonth: "2024-02",
            premiumMonthly: 1500,
            cashValue: 12000,
          },
        ],
        label: "Insurance",
      },
      scenario.id
    );

    expect(result.ok).toBe(true);

    const updated = useScenarioStore.getState().scenarios[0];
    const eventId = result.event?.id ?? "";
    const asset = updated.assets?.find((entry) => entry.id === "asset-policy-1");
    expect(asset).toMatchObject({
      id: "asset-policy-1",
      kind: "policy",
      currentValue: 12000,
      source: "eventGenerated",
      createdByEventId: eventId,
      createdByTemplate: "insurance_savings",
    });
  });

  it("does not create cashflow rules when manually adding assets", () => {
    const scenario = buildV2Scenario();
    useScenarioStore.setState((state) => ({
      ...state,
      scenarios: [scenario],
      activeScenarioId: scenario.id,
    }));

    const { upsertScenarioAssets } = useScenarioStore.getState();
    upsertScenarioAssets(scenario.id, [
      {
        id: "asset-manual-1",
        kind: "investment",
        label: "Manual Asset",
        currentValue: 40000,
        source: "manual",
      },
    ]);

    const updated = useScenarioStore.getState().scenarios[0];
    expect(updated.events ?? []).toHaveLength(0);
    expect(updated.assets?.some((asset) => asset.id === "asset-manual-1")).toBe(true);
  });

  it("cascades delete for safe event-generated entities", () => {
    const scenario = buildV2Scenario();
    useScenarioStore.setState((state) => ({
      ...state,
      scenarios: [scenario],
      activeScenarioId: scenario.id,
    }));

    const { addEvent, removeEvent } = useScenarioStore.getState();
    const addResult = addEvent(
      {
        type: "loan",
        loanKind: "personal",
        startMonth: "2024-06",
        principal: 50000,
        annualInterestRatePct: 5,
        termYears: 5,
        liabilityId: "liability-loan-1",
        label: "Personal Loan",
      },
      scenario.id
    );

    const eventId = addResult.event?.id ?? "";
    const removeResult = removeEvent(eventId, scenario.id);
    expect(removeResult.ok).toBe(true);
    expect(removeResult.impact?.safeToCascade).toBe(true);

    const updated = useScenarioStore.getState().scenarios[0];
    expect(updated.events?.some((event) => event.id === eventId)).toBe(false);
    expect(
      updated.liabilities?.some((liability) => liability.id === "liability-loan-1")
    ).toBe(false);
  });
});

describe("scenario v2 events", () => {
  it("creates a v2 scenario skeleton and manages events", () => {
    const { createScenario, addEvent, updateEvent, removeEvent } =
      useScenarioStore.getState();

    const created = createScenario("V2 Scenario");

    expect(created.meta?.schemaVersion).toBe(2);
    expect(created.events).toEqual([]);
    expect(created.assets).toEqual([]);
    expect(created.liabilities).toEqual([]);
    expect(created.members).toEqual([]);

    const addResult = addEvent(
      {
        type: "cashflow",
        kind: "income",
        cadence: "monthly",
        amount: 3200,
        startMonth: "2024-01",
        label: "Salary",
      },
      created.id
    );

    expect(addResult.ok).toBe(true);
    const addedEventId = addResult.event?.id ?? "";

    const updateResult = updateEvent(
      addedEventId,
      { amount: 3500 },
      created.id
    );
    expect(updateResult.ok).toBe(true);
    if (updateResult.event?.type === "cashflow") {
      expect(updateResult.event.amount).toBe(3500);
    }

    const removeResult = removeEvent(addedEventId, created.id);
    expect(removeResult.ok).toBe(true);
  });
});

describe("onboarding writes", () => {
  it("stores assumptions, positions, members, and budget rules", () => {
    const {
      updateScenarioAssumptions,
      addHomePosition,
      addCarPosition,
      addInvestmentPosition,
      addLoanPosition,
      createMember,
      createBudgetRule,
    } = useScenarioStore.getState();
    const scenario = useScenarioStore.getState().scenarios[0];

    updateScenarioAssumptions(scenario.id, {
      baseMonth: "2024-02",
      horizonMonths: 240,
      initialCash: 50000,
    });

    addHomePosition(scenario.id, {
      id: "home-onboarding",
      purchasePrice: 800000,
      downPayment: 160000,
      purchaseMonth: "2026-06",
      annualAppreciationPct: 3,
      mortgageRatePct: 4.5,
      mortgageTermYears: 30,
      feesOneTime: 9000,
      holdingCostMonthly: 400,
      holdingCostAnnualGrowthPct: 2,
    });

    addCarPosition(scenario.id, {
      id: "car-onboarding",
      purchaseMonth: "2025-09",
      purchasePrice: 28000,
      downPayment: 5000,
      annualDepreciationRatePct: 12,
      holdingCostMonthly: 150,
      holdingCostAnnualGrowthPct: 2,
    });

    addInvestmentPosition(scenario.id, {
      id: "investment-onboarding",
      startMonth: "2024-02",
      initialValue: 0,
      expectedAnnualReturnPct: 5,
      monthlyContribution: 1000,
      assetClass: "fund",
    });

    addLoanPosition(scenario.id, {
      id: "loan-onboarding",
      startMonth: "2024-03",
      principal: 25000,
      annualInterestRatePct: 6,
      termYears: 5,
      monthlyPayment: 500,
    });

    createMember({
      id: "member-child",
      name: "Child",
      kind: "person",
      birthMonth: "2024-08",
      applyScope: { scope: "all" },
    });

    createBudgetRule({
      id: "budget-childcare",
      name: "childcare",
      enabled: true,
      memberId: "member-child",
      category: "childcare",
      ageBand: { fromYears: 0, toYears: 6 },
      monthlyAmount: 3000,
      startMonth: "2024-08",
      endMonth: "2030-08",
      applyScope: { scope: "all" },
    });

    const updatedScenario = useScenarioStore.getState().scenarios[0];
    const updatedMembers = useScenarioStore.getState().members;
    const updatedBudgetRules = useScenarioStore.getState().budgetRules;

    expect(updatedScenario.assumptions.baseMonth).toBe("2024-02");
    expect(updatedScenario.assumptions.initialCash).toBe(50000);
    expect(updatedScenario.assumptions.horizonMonths).toBe(240);
    expect(updatedScenario.positions?.homes).toHaveLength(2);
    expect(updatedScenario.positions?.cars).toHaveLength(1);
    expect(updatedScenario.positions?.investments).toHaveLength(1);
    expect(updatedScenario.positions?.loans).toHaveLength(1);
    expect(updatedMembers.some((member) => member.id === "member-child")).toBe(true);
    expect(updatedBudgetRules.some((rule) => rule.id === "budget-childcare")).toBe(true);
  });
});

describe("onboarding completion", () => {
  it("does not auto-mark a new scenario as completed", () => {
    const { createScenario } = useScenarioStore.getState();

    const created = createScenario("New Plan");

    expect(created.clientComputed?.onboardingCompleted).toBeUndefined();
  });

  it("keeps onboarding completion when switching scenarios", () => {
    useScenarioStore.setState({
      scenarios: [
        buildScenario({
          id: "scenario-a",
          clientComputed: { onboardingCompleted: true },
        }),
        buildScenario({
          id: "scenario-b",
          clientComputed: { onboardingCompleted: false },
        }),
      ],
      eventLibrary: buildEventLibrary(),
      activeScenarioId: "scenario-a",
      appSettings: {
        globalBaseMonth: "2024-01",
        globalHorizonMonths: 240,
        annualInflationPct: 0,
        viewMode: "nominal",
      },
      members: [],
      budgetRules: [],
    });

    const { setActiveScenario } = useScenarioStore.getState();

    setActiveScenario("scenario-b");

    const scenarios = useScenarioStore.getState().scenarios;
    expect(scenarios.find((scenario) => scenario.id === "scenario-a")?.clientComputed)
      .toEqual({ onboardingCompleted: true });
    expect(scenarios.find((scenario) => scenario.id === "scenario-b")?.clientComputed)
      .toEqual({ onboardingCompleted: false });
  });

  it("auto-completes onboarding when scenario has data but no flag", () => {
    const normalized = normalizeScenario(
      buildScenario({
        assumptions: {
          horizonMonths: 240,
          initialCash: 10000,
          baseMonth: "2024-01",
        },
        clientComputed: undefined,
      })
    );

    expect(normalized.clientComputed?.onboardingCompleted).toBe(true);
  });

  it("does not auto-complete onboarding for empty scenarios", () => {
    const normalized = normalizeScenario(
      buildScenario({
        assumptions: {
          horizonMonths: 240,
          initialCash: 0,
          baseMonth: null,
        },
        eventRefs: [],
        positions: undefined,
        clientComputed: undefined,
      })
    );

    expect(normalized.clientComputed?.onboardingCompleted).toBeUndefined();
  });
});

describe("selectHasExistingProfile", () => {
  it("returns false when there are no scenarios", () => {
    useScenarioStore.setState({
      scenarios: [],
      eventLibrary: [],
      activeScenarioId: "",
      appSettings: {
        globalBaseMonth: null,
        globalHorizonMonths: 240,
        annualInflationPct: 0,
        viewMode: "nominal",
      },
      members: [],
      budgetRules: [],
    });

    const result = selectHasExistingProfile(useScenarioStore.getState());

    expect(result).toBe(false);
  });

  it("returns true when scenarios exist", () => {
    const scenario = buildScenario();
    useScenarioStore.setState({
      scenarios: [scenario],
      eventLibrary: buildEventLibrary(),
      activeScenarioId: scenario.id,
      appSettings: {
        globalBaseMonth: scenario.assumptions.baseMonth,
        globalHorizonMonths: 240,
        annualInflationPct: 0,
        viewMode: "nominal",
      },
      members: [],
      budgetRules: [],
    });

    const result = selectHasExistingProfile(useScenarioStore.getState());

    expect(result).toBe(true);
  });
});

describe("resetScenarioStore", () => {
  it("clears scenarios and active selection", () => {
    resetScenarioStore();

    const state = useScenarioStore.getState();
    expect(state.scenarios).toHaveLength(0);
    expect(state.activeScenarioId).toBe("");
  });
});

describe("resetAppState", () => {
  it("preserves scenarios and active scenario selection", () => {
    const stateBefore = useScenarioStore.getState();
    const scenarioId = stateBefore.activeScenarioId;

    resetAppState();

    const stateAfter = useScenarioStore.getState();
    expect(stateAfter.scenarios).toHaveLength(stateBefore.scenarios.length);
    expect(stateAfter.activeScenarioId).toBe(scenarioId);
  });
});

describe("createScenarioFromSeed", () => {
  it("creates a seeded scenario that passes onboarding gate and opens core", () => {
    const { createScenarioFromSeed } = useScenarioStore.getState();

    const seed: ScenarioSeedPayload = {
      baseMonth: "2025-01",
      initialCash: 25000,
      assumptions: {
        horizonMonths: 180,
      },
      members: [
        {
          id: "primary",
          name: "Alex",
          kind: "person",
        },
      ],
      assets: [
        {
          id: "cash-1",
          kind: "cash",
          label: "Emergency fund",
          currentValue: 25000,
          startMonth: "2025-01",
        },
      ],
      liabilities: [],
      events: [],
      bundleInstances: [],
      bundleSummaries: [],
    };

    const created = createScenarioFromSeed("Seeded plan", seed);

    expect(created).not.toBeNull();
    expect(created?.meta?.isSeeded).toBe(true);
    expect(created?.meta?.skipOnboarding).toBe(true);
    expect(created?.meta?.schemaVersion).toBe(2);
    expect(created?.meta?.onboardingVersion).toBe(2);
    expect(created?.clientComputed?.onboardingCompleted).toBe(true);
    expect(created?.members?.[0]?.id).toContain(":member:primary");
    expect(resolveScenarioLifecycle(created)).toBe("active");
    expect(isLegacyOnboardingScenario(created)).toBe(false);
  });
});
