import { describe, expect, it } from "vitest";
import type { SmartInvestPolicy } from "../types";
import {
  buildReserveTarget,
  buildSmartInvestWithdrawalSchedule,
} from "../solver";

const buildPolicy = (overrides: Partial<SmartInvestPolicy> = {}): SmartInvestPolicy => ({
  enabled: true,
  reserve: { mode: "fixed", amount: 0 },
  contribution: { mode: "percentOfIncome", pct: 10 },
  allocation: [
    { id: "core", name: "Core", targetPct: 100, assumedAnnualReturnPct: 0 },
  ],
  withdrawal: {
    enabled: true,
    mode: "sellToMaintainReserve",
    sellOrder: "proRata",
  },
  ...overrides,
});

describe("smartInvest solver", () => {
  it("builds fixed reserve targets", () => {
    const policy = buildPolicy({ reserve: { mode: "fixed", amount: 12000 } });

    expect(buildReserveTarget(policy, [1000, 2000])).toBe(12000);
  });

  it("builds month-of-outflow reserve targets", () => {
    const policy = buildPolicy({
      reserve: { mode: "monthsOfOutflow", months: 3 },
    });

    expect(buildReserveTarget(policy, [1000, 2000])).toBe(4500);
  });

  it("builds pro-rata withdrawal schedules to cover reserve shortfalls", () => {
    const schedule = buildSmartInvestWithdrawalSchedule({
      months: ["2024-01", "2024-02"],
      cashBalances: [500, 1500],
      reserveTarget: 1000,
      allocationBalancesById: {
        core: [2000, 1800],
        satellite: [1000, 900],
      },
    });

    const monthOneTotal =
      (schedule.core?.[0]?.amount ?? 0) + (schedule.satellite?.[0]?.amount ?? 0);

    expect(schedule.core?.[0]?.month).toBe("2024-01");
    expect(schedule.satellite?.[0]?.month).toBe("2024-01");
    expect(monthOneTotal).toBeCloseTo(500, 4);
    expect(schedule.core?.[0]?.amount ?? 0).toBeCloseTo(333.3333, 3);
    expect(schedule.satellite?.[0]?.amount ?? 0).toBeCloseTo(166.6667, 3);
    expect(schedule.core?.[1]).toBeUndefined();
    expect(schedule.satellite?.[1]).toBeUndefined();
  });
});
