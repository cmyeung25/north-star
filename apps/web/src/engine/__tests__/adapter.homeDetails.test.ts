import { describe, expect, it } from "vitest";
import { mapScenarioToEngineInput } from "../adapter";
import type { Scenario } from "../../store/scenarioStore";

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
    baseMonth: null,
  },
  events: [],
  ...overrides,
});

describe("mapScenarioToEngineInput home details", () => {
  it("uses purchase price to compute mortgage principal without inference", () => {
    const scenario = buildScenario({
      positions: {
        home: {
          purchasePrice: 9000000,
          downPayment: 2000000,
          purchaseMonth: "2026-06",
          annualAppreciationPct: 3,
          mortgageRatePct: 4,
          mortgageTermYears: 30,
          feesOneTime: 0,
        },
      },
    });

    const input = mapScenarioToEngineInput(scenario);

    expect(input.positions?.home?.purchasePrice).toBe(9000000);
    expect(input.positions?.home?.mortgage?.principal).toBe(7000000);
  });
});
