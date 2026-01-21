import { describe, expect, it } from "vitest";
import { compileBudgetRuleToMonthlySeries } from "../compileBudgetRules";
import type { BudgetRule, Scenario, ScenarioMember } from "../../../store/scenarioStore";

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
    horizonMonths: 3,
    initialCash: 0,
  },
  ...overrides,
});

const buildRule = (overrides: Partial<BudgetRule> = {}): BudgetRule => ({
  id: "rule-1",
  name: "Health",
  enabled: true,
  category: "health",
  monthlyAmount: 100,
  annualGrowthPct: 12,
  ageBand: { fromYears: 0, toYears: 99 },
  applyScope: { scope: "all" },
  ...overrides,
});

describe("compileBudgetRuleToMonthlySeries", () => {
  it("generates negative monthly entries with growth", () => {
    const scenario = buildScenario();
    const rule = buildRule();
    const members: ScenarioMember[] = [];

    const series = compileBudgetRuleToMonthlySeries(rule, scenario, members);

    expect(series).toHaveLength(3);
    expect((series[0]?.amount ?? 0) < 0).toBe(true);
    expect(Math.abs(series[1]?.amount ?? 0) > Math.abs(series[0]?.amount ?? 0)).toBe(
      true
    );
  });
});
