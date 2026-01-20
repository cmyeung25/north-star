import { describe, expect, it } from "vitest";
import type { Scenario } from "../../store/scenarioStore";
import { compileSmartInvest } from "../../domain/smartInvest/compileSmartInvest";

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

describe("smartInvest withdrawals", () => {
  it("maps withdrawal schedules into engine input", () => {
    const scenario = buildScenario();
    const withdrawalSchedule = {
      core: [{ month: "2024-02", amount: 250 }],
    };
    const investments = compileSmartInvest({
      baseMonth: "2024-01",
      horizonMonths: 3,
      scenario,
      policy: scenario.assumptions.smartInvest!,
      baselineCashflows: [{ month: "2024-01", amount: 0 }],
      withdrawalScheduleByAllocation: withdrawalSchedule,
    });
    const mappedWithdrawals = investments[0]?.withdrawalSchedule ?? [];

    expect(mappedWithdrawals.length).toBe(1);
    expect(mappedWithdrawals[0]?.month).toBe("2024-02");
    expect(mappedWithdrawals[0]?.amount).toBe(250);
  });
});
