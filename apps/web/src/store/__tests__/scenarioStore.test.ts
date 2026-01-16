import { beforeEach, describe, expect, it } from "vitest";
import type { EventDefinition } from "../../domain/events/types";
import { useScenarioStore, type Scenario } from "../scenarioStore";

const buildScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "scenario-original",
  name: "Plan A",
  baseCurrency: "USD",
  updatedAt: 1716806400000,
  kpis: {
    lowestMonthlyBalance: -5000,
    runwayMonths: 12,
    netWorthYear5: 500000,
    riskLevel: "Medium",
  },
  assumptions: {
    horizonMonths: 240,
    initialCash: 10000,
    baseMonth: "2024-01",
    inflationRate: 2,
  },
  eventRefs: [
    {
      refId: "event-1",
      enabled: true,
    },
  ],
  positions: {
    homes: [
      {
        id: "home-1",
        purchasePrice: 600000,
        downPayment: 120000,
        purchaseMonth: "2025-06",
        annualAppreciationPct: 3,
        mortgageRatePct: 5,
        mortgageTermYears: 30,
        feesOneTime: 8000,
        holdingCostMonthly: 350,
        holdingCostAnnualGrowthPct: 2,
      },
    ],
  },
  ...overrides,
});

const buildEventLibrary = (): EventDefinition[] => [
  {
    id: "event-1",
    title: "Starter Rent",
    type: "rent",
    kind: "cashflow",
    rule: {
      mode: "params",
      startMonth: "2024-01",
      endMonth: null,
      monthlyAmount: 1800,
      oneTimeAmount: 0,
      annualGrowthPct: 2,
    },
    currency: "USD",
  },
];

beforeEach(() => {
  const scenario = buildScenario();
  useScenarioStore.setState({
    scenarios: [scenario],
    eventLibrary: buildEventLibrary(),
    activeScenarioId: scenario.id,
  });
});

describe("duplicateScenario", () => {
  it("returns a new scenario with a new id and deep-copied data", () => {
    const { duplicateScenario } = useScenarioStore.getState();
    const source = useScenarioStore.getState().scenarios[0];

    const copy = duplicateScenario(source.id);

    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe(source.id);
    expect(copy?.name).toBe(`${source.name} (Copy)`);
    expect(copy?.assumptions).toEqual(source.assumptions);
    expect(copy?.kpis).toEqual(source.kpis);
    expect(copy?.eventRefs).toEqual(source.eventRefs);
    expect(copy?.positions).toEqual(source.positions);
    expect(copy?.eventRefs?.[0]).not.toBe(source.eventRefs?.[0]);
    expect(copy?.positions?.homes?.[0]).not.toBe(source.positions?.homes?.[0]);
  });

  it("does not mutate the original scenario when the duplicate is changed", () => {
    const { duplicateScenario } = useScenarioStore.getState();
    const source = useScenarioStore.getState().scenarios[0];

    const copy = duplicateScenario(source.id);
    if (!copy) {
      throw new Error("Expected duplicate scenario to be created.");
    }

    copy.assumptions.horizonMonths = 300;
    copy.eventRefs?.[0] && (copy.eventRefs[0].enabled = false);
    copy.positions?.homes?.[0] && (copy.positions.homes[0].purchasePrice = 750000);

    const original = useScenarioStore
      .getState()
      .scenarios.find((scenario) => scenario.id === source.id);

    expect(original?.assumptions.horizonMonths).toBe(240);
    expect(original?.eventRefs?.[0].enabled).toBe(true);
    expect(original?.positions?.homes?.[0].purchasePrice).toBe(600000);
  });
});
