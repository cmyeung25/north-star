import { describe, expect, it } from "vitest";
import { mapScenarioToEngineInput } from "../adapter";
import type { Scenario } from "../../store/scenarioStore";
import type { EventDefinition } from "../../domain/events/types";

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
  eventRefs: [],
  ...overrides,
});

const buildEventLibrary = (entries: EventDefinition[]): EventDefinition[] => entries;

describe("mapScenarioToEngineInput buy_home mapping", () => {
  it("uses scenario.positions.homes and removes buy_home events from the timeline", () => {
    const scenario = buildScenario({
      positions: {
        homes: [
          {
            id: "home-1",
            purchasePrice: 9000000,
            downPayment: 2000000,
            purchaseMonth: "2026-03",
            annualAppreciationPct: 2.5,
            mortgageRatePct: 4.1,
            mortgageTermYears: 25,
            feesOneTime: 300000,
          },
        ],
      },
      eventRefs: [
        { refId: "event-rent", enabled: true },
        { refId: "event-buy-home", enabled: true },
      ],
    });

    const eventLibrary = buildEventLibrary([
      {
        id: "event-rent",
        title: "Rent",
        type: "rent",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2025-01",
          endMonth: null,
          monthlyAmount: 1800,
          oneTimeAmount: 0,
          annualGrowthPct: 2,
        },
        currency: "USD",
      },
      {
        id: "event-buy-home",
        title: "Buy Home",
        type: "buy_home",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2026-03",
          endMonth: null,
          monthlyAmount: 2000,
          oneTimeAmount: 100000,
          annualGrowthPct: 3,
        },
        currency: "USD",
      },
    ]);

    const { input } = mapScenarioToEngineInput(scenario, eventLibrary);

    const home = input.positions?.homes?.[0];

    expect(home).toMatchObject({
      purchasePrice: 9000000,
      downPayment: 2000000,
      purchaseMonth: "2026-03",
      annualAppreciation: 0.025,
      feesOneTime: 300000,
      holdingCostMonthly: 0,
      holdingCostAnnualGrowth: 0,
      mortgage: {
        principal: 7000000,
        termMonths: 300,
      },
    });
    expect(home?.mortgage?.annualRate).toBeCloseTo(0.041);

    expect(input.events.length > 1).toBe(true);
    expect(input.events.every((event) => event.id?.startsWith("event-rent"))).toBe(
      true
    );
    expect(input.events[0]).toMatchObject({
      startMonth: "2025-01",
      monthlyAmount: 0,
      oneTimeAmount: -1800,
      annualGrowthPct: 0,
    });
  });

  it("throws in strict mode when buy_home lacks oneTimeAmount", () => {
    const scenario = buildScenario({
      eventRefs: [{ refId: "event-buy-home", enabled: true }],
    });

    const eventLibrary = buildEventLibrary([
      {
        id: "event-buy-home",
        title: "Buy Home",
        type: "buy_home",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2026-03",
          endMonth: null,
          monthlyAmount: 2000,
          oneTimeAmount: undefined as unknown as number,
          annualGrowthPct: 3,
        },
        currency: "USD",
      },
    ]);

    expect(() =>
      mapScenarioToEngineInput(scenario, eventLibrary, { strict: true })
    ).toThrow(
      "buy_home event requires home details in scenario.positions.homes."
    );
  });

  it("skips mapping in lenient mode when buy_home has no home details", () => {
    const scenario = buildScenario({
      eventRefs: [{ refId: "event-buy-home", enabled: true }],
    });

    const eventLibrary = buildEventLibrary([
      {
        id: "event-buy-home",
        title: "Buy Home",
        type: "buy_home",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2026-03",
          endMonth: null,
          monthlyAmount: 2000,
          oneTimeAmount: undefined as unknown as number,
          annualGrowthPct: 3,
        },
        currency: "USD",
      },
    ]);

    const { input } = mapScenarioToEngineInput(scenario, eventLibrary, { strict: false });

    expect(input.positions?.homes).toBeUndefined();
    expect(input.events).toHaveLength(0);
  });
});
