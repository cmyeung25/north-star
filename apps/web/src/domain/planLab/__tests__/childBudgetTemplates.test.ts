import { describe, expect, it } from "vitest";
import type { Scenario, ScenarioMember } from "../../../store/scenarioStore";
import { compileBudgetRuleToMonthlySeries } from "../../budget/compileBudgetRules";
import { buildChildBudgetRuleTemplates } from "../childBudgetTemplates";

const buildScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "scenario-1",
  name: "Scenario",
  baseCurrency: "HKD",
  updatedAt: 0,
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Low",
  },
  assumptions: {
    horizonMonths: 24,
    initialCash: 0,
    baseMonth: "2024-01",
  },
  eventRefs: [],
  ...overrides,
});

describe("buildChildBudgetRuleTemplates", () => {
  it("builds age bands and keeps positive amounts for UI", () => {
    const templates = buildChildBudgetRuleTemplates({
      memberId: "member-1",
      memberName: "Alex",
    });

    expect(templates).toHaveLength(3);
    expect(templates[0]?.ageBand).toEqual({ fromYears: 0, toYears: 3 });
    expect(templates[1]?.ageBand).toEqual({ fromYears: 3, toYears: 6 });
    expect(templates[2]?.ageBand).toEqual({ fromYears: 6, toYears: 18 });
    expect(templates.every((rule) => rule.monthlyAmount >= 0)).toBe(true);
  });

  it("compiles template rules with negative cashflows", () => {
    const scenario = buildScenario();
    const member: ScenarioMember = {
      id: "member-1",
      name: "Alex",
      kind: "person",
      birthMonth: "2023-01",
    };
    const [template] = buildChildBudgetRuleTemplates({
      memberId: member.id,
      memberName: member.name,
    });
    const rule = {
      ...template,
      monthlyAmount: 1000,
    };
    const series = compileBudgetRuleToMonthlySeries(rule, scenario, [member]);
    const firstMonth = series.find((entry) => entry.month === "2024-01");
    expect(firstMonth?.amount).toBe(-1000);
  });
});
