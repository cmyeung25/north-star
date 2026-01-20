import { describe, expect, it } from "vitest";
import { computeProjection } from "@north-star/engine";
import type { Scenario } from "../../store/scenarioStore";
import type { EventDefinition } from "../../domain/events/types";
import { mapScenarioToEngineInput } from "../adapter";
import {
  buildSmartInvestWithdrawalSchedule,
  getSmartInvestAssetKey,
} from "../../domain/smartInvest/solver";

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
    horizonMonths: 3,
    initialCash: 1000,
    baseMonth: "2024-01",
    smartInvest: {
      enabled: true,
      reserve: { mode: "fixed", amount: 500 },
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
    { refId: "income", enabled: true },
    { refId: "expense", enabled: true },
  ],
  ...overrides,
});

const eventLibrary: EventDefinition[] = [
  {
    id: "income",
    title: "Income",
    type: "salary",
    kind: "cashflow",
    rule: {
      mode: "schedule",
      schedule: [{ month: "2024-01", amount: 500 }],
    },
  },
  {
    id: "expense",
    title: "Expense",
    type: "custom",
    kind: "cashflow",
    rule: {
      mode: "schedule",
      schedule: [{ month: "2024-02", amount: 1200 }],
    },
  },
];

describe("smartInvest withdrawals", () => {
  it("increases cash balances when reserve would dip below target", () => {
    const scenario = buildScenario();
    const baseResult = mapScenarioToEngineInput(scenario, eventLibrary, {
      strict: false,
    });
    const baseProjection = computeProjection(baseResult.input);
    const assetsByKey = baseProjection.breakdown?.assets.assetsByKey ?? {};

    const withdrawalSchedule = buildSmartInvestWithdrawalSchedule({
      months: baseProjection.months,
      cashBalances: baseProjection.cashBalance,
      reserveTarget: 500,
      allocationBalancesById: {
        core: assetsByKey[getSmartInvestAssetKey("core")] ?? [],
      },
    });

    const withWithdrawals = mapScenarioToEngineInput(scenario, eventLibrary, {
      strict: false,
      smartInvestWithdrawalSchedules: withdrawalSchedule,
    });
    const projectionWithWithdrawals = computeProjection(withWithdrawals.input);

    expect(projectionWithWithdrawals.cashBalance[1]).toBeGreaterThan(
      baseProjection.cashBalance[1]
    );
  });
});
