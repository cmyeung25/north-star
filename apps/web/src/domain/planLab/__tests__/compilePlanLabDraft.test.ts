import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../store/scenarioStore";
import { compilePlanLabDraft } from "../compilePlanLabDraft";

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

describe("compilePlanLabDraft", () => {
  it("warns and skips invalid months", () => {
    const result = compilePlanLabDraft({
      housing: {
        kind: "rent",
        startMonth: "2024-13",
        monthlyRent: 12000,
      },
      babyPlan: {
        targetMonth: "2025-99",
        monthlyBabyBudget: 3000,
        durationMonths: 6,
      },
    });

    expect(result.warnings).toHaveLength(2);
    expect(result.eventDefinitions).toHaveLength(0);
    expect(result.eventRefs).toHaveLength(0);
  });

  it("injects buy draft as a home position without events", () => {
    const scenario = buildScenario({
      assumptions: {
        horizonMonths: 240,
        initialCash: 0,
        baseMonth: null,
        mortgageRatePct: 3.5,
        mortgageTermYears: 25,
      },
    });
    const result = compilePlanLabDraft(
      {
        housing: {
          kind: "buy",
          purchaseMonth: "2026-06",
          purchasePrice: 8000000,
          downPaymentPct: 25,
          oneTimeFees: 50000,
        },
      },
      { baselineScenario: scenario }
    );

    expect(result.eventDefinitions).toHaveLength(0);
    expect(result.eventRefs).toHaveLength(0);
    expect(result.positions.homes).toHaveLength(1);
    expect(result.positions.homes?.[0]).toMatchObject({
      id: "plan-lab-home",
      purchaseMonth: "2026-06",
      purchasePrice: 8000000,
    });
  });
});
