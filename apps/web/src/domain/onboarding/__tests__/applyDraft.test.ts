import { beforeEach, describe, expect, it } from "vitest";
import {
  applyOnboardingDraftToScenario,
  type OnboardingDraft,
} from "../applyDraft";
import type { Scenario } from "../../../store/scenarioStore";
import { useScenarioStore } from "../../../store/scenarioStore";

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
  eventRefs: [],
  positions: {},
  ...overrides,
});

const buildDraft = (): OnboardingDraft => ({
  members: [
    {
      id: "member-1",
      name: "Alex",
      kind: "person",
      birthMonth: "1990-01",
    },
  ],
  settings: {
    baseMonth: "2024-01",
    horizonMonths: 240,
    annualInflationPct: 2,
    viewMode: "nominal",
    initialCash: 10000,
  },
  budgetRules: [
    {
      id: "rule-1",
      name: "Childcare",
      enabled: true,
      memberId: "household",
      category: "childcare",
      ageBand: { fromYears: 0, toYears: 6 },
      monthlyAmount: 3000,
      annualGrowthPct: 0,
      startMonth: "2024-01",
      endMonth: "2030-12",
    },
  ],
  positions: {
    homes: [],
    cars: [],
    investments: [],
    loans: [],
  },
  incomes: [
    {
      id: "income-1",
      title: "Salary",
      memberId: "member-1",
      subtype: "salary",
      monthlyAmount: 50000,
      startMonth: "2024-01",
      endMonth: "",
      endAtAgeYears: undefined,
      annualGrowthPct: 0,
    },
  ],
  timelineEvents: [],
});

beforeEach(() => {
  const scenario = buildScenario();
  useScenarioStore.setState({
    scenarios: [scenario],
    eventLibrary: [],
    activeScenarioId: scenario.id,
    appSettings: {
      globalBaseMonth: "2024-01",
      globalHorizonMonths: 240,
      annualInflationPct: 0,
      viewMode: "nominal",
    },
    members: [],
    budgetRules: [],
  });
});

describe("applyOnboardingDraftToScenario", () => {
  it("creates members, budget rules, and income events", () => {
    const scenario = useScenarioStore.getState().scenarios[0];
    const draft = buildDraft();

    applyOnboardingDraftToScenario(scenario, draft, useScenarioStore.getState());

    const state = useScenarioStore.getState();
    expect(state.members).toHaveLength(1);
    expect(state.budgetRules).toHaveLength(1);
    expect(state.eventLibrary.some((event) => event.id === "income-1")).toBe(true);
    const eventDefinition = state.eventLibrary.find((event) => event.id === "income-1");
    expect(eventDefinition?.memberId).toBe("member-1");
    expect(state.scenarios[0]?.eventRefs?.some((ref) => ref.refId === "income-1")).toBe(
      true
    );
  });
});
