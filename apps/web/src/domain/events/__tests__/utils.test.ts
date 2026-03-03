import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../store/scenarioStore";
import type { EventDefinition } from "../types";
import { buildScenarioEventViews } from "../utils";

const buildBaseScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "scenario-1",
  name: "Scenario",
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

describe("buildScenarioEventViews", () => {
  it("uses scenario cashflow memberId for member grouping", () => {
    const eventLibrary: EventDefinition[] = [
      {
        id: "event-salary",
        title: "Salary",
        type: "salary",
        kind: "cashflow",
        memberId: undefined,
        currency: "HKD",
        rule: {
          mode: "params",
          startMonth: "2026-01",
          endMonth: null,
          monthlyAmount: 20000,
          oneTimeAmount: 0,
        },
      },
    ];

    const scenario = buildBaseScenario({
      eventRefs: [{ refId: "event-salary", enabled: true }],
      events: [
        {
          id: "event-salary",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 20000,
          startMonth: "2026-01",
          memberId: "member-gary",
        },
      ],
    });

    const [view] = buildScenarioEventViews(scenario, eventLibrary);

    expect(view?.definition.memberId).toBe("member-gary");
  });
});
