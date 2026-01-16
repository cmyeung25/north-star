import { describe, expect, it } from "vitest";
import type { ProjectionResult } from "@north-star/engine";
import { applyStressPreset } from "../stressTransforms";
import { computeStressDeltas } from "../useStressComparison";
import type { Scenario } from "../../store/scenarioStore";
import type { EventDefinition } from "../../domain/events/types";
import { resolveEventRule } from "../../domain/events/utils";

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

const buildProjection = (overrides: Partial<ProjectionResult> = {}): ProjectionResult =>
  ({
    baseMonth: "2025-01",
    months: ["2025-01", "2025-02", "2025-03"],
    netCashflow: [0, 0, 0],
    cashBalance: [100, 80, 60],
    assets: {
      housing: [0, 0, 0],
      investments: [0, 0, 0],
      insurance: [0, 0, 0],
      total: [0, 0, 0],
    },
    liabilities: { mortgage: [0, 0, 0], total: [0, 0, 0] },
    netWorth: [1000, 900, 800],
    lowestMonthlyBalance: { value: 60, index: 2, month: "2025-03" },
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Low",
    ...overrides,
  }) satisfies ProjectionResult;

describe("applyStressPreset", () => {
  it("raises mortgage rates by 2% and clamps to 100", () => {
    const scenario = buildScenario({
      positions: {
        homes: [
          {
            id: "home-1",
            purchasePrice: 1000000,
            downPayment: 200000,
            purchaseMonth: "2026-03",
            annualAppreciationPct: 2,
            mortgageRatePct: 99,
            mortgageTermYears: 25,
          },
        ],
      },
    });

    const stressed = applyStressPreset(scenario, [], "RATE_HIKE_2");

    expect(stressed.positions?.homes?.[0]?.mortgageRatePct).toBe(100);
  });

  it("reduces income events by 20% starting from the shock month", () => {
    const scenario = buildScenario({
      eventRefs: [
        { refId: "event-early-income", enabled: true },
        { refId: "event-income", enabled: true },
      ],
    });

    const eventLibrary: EventDefinition[] = [
      {
        id: "event-early-income",
        title: "Side income",
        type: "salary",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2026-02",
          endMonth: null,
          monthlyAmount: 10000,
          oneTimeAmount: 0,
          annualGrowthPct: 0,
        },
        currency: "USD",
      },
      {
        id: "event-income",
        title: "Salary",
        type: "salary",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2026-03",
          endMonth: null,
          monthlyAmount: 10000,
          oneTimeAmount: 0,
          annualGrowthPct: 0,
        },
        currency: "USD",
      },
    ];

    const stressed = applyStressPreset(scenario, eventLibrary, "INCOME_DROP_20", {
      shockMonth: "2026-03",
    });

    const earlyRef = stressed.eventRefs?.[0];
    const laterRef = stressed.eventRefs?.[1];
    if (!earlyRef || !laterRef) {
      throw new Error("Expected stress refs to be present.");
    }

    const earlyRule = resolveEventRule(eventLibrary[0], earlyRef);
    const laterRule = resolveEventRule(eventLibrary[1], laterRef);

    expect(earlyRule.monthlyAmount).toBe(10000);
    expect(laterRule.monthlyAmount).toBe(8000);
  });
});

describe("computeStressDeltas", () => {
  it("computes horizon net worth/cash deltas and breakeven months", () => {
    const baseline = buildProjection({
      cashBalance: [100, 90, 80],
      netWorth: [1000, 950, 900],
    });
    const stressed = buildProjection({
      cashBalance: [95, 85, 70],
      netWorth: [900, 960, 920],
    });

    const deltas = computeStressDeltas(baseline, stressed);

    expect(deltas).toMatchObject({
      netWorthDeltaAtHorizon: 20,
      cashDeltaAtHorizon: -10,
      breakevenDeltaMonths: 1,
      breakevenMonth: "2025-02",
    });
  });
});
