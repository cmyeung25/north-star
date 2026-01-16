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

describe("mapScenarioToEngineInput home details", () => {
  it("uses purchase price to compute mortgage principal without inference", () => {
    const scenario = buildScenario({
      positions: {
        homes: [
          {
            id: "home-1",
            purchasePrice: 9000000,
            downPayment: 2000000,
            purchaseMonth: "2026-06",
            annualAppreciationPct: 3,
            mortgageRatePct: 4,
            mortgageTermYears: 30,
            feesOneTime: 0,
          },
        ],
      },
    });

    const input = mapScenarioToEngineInput(scenario, []);

    expect(input.positions?.homes?.[0]?.purchasePrice).toBe(9000000);
    expect(input.positions?.homes?.[0]?.mortgage?.principal).toBe(7000000);
  });

  it("maps existing homes without recalculating principal", () => {
    const scenario = buildScenario({
      positions: {
        homes: [
          {
            id: "home-2",
            mode: "existing",
            usage: "investment",
            annualAppreciationPct: 2,
            existing: {
              asOfMonth: "2024-12",
              marketValue: 5000000,
              mortgageBalance: 3200000,
              remainingTermMonths: 240,
              annualRatePct: 4.5,
            },
            rental: {
              rentMonthly: 18000,
              rentStartMonth: "2025-01",
              rentEndMonth: null,
              rentAnnualGrowthPct: 2,
              vacancyRatePct: 5,
            },
          },
        ],
      },
    });

    const input = mapScenarioToEngineInput(scenario, []);
    const home = input.positions?.homes?.[0];

    expect(home?.mode).toBe("existing");
    expect(home?.usage).toBe("investment");
    expect(home?.existing?.mortgageBalance).toBe(3200000);
    expect(home?.existing?.annualRate).toBeCloseTo(0.045);
    expect(home?.rental?.rentAnnualGrowth).toBeCloseTo(0.02);
    expect(home?.rental?.vacancyRate).toBeCloseTo(0.05);
    expect(home?.mortgage).toBeUndefined();
  });
});
