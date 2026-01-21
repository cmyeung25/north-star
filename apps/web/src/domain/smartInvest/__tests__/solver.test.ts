import { describe, expect, it } from "vitest";
import type { SmartInvestPolicy } from "../types";
import {
  compileAllocationWeightsByMonth,
  computeReserveTargetByMonth,
  solveExcessCashTransferPlan,
  solveRebalanceSchedule,
  solveWithdrawalsToMaintainReserve,
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

    expect(computeReserveTargetByMonth(policy.reserve, [1000, 2000])).toEqual([
      12000,
      12000,
    ]);
  });

  it("builds month-of-outflow reserve targets", () => {
    const policy = buildPolicy({
      reserve: { mode: "monthsOfOutflow", months: 3 },
    });

    expect(computeReserveTargetByMonth(policy.reserve, [1000, 2000])).toEqual([
      3000,
      6000,
    ]);
  });

  it("compiles allocation weights across profiles", () => {
    const weights = compileAllocationWeightsByMonth(
      [
        {
          id: "profile-1",
          name: "Profile 1",
          startMonth: "2024-01",
          allocation: [
            { id: "core", name: "Core", targetPct: 70, assumedAnnualReturnPct: 5 },
            {
              id: "sat",
              name: "Satellite",
              targetPct: 30,
              assumedAnnualReturnPct: 7,
            },
          ],
        },
        {
          id: "profile-2",
          name: "Profile 2",
          startMonth: "2024-03",
          allocation: [
            { id: "core", name: "Core", targetPct: 50, assumedAnnualReturnPct: 5 },
            {
              id: "sat",
              name: "Satellite",
              targetPct: 50,
              assumedAnnualReturnPct: 7,
            },
          ],
        },
      ],
      "2024-01",
      4
    );

    expect(weights.weightsById.core).toEqual([0.7, 0.7, 0.5, 0.5]);
    expect(weights.weightsById.sat).toEqual([0.3, 0.3, 0.5, 0.5]);
  });

  it("builds pro-rata withdrawal schedules to cover reserve shortfalls", () => {
    const result = solveWithdrawalsToMaintainReserve({
      months: ["2024-01", "2024-02"],
      cashBalances: [500, 1500],
      reserveTargets: [1000, 1000],
      allocationBalancesById: {
        core: [2000, 1800],
        satellite: [1000, 900],
      },
    });

    const schedule = result.scheduleByBucketId;
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

  it("clamps withdrawals to available assets", () => {
    const result = solveWithdrawalsToMaintainReserve({
      months: ["2024-01"],
      cashBalances: [0],
      reserveTargets: [1000],
      allocationBalancesById: {
        core: [200],
        satellite: [300],
      },
    });

    const totalWithdrawals = Object.values(result.scheduleByBucketId).flat().reduce(
      (sum, entry) => sum + entry.amount,
      0
    );

    expect(totalWithdrawals).toBeCloseTo(500, 2);
    expect(result.shortfallsByMonth).toEqual([
      { month: "2024-01", shortfall: 1000, available: 500 },
    ]);
  });

  it("builds rebalance schedules that net to zero", () => {
    const schedule = solveRebalanceSchedule({
      months: ["2024-01"],
      allocationBalancesById: {
        core: [80],
        satellite: [20],
      },
      weightsById: {
        core: [0.5],
        satellite: [0.5],
      },
    });

    const contributions = Object.values(schedule.contributionsByBucketId)
      .flat()
      .reduce((sum, entry) => sum + entry.amount, 0);
    const withdrawals = Object.values(schedule.withdrawalsByBucketId)
      .flat()
      .reduce((sum, entry) => sum + entry.amount, 0);

    expect(contributions).toBeCloseTo(withdrawals, 4);
    expect(schedule.contributionsByBucketId.satellite?.[0]?.amount ?? 0).toBeCloseTo(
      30,
      2
    );
    expect(schedule.withdrawalsByBucketId.core?.[0]?.amount ?? 0).toBeCloseTo(30, 2);
  });

  it("invests excess cash above reserve with threshold and pct", () => {
    const plan = solveExcessCashTransferPlan({
      months: ["2024-01"],
      cashBalances: [2000],
      reserveTargets: [1000],
      allocationBalancesById: {
        core: [500],
        satellite: [500],
      },
      weightsById: {
        core: [0.6],
        satellite: [0.4],
      },
      investPct: 50,
      thresholdAmount: 200,
      allowWithdrawals: true,
      allowContributions: true,
    });

    const totalContributions = Object.values(plan.contributionScheduleByBucketId)
      .flat()
      .reduce((sum, entry) => sum + entry.amount, 0);

    expect(totalContributions).toBeCloseTo(500, 2);
    expect(plan.contributionScheduleByBucketId.core?.[0]?.amount ?? 0).toBeCloseTo(
      300,
      2
    );
    expect(plan.contributionScheduleByBucketId.satellite?.[0]?.amount ?? 0).toBeCloseTo(
      200,
      2
    );
  });

  it("skips transfers when cash is within the reserve band", () => {
    const plan = solveExcessCashTransferPlan({
      months: ["2024-01"],
      cashBalances: [1050],
      reserveTargets: [1000],
      allocationBalancesById: {
        core: [500],
      },
      weightsById: {
        core: [1],
      },
      investPct: 100,
      thresholdAmount: 100,
      allowWithdrawals: true,
      allowContributions: true,
    });

    expect(Object.values(plan.contributionScheduleByBucketId).flat().length).toBe(0);
    expect(Object.values(plan.withdrawalScheduleByBucketId).flat().length).toBe(0);
  });

  it("withdraws up to available assets and reports shortfalls", () => {
    const plan = solveExcessCashTransferPlan({
      months: ["2024-01"],
      cashBalances: [0],
      reserveTargets: [1000],
      allocationBalancesById: {
        core: [200],
        satellite: [100],
      },
      weightsById: {
        core: [0.5],
        satellite: [0.5],
      },
      investPct: 100,
      thresholdAmount: 0,
      allowWithdrawals: true,
      allowContributions: true,
    });

    const totalWithdrawals = Object.values(plan.withdrawalScheduleByBucketId)
      .flat()
      .reduce((sum, entry) => sum + entry.amount, 0);

    expect(totalWithdrawals).toBeCloseTo(300, 2);
    expect(plan.shortfallsByMonth).toEqual([
      { month: "2024-01", shortfall: 1000, available: 300 },
    ]);
  });
});
