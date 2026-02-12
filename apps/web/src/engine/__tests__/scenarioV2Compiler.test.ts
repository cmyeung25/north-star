import { describe, expect, it } from "vitest";
import { computeProjection } from "@north-star/engine";
import {
  compileScenarioV2ToLedger,
  compileScenarioV2ToProjectionInput,
  type ScenarioV2,
} from "../scenarioV2Compiler";
import type { CashflowEvent } from "../../domain/scenarioV2/events";

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

  it("applies income growth assumptions to recurring income", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        salaryGrowthRate: 3,
      },
      events: [
        {
          id: "evt-income-growth",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 30000,
          startMonth: "2024-01",
          endMonth: "2025-01",
          growthMode: "assumption",
        },
      ],
    };

    const ledger = compileScenarioV2ToLedger(scenario);
    const january = ledger.find(
      (entry) => entry.sourceEventId === "evt-income-growth" && entry.month === "2024-01"
    );
    const nextJanuary = ledger.find(
      (entry) => entry.sourceEventId === "evt-income-growth" && entry.month === "2025-01"
    );

    expect(january?.amount !== undefined).toBe(true);
    expect(nextJanuary?.amount !== undefined).toBe(true);
    expect((nextJanuary?.amount ?? 0) > (january?.amount ?? 0)).toBe(true);
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

  it("builds projection input that reflects cashflow events", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        baseMonth: "2024-01",
        horizonMonths: 6,
        initialCash: 100000,
      },
      events: [
        {
          id: "evt-income",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 20000,
          startMonth: "2024-01",
        },
        {
          id: "evt-expense",
          type: "cashflow",
          kind: "expense",
          cadence: "monthly",
          amount: 15000,
          startMonth: "2024-01",
        },
      ],
    };

    const input = compileScenarioV2ToProjectionInput(scenario);
    const projection = computeProjection(input);

    expect(projection.cashBalance.slice(0, 3)).toEqual([105000, 110000, 115000]);
  });

  it("uses mortgage base value for mortgage principal and market value for assets", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        baseMonth: "2024-01",
        horizonMonths: 6,
      },
      events: [
        {
          id: "evt-housing-mortgage",
          type: "housing",
          kind: "mortgage",
          startMonth: "2024-01",
          purchasePrice: 100000,
          propertyMarketValue: 100000,
          mortgageBaseValue: 120000,
          mortgageBaseMode: "CUSTOM",
          downPaymentMode: "percent",
          downPaymentPercent: 20,
          mortgageRatePct: 0,
          mortgageTermYears: 1,
          propertyAssetId: "asset-home-1",
          mortgageLiabilityId: "liability-mortgage-1",
        },
      ],
    };

    const input = compileScenarioV2ToProjectionInput(scenario);
    const home = input.positions?.homes?.[0];

    expect(home?.purchasePrice).toBe(100000);
    expect(home?.mortgage?.principal).toBe(100000);
  });

  it("produces higher projections when income growth is enabled", () => {
    const scenarioBase: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        horizonMonths: 13,
        salaryGrowthRate: 3,
      },
      events: [
        {
          id: "evt-income",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 30000,
          startMonth: "2024-01",
        },
      ],
    };

    const baseEvent = scenarioBase.events?.[0] as CashflowEvent;
    const scenarioWithGrowth: ScenarioV2 = {
      ...scenarioBase,
      events: [
        {
          ...baseEvent,
          growthMode: "assumption",
        },
      ],
    };

    const scenarioWithoutGrowth: ScenarioV2 = {
      ...scenarioBase,
      events: [
        {
          ...baseEvent,
          growthMode: "none",
        },
      ],
    };

    const inputWithGrowth = compileScenarioV2ToProjectionInput(scenarioWithGrowth);
    const inputWithoutGrowth = compileScenarioV2ToProjectionInput(scenarioWithoutGrowth);
    const projectionWithGrowth = computeProjection(inputWithGrowth);
    const projectionWithoutGrowth = computeProjection(inputWithoutGrowth);

    expect(
      (projectionWithGrowth.cashBalance.at(-1) ?? 0) >
        (projectionWithoutGrowth.cashBalance.at(-1) ?? 0)
    ).toBe(true);
  });

  it("applies inflation growth for recurring expenses marked with assumption source", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        inflationRate: 6,
      },
      events: [
        {
          id: "evt-expense-inflation",
          type: "cashflow",
          kind: "expense",
          cadence: "monthly",
          amount: 1000,
          startMonth: "2024-01",
          endMonth: "2025-01",
          growthSource: "inflation",
        },
      ],
    };

    const ledger = compileScenarioV2ToLedger(scenario);
    const jan2024 = ledger.find((row) => row.month === "2024-01");
    const jan2025 = ledger.find((row) => row.month === "2025-01");

    expect((jan2025?.amount ?? 0) < (jan2024?.amount ?? 0)).toBe(true);
  });

  it("applies rent growth for housing rent events marked with assumption", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        rentAnnualGrowthPct: 5,
      },
      events: [
        {
          id: "evt-rent-growth",
          type: "housing",
          kind: "rent",
          startMonth: "2024-01",
          endMonth: "2025-01",
          rentMonthly: 1000,
          rentGrowthMode: "assumption",
        },
      ],
    };

    const ledger = compileScenarioV2ToLedger(scenario).filter(
      (row) => row.sourceEventId === "evt-rent-growth"
    );
    const jan2024 = ledger.find((row) => row.month === "2024-01");
    const jan2025 = ledger.find((row) => row.month === "2025-01");

    expect((jan2025?.amount ?? 0) < (jan2024?.amount ?? 0)).toBe(true);
  });

  it("applies custom growth for rental income under mortgage housing events", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        rentAnnualGrowthPct: 8,
      },
      events: [
        {
          id: "evt-mortgage-rental-growth",
          type: "housing",
          kind: "mortgage",
          startMonth: "2024-01",
          endMonth: "2025-01",
          purchasePrice: 1000000,
          mortgageRatePct: 3,
          mortgageTermYears: 30,
          propertyAssetId: "asset-home-growth",
          mortgageLiabilityId: "liability-home-growth",
          rental: {
            enabled: true,
            rentMonthly: 10000,
            startMonth: "2024-01",
            rentGrowthMode: "custom",
            rentAnnualGrowthPct: -10,
          },
        },
      ],
    };

    const ledger = compileScenarioV2ToLedger(scenario).filter(
      (row) => row.sourceEventId === "evt-mortgage-rental-growth" && row.kind === "income"
    );
    const jan2024 = ledger.find((row) => row.month === "2024-01");
    const jan2025 = ledger.find((row) => row.month === "2025-01");

    expect((jan2025?.amount ?? 0) < (jan2024?.amount ?? 0)).toBe(true);
  });

  it("uses property growth mode when compiling mortgage housing positions", () => {
    const baseMortgageEvent = {
      id: "evt-home-growth-mode",
      type: "housing" as const,
      kind: "mortgage" as const,
      startMonth: "2024-01",
      endMonth: "2025-01",
      purchasePrice: 1000000,
      mortgageRatePct: 3,
      mortgageTermYears: 30,
      propertyAssetId: "asset-home-growth-mode",
      mortgageLiabilityId: "liability-home-growth-mode",
    };

    const scenarioAssumption: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        propertyAppreciationPct: 7,
      },
      events: [
        {
          ...baseMortgageEvent,
          propertyGrowthMode: "assumption",
        },
      ],
    };

    const scenarioCustom: ScenarioV2 = {
      ...scenarioAssumption,
      events: [
        {
          ...baseMortgageEvent,
          propertyGrowthMode: "custom",
          propertyAnnualGrowthPct: -3,
        },
      ],
    };

    const projectionAssumption = computeProjection(
      compileScenarioV2ToProjectionInput(scenarioAssumption)
    );
    const projectionCustom = computeProjection(
      compileScenarioV2ToProjectionInput(scenarioCustom)
    );

    expect((projectionAssumption.assets.housing.at(-1) ?? 0) > 1000000).toBe(true);
    expect((projectionCustom.assets.housing.at(-1) ?? 0) < 1000000).toBe(true);
  });

  it("applies car depreciation from assumptions when car asset is flagged", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        horizonMonths: 13,
        carDepreciationRatePct: 10,
      },
      assets: [
        {
          id: "asset-car-1",
          kind: "car",
          currentValue: 100000,
          startMonth: "2024-01",
          depreciationSource: "carDepreciation",
        },
      ],
      events: [],
    };

    const input = compileScenarioV2ToProjectionInput(scenario);
    const projection = computeProjection(input);

    expect((projection.assets.cars[12] ?? 0) < (projection.assets.cars[0] ?? 0)).toBe(true);
  });

  it("keeps unflagged recurring expense and car assets unchanged", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        horizonMonths: 13,
        inflationRate: 6,
        carDepreciationRatePct: 10,
      },
      assets: [
        {
          id: "asset-car-unflagged",
          kind: "car",
          currentValue: 100000,
          startMonth: "2024-01",
        },
      ],
      events: [
        {
          id: "evt-expense-plain",
          type: "cashflow",
          kind: "expense",
          cadence: "monthly",
          amount: 1000,
          startMonth: "2024-01",
          endMonth: "2025-01",
        },
      ],
    };

    const ledger = compileScenarioV2ToLedger(scenario).filter(
      (row) => row.sourceEventId === "evt-expense-plain"
    );
    const jan2024 = ledger.find((row) => row.month === "2024-01");
    const jan2025 = ledger.find((row) => row.month === "2025-01");
    expect(jan2024?.amount).toBe(jan2025?.amount);

    const input = compileScenarioV2ToProjectionInput(scenario);
    const projection = computeProjection(input);
    expect(projection.assets.cars[0] ?? 0).toBe(0);
    expect(projection.assets.cars[12] ?? 0).toBe(0);
  });

});
