import { describe, expect, it } from "vitest";
import { computeProjectionWithSmartInvest } from "../useProjectionWithLedger";
import type { Scenario } from "../../store/scenarioStore";
import type { EventDefinition } from "../../domain/events/types";

const buildScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: "scenario-test",
  name: "Test Scenario",
  baseCurrency: "USD",
  updatedAt: 0,
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Low",
  },
  assumptions: {
    horizonMonths: 2,
    initialCash: 0,
    baseMonth: "2024-01",
    smartInvest: {
      enabled: true,
      reserve: { mode: "fixed", amount: 1500 },
      contribution: { mode: "percentOfSurplus", pct: 100 },
      allocation: [
        {
          id: "core",
          name: "Core",
          targetPct: 100,
          assumedAnnualReturnPct: 0,
        },
      ],
      withdrawal: {
        enabled: true,
        mode: "sellToMaintainReserve",
        sellOrder: "proRata",
      },
    },
  },
  eventRefs: [
    { refId: "salary", enabled: true },
    { refId: "rent", enabled: true },
  ],
  ...overrides,
});

const eventLibrary: EventDefinition[] = [
  {
    id: "salary",
    title: "Salary",
    type: "salary",
    kind: "cashflow",
    rule: {
      mode: "params",
      startMonth: "2024-01",
      endMonth: "2024-01",
      monthlyAmount: 3000,
      oneTimeAmount: 0,
      annualGrowthPct: 0,
    },
    currency: "USD",
  },
  {
    id: "rent",
    title: "Rent",
    type: "rent",
    kind: "cashflow",
    rule: {
      mode: "params",
      startMonth: "2024-02",
      endMonth: "2024-02",
      monthlyAmount: 2000,
      oneTimeAmount: 0,
      annualGrowthPct: 0,
    },
    currency: "USD",
  },
];

describe("smartInvest projection integration", () => {
  it("adjusts cash balance when withdrawals are enabled", () => {
    const scenarioWithWithdrawals = buildScenario();
    const scenarioWithoutWithdrawals = buildScenario({
      assumptions: {
        ...scenarioWithWithdrawals.assumptions,
        smartInvest: {
          ...scenarioWithWithdrawals.assumptions.smartInvest!,
          withdrawal: {
            ...scenarioWithWithdrawals.assumptions.smartInvest!.withdrawal,
            enabled: false,
          },
        },
      },
    });

    const {
      projection: withWithdrawals,
      smartInvestWithdrawalSchedule: withdrawalSchedule,
    } = computeProjectionWithSmartInvest(
      scenarioWithWithdrawals,
      eventLibrary
    );
    const { projection: withoutWithdrawals } = computeProjectionWithSmartInvest(
      scenarioWithoutWithdrawals,
      eventLibrary
    );
    const totalWithdrawals = Object.values(withdrawalSchedule).flat().reduce(
      (sum, entry) => sum + entry.amount,
      0
    );

    expect(totalWithdrawals > 0).toBe(true);

    expect(
      withWithdrawals.cashBalance[1] === withoutWithdrawals.cashBalance[1]
    ).toBe(false);
  });

  it("invests excess cash when excess-cash mode is enabled", () => {
    const baseScenario = buildScenario();
    const scenarioWithExcessCash = buildScenario({
      assumptions: {
        ...baseScenario.assumptions,
        initialCash: 0,
        smartInvest: {
          ...baseScenario.assumptions.smartInvest!,
          reserve: { mode: "fixed", amount: 1000 },
          contribution: {
            mode: "excessCash",
            investPct: 100,
            thresholdAmount: 0,
          },
          withdrawal: {
            enabled: false,
            mode: "sellToMaintainReserve",
            sellOrder: "proRata",
          },
        },
      },
    });
    const scenarioWithoutSmartInvest = buildScenario({
      assumptions: {
        ...baseScenario.assumptions,
        initialCash: 0,
        smartInvest: {
          ...baseScenario.assumptions.smartInvest!,
          enabled: false,
        },
      },
    });

    const { projection: withExcessCash } = computeProjectionWithSmartInvest(
      scenarioWithExcessCash,
      eventLibrary
    );
    const { projection: withoutSmartInvest } = computeProjectionWithSmartInvest(
      scenarioWithoutSmartInvest,
      eventLibrary
    );

    expect(withExcessCash.cashBalance[0]).not.toEqual(
      withoutSmartInvest.cashBalance[0]
    );
    expect(withExcessCash.cashBalance[0] < withoutSmartInvest.cashBalance[0]).toBe(
      true
    );
  });

  it("maintains reserve by investing surplus and withdrawing on deficits", () => {
    const scenario = buildScenario({
      assumptions: {
        horizonMonths: 14,
        initialCash: 100000,
        baseMonth: "2024-01",
        smartInvest: {
          enabled: true,
          reserve: { mode: "fixed", amount: 100000 },
          contribution: {
            mode: "excessCash",
            investPct: 100,
            thresholdAmount: 0,
          },
          allocation: [
            {
              id: "core",
              name: "Core",
              targetPct: 100,
              assumedAnnualReturnPct: 0,
            },
          ],
          withdrawal: {
            enabled: true,
            mode: "sellToMaintainReserve",
            sellOrder: "proRata",
          },
        },
      },
      eventRefs: [
        { refId: "salary-long", enabled: true },
        { refId: "expense-long", enabled: true },
      ],
    });

    const localEventLibrary: EventDefinition[] = [
      {
        id: "salary-long",
        title: "Salary",
        type: "salary",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2024-01",
          endMonth: "2024-12",
          monthlyAmount: 10000,
          oneTimeAmount: 0,
          annualGrowthPct: 0,
        },
        currency: "USD",
      },
      {
        id: "expense-long",
        title: "Expense",
        type: "custom",
        kind: "cashflow",
        rule: {
          mode: "params",
          startMonth: "2024-01",
          endMonth: "2025-02",
          monthlyAmount: 6000,
          oneTimeAmount: 0,
          annualGrowthPct: 0,
        },
        currency: "USD",
      },
    ];

    const { projection } = computeProjectionWithSmartInvest(
      scenario,
      localEventLibrary
    );

    expect(projection.cashBalance[0]).toBeCloseTo(100000, 2);
    expect(projection.cashBalance[11]).toBeCloseTo(100000, 2);
    expect(projection.cashBalance[12]).toBeCloseTo(100000, 2);
  });
});
