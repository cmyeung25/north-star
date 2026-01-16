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
  eventRefs: [],
  ...overrides,
});

describe("mapScenarioToEngineInput multi-home support", () => {
  it("normalizes legacy positions.home into positions.homes", () => {
    const scenario = buildScenario({
      positions: {
        home: {
          purchasePrice: 8_000_000,
          downPayment: 1_000_000,
          purchaseMonth: "2026-01",
          annualAppreciationPct: 2,
          mortgageRatePct: 3,
          mortgageTermYears: 25,
          feesOneTime: 0,
        },
      },
    });

    const input = mapScenarioToEngineInput(scenario, []);

    expect(input.positions?.homes).toHaveLength(1);
    expect(input.positions?.homes?.[0]?.purchasePrice).toBe(8_000_000);
  });

  it("maps multiple homes and calculates principals", () => {
    const scenario = buildScenario({
      positions: {
        homes: [
          {
            id: "home-a",
            purchasePrice: 10_000_000,
            downPayment: 2_000_000,
            purchaseMonth: "2026-01",
            annualAppreciationPct: 1,
            mortgageRatePct: 3.5,
            mortgageTermYears: 30,
            feesOneTime: 0,
          },
          {
            id: "home-b",
            purchasePrice: 6_000_000,
            downPayment: 1_000_000,
            purchaseMonth: "2026-01",
            annualAppreciationPct: 1,
            mortgageRatePct: 3.2,
            mortgageTermYears: 25,
            feesOneTime: 0,
          },
        ],
      },
    });

    const input = mapScenarioToEngineInput(scenario, []);

    expect(input.positions?.homes).toHaveLength(2);
    expect(input.positions?.homes?.[0]?.mortgage?.principal).toBe(8_000_000);
    expect(input.positions?.homes?.[1]?.mortgage?.principal).toBe(5_000_000);
  });
});
