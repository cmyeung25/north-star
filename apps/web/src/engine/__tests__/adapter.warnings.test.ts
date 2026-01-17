import { describe, expect, it } from "vitest";
import type { EventDefinition } from "../../domain/events/types";
import type { Scenario } from "../../store/scenarioStore";
import { mapScenarioToEngineInput } from "../adapter";

const baseScenario: Scenario = {
  id: "scenario-1",
  name: "Test",
  baseCurrency: "USD",
  updatedAt: 0,
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Low",
  },
  assumptions: {
    baseMonth: "2024-01",
    horizonMonths: 12,
    initialCash: 0,
  },
};

describe("mapScenarioToEngineInput warnings", () => {
  it("skips invalid months for positions and events", () => {
    const scenario: Scenario = {
      ...baseScenario,
      eventRefs: [{ refId: "event-invalid", enabled: true }],
      positions: {
        loans: [
          {
            id: "loan-1",
            startMonth: "2024-13",
            principal: 1000,
            annualInterestRatePct: 5,
            termYears: 1,
          },
        ],
      },
    };

    const eventLibrary: EventDefinition[] = [
      {
        id: "event-invalid",
        title: "Bad Month",
        type: "custom",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2024-13",
          endMonth: null,
          monthlyAmount: 100,
          oneTimeAmount: 0,
          annualGrowthPct: 0,
        },
        currency: "USD",
      },
    ];

    const result = mapScenarioToEngineInput(scenario, eventLibrary, { strict: false });

    expect(result.input.positions?.loans).toHaveLength(0);
    expect(result.warnings.some((warning) => warning.code === "invalid-month")).toBe(
      true
    );
  });

  it("warns on potential double count for loan repayments", () => {
    const scenario: Scenario = {
      ...baseScenario,
      eventRefs: [{ refId: "event-loan", enabled: true }],
      positions: {
        loans: [
          {
            id: "loan-2",
            startMonth: "2024-01",
            principal: 12000,
            annualInterestRatePct: 6,
            termYears: 1,
            monthlyPayment: 1000,
          },
        ],
      },
    };

    const eventLibrary: EventDefinition[] = [
      {
        id: "event-loan",
        title: "Loan repayment",
        type: "custom",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2024-01",
          endMonth: "2024-03",
          monthlyAmount: 1000,
          oneTimeAmount: 0,
          annualGrowthPct: 0,
        },
        currency: "USD",
      },
    ];

    const result = mapScenarioToEngineInput(scenario, eventLibrary, { strict: false });

    expect(result.warnings.some((warning) => warning.code === "double-count")).toBe(
      true
    );
  });
});
