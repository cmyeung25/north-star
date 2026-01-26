import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../store/scenarioStore";
import type { EventDefinition } from "../../events/types";
import { applyPlanLabDraftToScenario } from "../applyPlanLabDraftToScenario";

const buildScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "scenario-test",
  name: "Test Scenario",
  baseCurrency: "HKD",
  updatedAt: 0,
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Low",
  },
  assumptions: {
    horizonMonths: 240,
    initialCash: 0,
    baseMonth: "2024-01",
  },
  eventRefs: [],
  ...overrides,
});

describe("applyPlanLabDraftToScenario", () => {
  it("applies baseline patches to event refs and definitions", () => {
    const scenario = buildScenario();
    const definition: EventDefinition = {
      id: "event-1",
      title: "Income",
      type: "salary",
      kind: "cashflow",
      rule: {
        mode: "params",
        startMonth: "2024-01",
        endMonth: null,
        monthlyAmount: 5000,
        oneTimeAmount: 0,
        annualGrowthPct: 0,
      },
    };
    const result = applyPlanLabDraftToScenario(
      scenario,
      {
        baselinePatches: {
          eventPatches: {
            "event-1": {
              isDisabled: true,
              endMonth: "2025-01",
              patch: { ...definition, title: "Edited Income" },
            },
          },
        },
      },
      { scenarioId: scenario.id }
    );

    expect(result.errors).toHaveLength(0);
    expect(result.eventDefinitions).toHaveLength(1);
    expect(result.eventDefinitions[0].title).toBe("Edited Income");
    expect(result.scenario.eventRefs).toEqual([]);
  });

  it("returns errors for invalid months", () => {
    const scenario = buildScenario({
      eventRefs: [{ refId: "event-1", enabled: true }],
    });
    const result = applyPlanLabDraftToScenario(
      scenario,
      {
        baselinePatches: {
          eventPatches: {
            "event-1": {
              endMonth: "2025-99",
            },
          },
        },
      },
      { scenarioId: scenario.id }
    );

    expect(result.errors).toHaveLength(1);
    expect(result.eventDefinitions).toHaveLength(0);
    expect(result.scenario).toBe(scenario);
  });
});
