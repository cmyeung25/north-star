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
  it("maps the earliest buy_home event into positions.home and removes it from events", () => {
    const scenario = buildScenario({
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
      purchasePrice: 500000,
      downPayment: 100000,
      purchaseMonth: "2026-03",
      annualAppreciation: 0.03,
      feesOneTime: 0,
      mortgage: {
        principal: 400000,
        annualRate: 0.03,
        termMonths: 360,
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
      "buy_home event requires oneTimeAmount for down payment."
    );
  });

  it("skips mapping in lenient mode when buy_home lacks oneTimeAmount", () => {
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
