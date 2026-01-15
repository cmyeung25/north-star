import { describe, expect, it } from "vitest";
import { computeComparisonMetrics } from "../rentVsOwnComparison";
import { toRentComparisonScenario } from "../scenarioTransforms";
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
    horizonMonths: 120,
    initialCash: 0,
    baseMonth: "2026-01",
  },
  events: [],
  ...overrides,
});

describe("rent vs own comparison", () => {
  it("finds breakeven and horizon delta", () => {
    const ownSeries = [
      { month: "2026-01", netWorth: 0 },
      { month: "2026-02", netWorth: 10 },
      { month: "2026-03", netWorth: 20 },
    ];
    const rentSeries = [
      { month: "2026-01", netWorth: 0 },
      { month: "2026-02", netWorth: 15 },
      { month: "2026-03", netWorth: 18 },
    ];

    const result = computeComparisonMetrics(ownSeries, rentSeries);

    expect(result?.breakevenLabel).toBe("2026-03");
    expect(result?.netWorthDeltaAtHorizon).toBe(2);
  });

  it("removes housing positions and buy_home events", () => {
    const scenario = buildScenario({
      events: [
        {
          id: "event-buy-home",
          type: "buy_home",
          name: "Buy Home",
          startMonth: "2026-01",
          endMonth: null,
          enabled: true,
          monthlyAmount: 0,
          oneTimeAmount: 500000,
          annualGrowthPct: 0,
          currency: "HKD",
        },
        {
          id: "event-rent",
          type: "rent",
          name: "Rent",
          startMonth: "2026-01",
          endMonth: null,
          enabled: true,
          monthlyAmount: 1800,
          oneTimeAmount: 0,
          annualGrowthPct: 3,
          currency: "HKD",
        },
      ],
      positions: {
        homes: [
          {
            id: "home-1",
            purchasePrice: 9000000,
            downPayment: 2000000,
            purchaseMonth: "2026-01",
            annualAppreciationPct: 2,
            mortgageRatePct: 3.5,
            mortgageTermYears: 30,
          },
        ],
      },
    });

    const rentScenario = toRentComparisonScenario(scenario);

    expect(rentScenario.positions?.homes ?? []).toHaveLength(0);
    expect(rentScenario.positions?.home).toBeUndefined();
    expect(rentScenario.events?.some((event) => event.type === "buy_home")).toBe(
      false
    );
    expect(rentScenario.events?.some((event) => event.type === "rent")).toBe(true);
  });
});
