import { describe, expect, it } from "vitest";
import type { Scenario } from "../../../store/scenarioStore";
import { compilePlanLabDraft } from "../compilePlanLabDraft";
import type { EventDefinition } from "../../events/types";

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
  it("applies event end-month and disable patches", () => {
    const scenario = buildScenario({
      eventRefs: [{ refId: "event-1", enabled: true }],
    });
    const eventLibrary: EventDefinition[] = [
      {
        id: "event-1",
        title: "Salary",
        type: "salary",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2024-01",
          endMonth: null,
          monthlyAmount: 1000,
          oneTimeAmount: 0,
          annualGrowthPct: 0,
        },
      },
    ];

    const result = compilePlanLabDraft(
      {
        baselinePatches: {
          eventPatches: {
            "event-1": { endMonth: "2025-06", isDisabled: true },
          },
        },
      },
      { baselineScenario: scenario, eventLibrary }
    );

    expect(result.eventRefOverrides).toHaveLength(1);
    expect(result.eventRefOverrides[0]).toMatchObject({
      refId: "event-1",
      enabled: false,
      overrides: { endMonth: "2025-06" },
    });
  });

  it("skips invalid draft member months without throwing", () => {
    const scenario = buildScenario();
    expect(() =>
      compilePlanLabDraft(
        {
          additions: {
            members: [
              {
                id: "member-1",
                name: "Kid",
                kind: "person",
                birthMonth: "2024-99",
              },
            ],
          },
        },
        { baselineScenario: scenario, members: [] }
      )
    ).not.toThrow();
  });
});
