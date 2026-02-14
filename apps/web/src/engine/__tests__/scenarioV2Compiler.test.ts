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


  it("expands annual travel budget meta months into split monthly ledger rows", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        inflationRate: 10,
      },
      events: [
        {
          id: "evt-travel-budget",
          type: "cashflow",
          kind: "expense",
          cadence: "yearly",
          amount: 1200,
          startMonth: "2024-02",
          endMonth: "2025-07",
          growthMode: "assumption",
          growthSource: "inflation",
          meta: {
            kind: "base",
            budgetKind: "travelBudget",
            occurrenceMonths: ["2024-02", "2024-07"],
            monthOfYear: [2, 7],
          },
        },
      ],
    };

    const ledger = compileScenarioV2ToLedger(scenario).filter(
      (entry) => entry.sourceEventId === "evt-travel-budget"
    );

    expect(ledger.map((entry) => entry.month)).toEqual([
      "2024-02",
      "2024-07",
      "2025-02",
      "2025-07",
    ]);
    expect(ledger.find((entry) => entry.month === "2024-02")?.amount).toBe(-600);
    expect(ledger.find((entry) => entry.month === "2025-02")?.amount).toBe(-660);
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


  it("defaults recurring expense without growthMode to inflation assumption", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        inflationRate: 6,
      },
      events: [
        {
          id: "evt-expense-default-growth",
          type: "cashflow",
          kind: "expense",
          cadence: "monthly",
          amount: 1000,
          startMonth: "2024-01",
          endMonth: "2025-01",
        },
      ],
    };

    const ledger = compileScenarioV2ToLedger(scenario);
    const jan2024 = ledger.find((row) => row.month === "2024-01");
    const jan2025 = ledger.find((row) => row.month === "2025-01");

    expect((jan2025?.amount ?? 0) < (jan2024?.amount ?? 0)).toBe(true);
  });

  it("keeps one-off expenses flat when growthMode is missing", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        inflationRate: 6,
      },
      events: [
        {
          id: "evt-oneoff-default-growth",
          type: "cashflow",
          kind: "expense",
          cadence: "oneOff",
          amount: 1000,
          occurrenceMonth: "2024-06",
        },
      ],
    };

    const ledger = compileScenarioV2ToLedger(scenario).filter(
      (row) => row.sourceEventId === "evt-oneoff-default-growth"
    );

    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.amount).toBe(-1000);
  });

  it("defaults housing rent growthMode to assumption when missing", () => {
    const scenario: ScenarioV2 = {
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        rentAnnualGrowthPct: 5,
      },
      events: [
        {
          id: "evt-rent-default-growth",
          type: "housing",
          kind: "rent",
          startMonth: "2024-01",
          endMonth: "2025-01",
          rentMonthly: 1000,
        },
      ],
    };

    const ledger = compileScenarioV2ToLedger(scenario).filter(
      (row) => row.sourceEventId === "evt-rent-default-growth"
    );
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

  it("applies default growth to unflagged recurring expense while keeping car assets unchanged", () => {
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
    expect((jan2025?.amount ?? 0) < (jan2024?.amount ?? 0)).toBe(true);

    const input = compileScenarioV2ToProjectionInput(scenario);
    const projection = computeProjection(input);
    expect(projection.assets.cars[0] ?? 0).toBe(0);
    expect(projection.assets.cars[12] ?? 0).toBe(0);
  });

});

