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

  it("compiles housing, loan, and insurance events", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      events: [
        {
          id: "evt-housing-rent",
          type: "housing",
          kind: "rent",
          startMonth: "2024-01",
          endMonth: "2024-03",
          rentMonthly: 1200,
        },
        {
          id: "evt-housing-mortgage",
          type: "housing",
          kind: "mortgage",
          startMonth: "2024-01",
          purchasePrice: 100000,
          downPaymentMode: "percent",
          downPaymentPercent: 20,
          mortgageRatePct: 0,
          mortgageTermYears: 1,
          propertyAssetId: "asset-home-1",
          mortgageLiabilityId: "liability-mortgage-1",
          feesOneOff: [
            { id: "fee-1", label: "Closing", amount: 1000, month: "2024-02" },
          ],
          ongoingCosts: [
            {
              id: "cost-1",
              label: "Maintenance",
              amount: 200,
              startMonth: "2024-03",
            },
          ],
          rental: {
            enabled: true,
            rentMonthly: 500,
            startMonth: "2024-04",
          },
        },
        {
          id: "evt-loan",
          type: "loan",
          loanKind: "personal",
          startMonth: "2024-01",
          principal: 1200,
          annualInterestRatePct: 0,
          termYears: 1,
          liabilityId: "liability-loan-1",
        },
        {
          id: "evt-insurance-quick",
          type: "insurance",
          mode: "quick",
          startMonth: "2024-01",
          endMonth: "2024-02",
          premiumMonthly: 100,
        },
        {
          id: "evt-insurance-detailed",
          type: "insurance",
          mode: "detailed",
          policies: [
            {
              id: "policy-1",
              name: "Savings",
              kind: "savings",
              startMonth: "2024-01",
              premiumMonthly: 200,
              policyId: "policy-id-1",
              policyAssetId: "asset-policy-1",
            },
          ],
        },
      ],
    };

    const ledger = compileScenarioV2ToLedger(scenario);

    expect(ledger.every((row) => row.sourceEventId)).toBe(true);
    expect(
      ledger.some(
        (row) =>
          row.sourceEventId === "evt-housing-rent" &&
          row.month === "2024-01" &&
          row.amount === -1200
      )
    ).toBe(true);
    expect(
      ledger.some(
        (row) =>
          row.sourceEventId === "evt-housing-mortgage" &&
          row.month === "2024-02" &&
          row.amount === -1000
      )
    ).toBe(true);
    expect(
      ledger.some(
        (row) =>
          row.sourceEventId === "evt-housing-mortgage" &&
          row.month === "2024-03" &&
          row.amount === -200
      )
    ).toBe(true);
    expect(
      ledger.some(
        (row) =>
          row.sourceEventId === "evt-housing-mortgage" &&
          row.month === "2024-04" &&
          row.amount === 500
      )
    ).toBe(true);
    expect(
      ledger.some(
        (row) =>
          row.sourceEventId === "evt-loan" &&
          row.linkedLiabilityId === "liability-loan-1"
      )
    ).toBe(true);
    expect(
      ledger.some(
        (row) =>
          row.sourceEventId === "evt-housing-mortgage" &&
          row.linkedLiabilityId === "liability-mortgage-1"
      )
    ).toBe(true);
    expect(
      ledger.some(
        (row) =>
          row.sourceEventId === "evt-insurance-quick" &&
          row.month === "2024-01" &&
          row.amount === -100
      )
    ).toBe(true);
    expect(
      ledger.some(
        (row) =>
          row.sourceEventId === "evt-insurance-detailed" &&
          row.month === "2024-01" &&
          row.amount === -200
      )
    ).toBe(true);
  });
});
