import { describe, expect, it } from "vitest";
import type { EventDefinition } from "../../domain/events/types";
import type { Scenario } from "../../store/scenarioStore";
import { isValidMonthStr } from "../../utils/month";
import { mapScenarioToEngineInput } from "../adapter";

describe("mapScenarioToEngineInput month normalization", () => {
  it("outputs strict YYYY-MM months in projection input", () => {
    const scenario: Scenario = {
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
        baseMonth: "2024-1",
        horizonMonths: 2,
        initialCash: 0,
      },
      eventRefs: [{ refId: "event-1", enabled: true }],
      positions: {
        loans: [
          {
            id: "loan-1",
            startMonth: "2024-1",
            principal: 1000,
            annualInterestRatePct: 5,
            termYears: 1,
          },
        ],
      },
    };

    const eventLibrary: EventDefinition[] = [
      {
        id: "event-1",
        title: "Income",
        type: "custom",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2024-1",
          endMonth: null,
          monthlyAmount: 100,
          oneTimeAmount: 0,
          annualGrowthPct: 0,
        },
        currency: "USD",
      },
    ];

    const { input } = mapScenarioToEngineInput(scenario, eventLibrary, {
      strict: false,
    });

    expect(input.baseMonth).toBe("2024-01");
    expect(input.positions?.loans?.[0]?.startMonth).toBe("2024-01");
    input.events.forEach((event) => {
      expect(isValidMonthStr(event.startMonth)).toBe(true);
      expect(isValidMonthStr(event.endMonth ?? event.startMonth)).toBe(true);
    });
  });
});
