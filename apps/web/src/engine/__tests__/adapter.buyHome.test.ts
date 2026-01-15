import { describe, expect, it } from "vitest";
import { mapScenarioToEngineInput } from "../adapter";
import type { Scenario } from "../../store/scenarioStore";

const buildScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "scenario-test",
  name: "Test Scenario",
  baseCurrency: "USD",
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

describe("mapScenarioToEngineInput buy_home mapping", () => {
  it("uses scenario.positions.home and removes buy_home events from the timeline", () => {
    const scenario = buildScenario({
      positions: {
        home: {
          purchasePrice: 9000000,
          downPayment: 2000000,
          purchaseMonth: "2026-03",
          annualAppreciationPct: 2.5,
          mortgageRatePct: 4.1,
          mortgageTermYears: 25,
          feesOneTime: 300000,
        },
      },
      events: [
        {
          id: "event-rent",
          type: "rent",
          name: "Rent",
          startMonth: "2025-01",
          endMonth: null,
          enabled: true,
          monthlyAmount: 1800,
          oneTimeAmount: 0,
          annualGrowthPct: 2,
          currency: "USD",
        },
        {
          id: "event-buy-home",
          type: "buy_home",
          name: "Buy Home",
          startMonth: "2026-03",
          endMonth: null,
          enabled: true,
          monthlyAmount: 2000,
          oneTimeAmount: 100000,
          annualGrowthPct: 3,
          currency: "USD",
        },
      ],
    });

    const input = mapScenarioToEngineInput(scenario);

    expect(input.positions?.home).toEqual({
      purchasePrice: 9000000,
      downPayment: 2000000,
      purchaseMonth: "2026-03",
      annualAppreciation: 0.025,
      feesOneTime: 300000,
      mortgage: {
        principal: 7000000,
        annualRate: 0.041,
        termMonths: 300,
      },
    });

    expect(input.events).toHaveLength(1);
    expect(input.events[0]).toMatchObject({
      startMonth: "2025-01",
      monthlyAmount: 1800,
      oneTimeAmount: 0,
      annualGrowthPct: 0.02,
    });
  });

  it("throws in strict mode when buy_home lacks oneTimeAmount", () => {
    const scenario = buildScenario({
      events: [
        {
          id: "event-buy-home",
          type: "buy_home",
          name: "Buy Home",
          startMonth: "2026-03",
          endMonth: null,
          enabled: true,
          monthlyAmount: 2000,
          oneTimeAmount: undefined as unknown as number,
          annualGrowthPct: 3,
          currency: "USD",
        },
      ],
    });

    expect(() => mapScenarioToEngineInput(scenario, { strict: true })).toThrow(
      "buy_home event requires home details in scenario.positions.home."
    );
  });

  it("skips mapping in lenient mode when buy_home has no home details", () => {
    const scenario = buildScenario({
      events: [
        {
          id: "event-buy-home",
          type: "buy_home",
          name: "Buy Home",
          startMonth: "2026-03",
          endMonth: null,
          enabled: true,
          monthlyAmount: 2000,
          oneTimeAmount: undefined as unknown as number,
          annualGrowthPct: 3,
          currency: "USD",
        },
      ],
    });

    const input = mapScenarioToEngineInput(scenario, { strict: false });

    expect(input.positions?.home).toBeUndefined();
    expect(input.events).toHaveLength(0);
  });
});
