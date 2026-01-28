import { describe, expect, it } from "vitest";
import type { PlanLabDraft } from "../types";
import type { Scenario } from "../../../store/scenarioStore";
import { materializePlanLabDraft } from "../materializePlanLabDraft";

const buildScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "scenario-base",
  name: "Base Scenario",
  baseCurrency: "HKD",
  updatedAt: 0,
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Low",
  },
  assumptions: {
    horizonMonths: 120,
    initialCash: 0,
    baseMonth: "2024-01",
  },
  eventRefs: [],
  ...overrides,
});

describe("materializePlanLabDraft", () => {
  it("scopes new members and rules to the new scenario", () => {
    const scenario = buildScenario();
    const draft: PlanLabDraft = {
      additions: {
        members: [
          {
            id: "member-1",
            name: "New Member",
            kind: "person",
            birthMonth: "2024-01",
          },
        ],
        budgetRules: [
          {
            id: "rule-1",
            name: "Childcare",
            enabled: true,
            memberId: "member-1",
            category: "childcare",
            ageBand: { fromYears: 0, toYears: 3 },
            monthlyAmount: 1000,
            annualGrowthPct: 3,
          },
        ],
      },
    };

    const result = materializePlanLabDraft(scenario, draft, {
      scenarioId: "scenario-new",
      budgetRules: [],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.addedMembers[0]?.applyScope).toEqual({
      scope: "include",
      scenarioIds: ["scenario-new"],
    });
    expect(result.addedBudgetRules[0]?.applyScope).toEqual({
      scope: "include",
      scenarioIds: ["scenario-new"],
    });
  });
});
