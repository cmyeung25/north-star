import { describe, expect, it } from "vitest";
import { computeComparisonMetrics } from "../rentVsOwnComparison";
import {
  buildRentComparisonEvents,
  buildRentComparisonScenario,
} from "../scenarioTransforms";
import type { Scenario } from "../../store/scenarioStore";
import type { EventDefinition } from "../../domain/events/types";

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
  eventRefs: [],
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

  it("removes primary housing positions and buy_home events", () => {
    const scenario = buildScenario({
      eventRefs: [
        { refId: "event-buy-home", enabled: true },
        { refId: "event-rent", enabled: true },
      ],
      positions: {
        homes: [
          {
            id: "home-1",
            usage: "primary",
            purchasePrice: 9000000,
            downPayment: 2000000,
            purchaseMonth: "2026-01",
            annualAppreciationPct: 2,
            mortgageRatePct: 3.5,
            mortgageTermYears: 30,
          },
          {
            id: "home-2",
            usage: "investment",
            purchasePrice: 5000000,
            downPayment: 1000000,
            purchaseMonth: "2026-01",
            annualAppreciationPct: 2,
            mortgageRatePct: 3.5,
            mortgageTermYears: 30,
          },
        ],
      },
    });

    const eventLibrary: EventDefinition[] = [
      {
        id: "event-buy-home",
        title: "Buy Home",
        type: "buy_home",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2026-01",
          endMonth: null,
          monthlyAmount: 0,
          oneTimeAmount: 500000,
          annualGrowthPct: 0,
        },
        currency: "HKD",
      },
      {
        id: "event-rent",
        title: "Rent",
        type: "rent",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2026-01",
          endMonth: null,
          monthlyAmount: 1800,
          oneTimeAmount: 0,
          annualGrowthPct: 3,
        },
        currency: "HKD",
      },
    ];

    const rentScenario = buildRentComparisonScenario(scenario);
    const rentEvents = buildRentComparisonEvents(rentScenario, eventLibrary);

    expect(rentScenario.positions?.homes ?? []).toHaveLength(1);
    expect(rentScenario.positions?.homes?.[0]?.usage).toBe("investment");
    expect(rentScenario.positions?.home).toBeUndefined();
    expect(rentEvents.some((event) => event.type === "buy_home")).toBe(false);
    expect(rentEvents.some((event) => event.type === "rent")).toBe(true);
  });
});
