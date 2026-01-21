import { describe, expect, it } from "vitest";
import { mapScenarioToEngineInput } from "../adapter";
import type { BudgetRule, Scenario, ScenarioMember } from "../../store/scenarioStore";

const buildScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "scenario-budget",
  name: "Budget Scenario",
  baseCurrency: "USD",
  updatedAt: 0,
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Low",
  },
  assumptions: {
    baseMonth: "2024-01",
    horizonMonths: 2,
    initialCash: 0,
    includeBudgetRulesInProjection: true,
  },
  ...overrides,
});

const buildRule = (overrides: Partial<BudgetRule> = {}): BudgetRule => ({
  id: "rule-health",
  name: "Health",
  enabled: true,
  category: "health",
  monthlyAmount: 100,
  ageBand: { fromYears: 0, toYears: 99 },
  applyScope: { scope: "all" },
  ...overrides,
});

describe("mapScenarioToEngineInput budget rules", () => {
  it("maps budget rules into projection events when enabled", () => {
    const scenario = buildScenario();
    const rules = [buildRule()];
    const members: ScenarioMember[] = [];

    const { input } = mapScenarioToEngineInput(scenario, [], {
      budgetRules: rules,
      members,
      strict: false,
    });

    expect(input.events.length).toBeGreaterThan(0);
    expect(
      input.events.some(
        (event) =>
          event.type === "health" &&
          event.startMonth === "2024-01" &&
          event.oneTimeAmount === -100
      )
    ).toBe(true);
  });
});
