import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../store/scenarioStore";
import { applyPlanLabDraftToScenario } from "../applyPlanLabDraftToScenario";

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
    baseMonth: "2024-01",
  },
  eventRefs: [],
  ...overrides,
});

describe("applyPlanLabDraftToScenario", () => {
  it("replaces existing homes with a plan lab home for buy drafts", () => {
    const scenario = buildScenario({
      positions: {
        homes: [
          {
            id: "home-1",
            purchaseMonth: "2020-01",
            purchasePrice: 5000000,
            downPayment: 1000000,
            annualAppreciationPct: 0,
          },
        ],
      },
    });

    const result = applyPlanLabDraftToScenario(
      scenario,
      {
        housing: {
          kind: "buy",
          purchaseMonth: "2026-06",
          purchasePrice: 8000000,
          downPaymentPct: 25,
        },
      },
      { scenarioId: scenario.id }
    );

    expect(result.errors).toHaveLength(0);
    expect(result.eventDefinitions).toHaveLength(0);
    expect(result.scenario.positions?.homes).toHaveLength(1);
    expect(result.scenario.positions?.homes?.[0]).toMatchObject({
      purchaseMonth: "2026-06",
      purchasePrice: 8000000,
    });
    expect(result.warnings).toEqual([
      {
        code: "replace-homes",
        message: "Plan Lab housing will replace existing home positions.",
      },
    ]);
  });

  it("replaces plan lab events and adds rent/baby definitions", () => {
    const scenario = buildScenario({
      eventRefs: [{ refId: "planLab:scenario-test:rent", enabled: true }],
    });

    const result = applyPlanLabDraftToScenario(
      scenario,
      {
        housing: {
          kind: "rent",
          startMonth: "2025-02",
          monthlyRent: 15000,
        },
        babyPlan: {
          targetMonth: "2026-03",
          monthlyBabyBudget: 3500,
          durationMonths: 12,
          oneOffBabyCost: 12000,
        },
      },
      { scenarioId: scenario.id }
    );

    expect(result.errors).toHaveLength(0);
    expect(result.eventDefinitions).toHaveLength(3);
    expect(result.scenario.eventRefs).toEqual([
      { refId: "planLab:scenario-test:rent", enabled: true },
      { refId: "planLab:scenario-test:baby", enabled: true },
      { refId: "planLab:scenario-test:baby-one-off", enabled: true },
    ]);
  });

  it("returns errors for invalid months", () => {
    const scenario = buildScenario();
    const result = applyPlanLabDraftToScenario(
      scenario,
      {
        housing: {
          kind: "rent",
          startMonth: "2025-99",
          monthlyRent: 12000,
        },
      },
      { scenarioId: scenario.id }
    );

    expect(result.errors).toHaveLength(1);
    expect(result.eventDefinitions).toHaveLength(0);
    expect(result.scenario).toBe(scenario);
  });
});
