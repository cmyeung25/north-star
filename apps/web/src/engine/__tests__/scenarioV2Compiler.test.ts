import { describe, expect, it } from "vitest";
import { compileScenarioV2ToLedger, type ScenarioV2 } from "../scenarioV2Compiler";

const baseScenario = {
  id: "scenario-v2",
  name: "Scenario V2",
  baseCurrency: "USD",
  updatedAt: 1700000000000,
  assumptions: {
    baseMonth: "2024-01",
    horizonMonths: 24,
    initialCash: 0,
  },
};

describe("compileScenarioV2ToLedger", () => {
  it("compiles monthly, oneOff, and yearly cashflows", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      events: [
        {
          id: "evt-monthly",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 1000,
          startMonth: "2024-01",
          endMonth: "2024-03",
        },
        {
          id: "evt-oneoff",
          type: "cashflow",
          kind: "expense",
          cadence: "oneOff",
          amount: 200,
          occurrenceMonth: "2024-02",
        },
        {
          id: "evt-yearly",
          type: "cashflow",
          kind: "income",
          cadence: "yearly",
          amount: 1200,
          startMonth: "2024-01",
          endMonth: "2025-01",
        },
      ],
    };

    const ledger = compileScenarioV2ToLedger(scenario);

    expect(
      ledger.some(
        (entry) =>
          entry.month === "2024-01" &&
          entry.amount === 1000 &&
          entry.sourceEventId === "evt-monthly"
      )
    ).toBe(true);
    expect(
      ledger.some(
        (entry) =>
          entry.month === "2024-02" &&
          entry.amount === -200 &&
          entry.sourceEventId === "evt-oneoff"
      )
    ).toBe(true);
    expect(
      ledger.some(
        (entry) =>
          entry.month === "2025-01" &&
          entry.amount === 1200 &&
          entry.sourceEventId === "evt-yearly"
      )
    ).toBe(true);

    const monthlyEntries = ledger.filter(
      (entry) => entry.sourceEventId === "evt-monthly"
    );
    expect(monthlyEntries).toHaveLength(3);
  });
});
