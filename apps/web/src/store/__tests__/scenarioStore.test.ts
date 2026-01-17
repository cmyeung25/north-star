import { beforeEach, describe, expect, it } from "vitest";
import type { EventDefinition } from "../../domain/events/types";
import {
  normalizeScenario,
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

describe("onboarding writes", () => {
  it("stores assumptions, positions, members, and budget rules", () => {
    const {
      updateScenarioAssumptions,
      addHomePosition,
      addCarPosition,
      addInvestmentPosition,
      addLoanPosition,
      upsertScenarioMember,
      addBudgetRule,
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

    upsertScenarioMember(scenario.id, {
      id: "member-child",
      name: "Child",
      kind: "person",
      birthMonth: "2024-08",
    });

    addBudgetRule(scenario.id, {
      id: "budget-childcare",
      name: "childcare",
      enabled: true,
      memberId: "member-child",
      category: "childcare",
      ageBand: { fromYears: 0, toYears: 6 },
      monthlyAmount: 3000,
      startMonth: "2024-08",
      endMonth: "2030-08",
    });

    const updated = useScenarioStore.getState().scenarios[0];

    expect(updated.assumptions.baseMonth).toBe("2024-02");
    expect(updated.assumptions.initialCash).toBe(50000);
    expect(updated.assumptions.horizonMonths).toBe(240);
    expect(updated.positions?.homes).toHaveLength(2);
    expect(updated.positions?.cars).toHaveLength(1);
    expect(updated.positions?.investments).toHaveLength(1);
    expect(updated.positions?.loans).toHaveLength(1);
    expect(updated.members?.some((member) => member.id === "member-child")).toBe(true);
    expect(updated.budgetRules?.some((rule) => rule.id === "budget-childcare")).toBe(
      true
    );
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
