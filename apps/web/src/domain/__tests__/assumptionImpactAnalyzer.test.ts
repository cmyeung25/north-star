import { describe, expect, it } from "vitest";
import type { Scenario } from "../../store/scenarioStore";
import type { ScenarioEvent } from "../scenarioV2/events";
import { analyzeAssumptionImpact } from "../assumptions/impactAnalyzer";
import { mapScenarioToEngineInput } from "../../engine/adapter";
import { computeProjection } from "@north-star/engine";

const buildScenario = (overrides?: Partial<Pick<Scenario, "events" | "assets" | "assumptions">>) => ({
  assumptions: {
    horizonMonths: 120,
    initialCash: 0,
    baseMonth: "2025-01",
    inflationRate: 2,
    salaryGrowthRate: 3,
    rentAnnualGrowthPct: 2.5,
    propertyAppreciationPct: 3,
    cashYieldPct: 1,
    carDepreciationRatePct: 15,
    ...overrides?.assumptions,
  },
  events: overrides?.events ?? [],
  assets: overrides?.assets ?? [],
  liabilities: [],
});


const buildEngineScenario = (cashYieldPct: number): Scenario => ({
  id: `scenario-cash-yield-${cashYieldPct}`,
  name: "Cash Yield Scenario",
  baseCurrency: "HKD",
  updatedAt: 0,
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Low",
  },
  assumptions: {
    horizonMonths: 12,
    initialCash: 100000,
    baseMonth: "2025-01",
    cashYieldPct,
  },
  events: [],
  liabilities: [],
});

const incomeEvent = (id: string): ScenarioEvent => ({
  id,
  type: "cashflow",
  kind: "income",
  cadence: "monthly",
  amount: 30000,
  startMonth: "2025-01",
  growthMode: "assumption",
});

const expenseEvent = (id: string): ScenarioEvent => ({
  id,
  type: "cashflow",
  kind: "expense",
  cadence: "monthly",
  amount: 12000,
  startMonth: "2025-01",
  growthMode: "assumption",
});

const housingRentEvent = (id: string): ScenarioEvent => ({
  id,
  type: "housing",
  kind: "rent",
  startMonth: "2025-01",
  rentMonthly: 15000,
  rentGrowthMode: "assumption",
});

describe("analyzeAssumptionImpact", () => {
  it("returns empty impact when no entity depends on overridden assumption", () => {
    const scenario = buildScenario();

    const result = analyzeAssumptionImpact(scenario, { salaryGrowthRate: 5 });

    expect(result.byAssumptionKey).toEqual({});
    expect(result.byEventId).toEqual({});
    expect(result.summary.totalImpactedEventCount).toBe(0);
    expect(result.summary.distribution).toEqual({ income: 0, expense: 0, housing: 0 });
  });

  it("maps single assumption impact for recurring income", () => {
    const scenario = buildScenario({
      events: [incomeEvent("income-1")],
    });

    const result = analyzeAssumptionImpact(scenario, { salaryGrowthRate: 6 });

    expect(result.byAssumptionKey.salaryGrowthRate).toEqual({
      eventIds: ["income-1"],
      count: 1,
    });
    expect(result.byEventId["income-1"]).toEqual(["salaryGrowthRate"]);
    expect(result.summary).toEqual({
      totalImpactedEventCount: 1,
      distribution: { income: 1, expense: 0, housing: 0 },
    });
  });

  it("supports multi-assumption and multi-entity impact", () => {
    const scenario = buildScenario({
      events: [incomeEvent("income-1"), expenseEvent("expense-1"), housingRentEvent("housing-1")],
      assets: [
        { id: "asset-home", kind: "home" },
        { id: "asset-cash", kind: "cash" },
        { id: "asset-car", kind: "car" },
      ],
    });

    const result = analyzeAssumptionImpact(scenario, {
      salaryGrowthRate: 5,
      inflationRate: 4,
      rentAnnualGrowthPct: 3,
      propertyAppreciationPct: 2,
      cashYieldPct: 1.2,
      carDepreciationRatePct: 20,
    });

    expect(result.byAssumptionKey.salaryGrowthRate?.eventIds).toEqual(["income-1"]);
    expect(result.byAssumptionKey.inflationRate?.eventIds).toEqual(["expense-1"]);
    expect(result.byAssumptionKey.rentAnnualGrowthPct?.eventIds).toEqual(["housing-1"]);
    expect(result.byAssumptionKey.propertyAppreciationPct?.eventIds).toEqual(["asset-home"]);
    expect(result.byAssumptionKey.cashYieldPct?.eventIds).toEqual(["asset-cash"]);
    expect(result.byAssumptionKey.carDepreciationRatePct?.eventIds).toEqual(["asset-car"]);
    expect(result.byEventId["income-1"]).toEqual(["salaryGrowthRate"]);
    expect(result.byEventId["asset-home"]).toEqual(["propertyAppreciationPct"]);
    expect(result.summary).toEqual({
      totalImpactedEventCount: 6,
      distribution: { income: 1, expense: 1, housing: 1 },
    });
  });

  it("does not count oneOff cashflow events as growth-affected", () => {
    const oneOffExpense: ScenarioEvent = {
      id: "expense-oneoff",
      type: "cashflow",
      kind: "expense",
      cadence: "oneOff",
      amount: 5000,
      occurrenceMonth: "2025-06",
      growthMode: "assumption",
    };

    const scenario = buildScenario({ events: [oneOffExpense] });
    const result = analyzeAssumptionImpact(scenario, { inflationRate: 4 });

    expect(result.byAssumptionKey.inflationRate).toBeUndefined();
    expect(result.byEventId).toEqual({});
    expect(result.summary.totalImpactedEventCount).toBe(0);
  });


  it("produces different cashBalance and netWorth curves when cashYieldPct changes", () => {
    const scenarioLowYield = buildEngineScenario(0);
    const scenarioHighYield = buildEngineScenario(12);

    const lowProjection = computeProjection(mapScenarioToEngineInput(scenarioLowYield, []).input);
    const highProjection = computeProjection(mapScenarioToEngineInput(scenarioHighYield, []).input);

    expect(highProjection.cashBalance[11] > lowProjection.cashBalance[11]).toBe(true);
    expect(highProjection.netWorth[11] > lowProjection.netWorth[11]).toBe(true);
    expect((highProjection.breakdown?.cashflow.byKey["cash:yield"]?.[0] ?? 0) > 0).toBe(true);
    expect(lowProjection.breakdown?.cashflow.byKey["cash:yield"]).toBeUndefined();
  });

});