describe("income series merge", () => {
  const createScenario = (events: CashflowEvent[]): ScenarioV2 => ({
    ...baseScenario,
    assumptions: {
      ...baseScenario.assumptions,
      baseMonth: "2026-01",
      horizonMonths: 120,
      salaryGrowthRate: 3,
    },
    events,
  });

  it("keeps base series when no adjustments", () => {
    const ledger = compileScenarioV2ToLedger(
      createScenario([
        {
          id: "salary-base",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 67000,
          startMonth: "2026-02",
          growthMode: "none",
        },
      ])
    );
    expect(ledger.some((row) => row.sourceEventId === "salary-base" && row.month === "2028-02")).toBe(true);
  });

  it("splits multiple adjustments into non-overlapping segments", () => {
    const ledger = compileScenarioV2ToLedger(
      createScenario([
        {
          id: "salary-base",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 67000,
          startMonth: "2026-02",
          growthMode: "none",
          seriesId: "salary-base",
          meta: { kind: "base" },
        },
        {
          id: "salary-adj-1",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 80000,
          startMonth: "2028-02",
          growthMode: "none",
          seriesId: "salary-base",
          parentEventId: "salary-base",
          meta: { kind: "adjustment", adjustsEventId: "salary-base" },
        },
        {
          id: "salary-adj-2",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 100000,
          startMonth: "2030-02",
          growthMode: "none",
          seriesId: "salary-base",
          parentEventId: "salary-base",
          meta: { kind: "adjustment", adjustsEventId: "salary-base" },
        },
      ])
    );

    const m202801 = ledger.filter((row) => row.month === "2028-01" && row.kind === "income");
    const m202802 = ledger.filter((row) => row.month === "2028-02" && row.kind === "income");
    const m203002 = ledger.filter((row) => row.month === "2030-02" && row.kind === "income");
    expect(m202801).toHaveLength(1);
    expect(Math.abs(m202801[0]?.amount ?? 0)).toBe(67000);
    expect(m202802).toHaveLength(1);
    expect(Math.abs(m202802[0]?.amount ?? 0)).toBe(80000);
    expect(m203002).toHaveLength(1);
    expect(Math.abs(m203002[0]?.amount ?? 0)).toBe(100000);
  });

  it("respects base endMonth when segmenting", () => {
    const ledger = compileScenarioV2ToLedger(
      createScenario([
        {
          id: "salary-base",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 67000,
          startMonth: "2026-02",
          endMonth: "2028-12",
          seriesId: "salary-base",
        },
        {
          id: "salary-adj-1",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 80000,
          startMonth: "2028-02",
          seriesId: "salary-base",
          parentEventId: "salary-base",
        },
      ])
    );
    expect(ledger.some((row) => row.month === "2029-01" && row.sourceEventId === "salary-adj-1")).toBe(false);
  });

  it("respects explicit adjustment endMonth", () => {
    const ledger = compileScenarioV2ToLedger(
      createScenario([
        {
          id: "salary-base",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 67000,
          startMonth: "2026-02",
          seriesId: "salary-base",
        },
        {
          id: "salary-adj-1",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 80000,
          startMonth: "2028-02",
          endMonth: "2028-05",
          seriesId: "salary-base",
          parentEventId: "salary-base",
        },
      ])
    );
    expect(ledger.some((row) => row.month === "2028-06" && row.sourceEventId === "salary-adj-1")).toBe(false);
  });

  it("inherits growth from base by default", () => {
    const ledger = compileScenarioV2ToLedger(
      createScenario([
        {
          id: "salary-base",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 67000,
          startMonth: "2026-02",
          growthMode: "assumption",
          seriesId: "salary-base",
        },
        {
          id: "salary-adj-1",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 80000,
          startMonth: "2028-02",
          seriesId: "salary-base",
          parentEventId: "salary-base",
        },
      ])
    );
    const start = ledger.find((row) => row.sourceEventId === "salary-adj-1" && row.month === "2028-02");
    const later = ledger.find((row) => row.sourceEventId === "salary-adj-1" && row.month === "2029-02");
    expect((later?.amount ?? 0) > (start?.amount ?? 0)).toBe(true);
  });



  it("supports parent-child linkage via metadata parentEventId", () => {
    const ledger = compileScenarioV2ToLedger(
      createScenario([
        {
          id: "salary-base",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 67000,
          startMonth: "2026-02",
          growthMode: "none",
        },
        {
          id: "salary-adj-meta",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 80000,
          startMonth: "2028-02",
          growthMode: "none",
          meta: { parentEventId: "salary-base", relationType: "adjustment", adjustableKey: "salary" },
        },
      ])
    );

    const m202801 = ledger.filter((row) => row.month === "2028-01" && row.kind === "income");
    const m202802 = ledger.filter((row) => row.month === "2028-02" && row.kind === "income");
    expect(m202801).toHaveLength(1);
    expect(Math.abs(m202801[0]?.amount ?? 0)).toBe(67000);
    expect(m202802).toHaveLength(1);
    expect(Math.abs(m202802[0]?.amount ?? 0)).toBe(80000);
  });

  it("supports adjustment growth override", () => {
    const ledger = compileScenarioV2ToLedger(
      createScenario([
        {
          id: "salary-base",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 67000,
          startMonth: "2026-02",
          growthMode: "assumption",
          seriesId: "salary-base",
        },
        {
          id: "salary-adj-1",
          type: "cashflow",
          kind: "income",
          cadence: "monthly",
          amount: 80000,
          startMonth: "2028-02",
          growthMode: "custom",
          customGrowthRatePct: 0,
          seriesId: "salary-base",
          parentEventId: "salary-base",
        },
      ])
    );
    const start = ledger.find((row) => row.sourceEventId === "salary-adj-1" && row.month === "2028-02");
    const later = ledger.find((row) => row.sourceEventId === "salary-adj-1" && row.month === "2029-02");
    expect(Math.abs(later?.amount ?? 0)).toBe(Math.abs(start?.amount ?? 0));
  });
});

describe("generic event segment merge", () => {
  it("avoids double counting for segmented expense cashflow", () => {
    const ledger = compileScenarioV2ToLedger({
      ...baseScenario,
      assumptions: {
        ...baseScenario.assumptions,
        baseMonth: "2026-01",
        horizonMonths: 36,
      },
      events: [
        {
          id: "expense-base",
          baseEventId: "expense-base",
          segmentRole: "parent",
          type: "cashflow",
          kind: "expense",
          cadence: "monthly",
          amount: -10000,
          startMonth: "2026-01",
        },
        {
          id: "expense-child",
          baseEventId: "expense-base",
          segmentRole: "child",
          parentEventId: "expense-base",
          type: "cashflow",
          kind: "expense",
          cadence: "monthly",
          amount: -13000,
          startMonth: "2027-01",
        },
      ],
    });

    const before = ledger.filter((row) => row.month === "2026-12" && row.kind === "expense");
    const after = ledger.filter((row) => row.month === "2027-01" && row.kind === "expense");

    expect(before).toHaveLength(1);
    expect(Math.abs(before[0]?.amount ?? 0)).toBe(10000);
    expect(after).toHaveLength(1);
    expect(Math.abs(after[0]?.amount ?? 0)).toBe(13000);
  });
});
