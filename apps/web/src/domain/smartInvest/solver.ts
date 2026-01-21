import { addMonths } from "../members/age";
import { normalizeMonthStrict } from "../../utils/month";
import type {
  SmartInvestAllocation,
  SmartInvestAllocationProfile,
  SmartInvestPolicy,
} from "./types";

export type SmartInvestNormalizedAllocation = SmartInvestAllocation & {
  normalizedPct: number;
};

export type SmartInvestWithdrawalSchedule = Record<
  string,
  Array<{ month: string; amount: number }>
>;

export type SmartInvestAllocationWeightsByMonth = {
  months: string[];
  weightsById: Record<string, number[]>;
  allocationMetaById: Record<string, SmartInvestAllocation>;
};

export type SmartInvestContributionSeries = {
  totalByMonth: number[];
  contributionsByBucketId: Record<string, Array<{ month: string; amount: number }>>;
};

export type SmartInvestContributionSchedule = Record<
  string,
  Array<{ month: string; amount: number }>
>;

export type SmartInvestRebalanceSchedule = {
  contributionsByBucketId: Record<string, Array<{ month: string; amount: number }>>;
  withdrawalsByBucketId: Record<string, Array<{ month: string; amount: number }>>;
};

export type SmartInvestWithdrawalSolveResult = {
  scheduleByBucketId: SmartInvestWithdrawalSchedule;
  totalByMonth: number[];
  shortfallsByMonth: Array<{ month: string; shortfall: number; available: number }>;
};

export type SmartInvestExcessCashPlan = {
  contributionScheduleByBucketId: SmartInvestContributionSchedule;
  withdrawalScheduleByBucketId: SmartInvestWithdrawalSchedule;
  contributionTotalsByMonth: number[];
  withdrawalTotalsByMonth: number[];
  shortfallsByMonth: Array<{ month: string; shortfall: number; available: number }>;
};

export const getSmartInvestInvestmentId = (allocationId: string) =>
  `smart-invest-${allocationId}`;

export const getSmartInvestAssetKey = (allocationId: string) =>
  `investment:${getSmartInvestInvestmentId(allocationId)}`;

export const normalizeAllocations = (
  policy: SmartInvestPolicy
): SmartInvestNormalizedAllocation[] => {
  return normalizeAllocationEntries(policy.allocation);
};

export const normalizeAllocationEntries = (
  allocations: SmartInvestAllocation[]
): SmartInvestNormalizedAllocation[] => {
  const total = allocations.reduce((sum, item) => sum + item.targetPct, 0);
  if (total <= 0) {
    return [];
  }
  return allocations.map((item) => ({
    ...item,
    normalizedPct: item.targetPct / total,
  }));
};

export const compileAllocationWeightsByMonth = (
  profiles: SmartInvestAllocationProfile[],
  baseMonth: string,
  horizonMonths: number
): SmartInvestAllocationWeightsByMonth => {
  if (horizonMonths <= 0) {
    return {
      months: [],
      weightsById: {},
      allocationMetaById: {},
    };
  }

  const months = Array.from({ length: horizonMonths }, (_, index) =>
    addMonths(baseMonth, index)
  );

  const normalizedProfiles = profiles
    .map((profile) => {
      const normalizedMonth = normalizeMonthStrict(profile.startMonth);
      const startMonth = normalizedMonth.ok ? normalizedMonth.month : baseMonth;
      const allocations = normalizeAllocationEntries(profile.allocation);
      return {
        ...profile,
        startMonth,
        allocations,
      };
    })
    .filter((profile) => profile.allocations.length > 0)
    .sort((a, b) => (a.startMonth < b.startMonth ? -1 : 1));

  if (normalizedProfiles.length === 0) {
    return {
      months,
      weightsById: {},
      allocationMetaById: {},
    };
  }

  const allocationMetaById: Record<string, SmartInvestAllocation> = {};
  normalizedProfiles.forEach((profile) => {
    profile.allocations.forEach((allocation) => {
      if (!allocationMetaById[allocation.id]) {
        allocationMetaById[allocation.id] = {
          id: allocation.id,
          name: allocation.name,
          targetPct: allocation.targetPct,
          assumedAnnualReturnPct: allocation.assumedAnnualReturnPct,
        };
      }
    });
  });

  const weightsById: Record<string, number[]> = Object.keys(
    allocationMetaById
  ).reduce<Record<string, number[]>>((acc, id) => {
    acc[id] = Array.from({ length: horizonMonths }, () => 0);
    return acc;
  }, {});

  months.forEach((month, index) => {
    const activeProfile = normalizedProfiles
      .filter((profile) => profile.startMonth <= month)
      .pop();
    if (!activeProfile) {
      return;
    }
    activeProfile.allocations.forEach((allocation) => {
      const weights = weightsById[allocation.id];
      if (!weights) {
        return;
      }
      weights[index] = allocation.normalizedPct;
    });
  });

  return {
    months,
    weightsById,
    allocationMetaById,
  };
};

export const computeReserveTargetByMonth = (
  reservePolicy: SmartInvestPolicy["reserve"],
  monthlyOutflows: number[]
) => {
  if (reservePolicy.mode === "fixed") {
    const amount = Math.max(0, reservePolicy.amount ?? 0);
    return monthlyOutflows.map(() => amount);
  }
  const months = Math.max(0, reservePolicy.months ?? 0);
  return monthlyOutflows.map((outflow) => Math.max(0, months * outflow));
};

const buildContributionTarget = (
  policy: SmartInvestPolicy,
  income: number,
  surplus: number
) => {
  if (policy.contribution.mode === "percentOfIncome") {
    return Math.max(0, (income * (policy.contribution.pct ?? 0)) / 100);
  }
  if (policy.contribution.mode === "percentOfSurplus") {
    return Math.max(0, (surplus * (policy.contribution.pct ?? 0)) / 100);
  }
  return 0;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type ExcessCashTransferParams = {
  months: string[];
  cashBalances: number[];
  reserveTargets: number[];
  allocationBalancesById: Record<string, number[]>;
  weightsById: Record<string, number[]>;
  investPct: number;
  thresholdAmount: number;
  allowWithdrawals: boolean;
  allowContributions: boolean;
};

export const solveExcessCashTransferPlan = ({
  months,
  cashBalances,
  reserveTargets,
  allocationBalancesById,
  weightsById,
  investPct,
  thresholdAmount,
  allowWithdrawals,
  allowContributions,
}: ExcessCashTransferParams): SmartInvestExcessCashPlan => {
  const contributionScheduleByBucketId: SmartInvestContributionSchedule = {};
  const withdrawalScheduleByBucketId: SmartInvestWithdrawalSchedule = {};
  const contributionTotalsByMonth = Array.from({ length: months.length }, () => 0);
  const withdrawalTotalsByMonth = Array.from({ length: months.length }, () => 0);
  const shortfallsByMonth: SmartInvestExcessCashPlan["shortfallsByMonth"] = [];
  const allocationIds = new Set<string>([
    ...Object.keys(allocationBalancesById),
    ...Object.keys(weightsById),
  ]);
  const normalizedInvestPct = clamp(investPct, 0, 100) / 100;
  const normalizedThreshold = Math.max(0, thresholdAmount);

  months.forEach((month, index) => {
    const cashBalance = cashBalances[index] ?? 0;
    const reserveTarget = reserveTargets[index] ?? 0;

    if (cashBalance < reserveTarget) {
      if (!allowWithdrawals) {
        return;
      }
      const shortfall = reserveTarget - cashBalance;
      const allocationBalances = Array.from(allocationIds)
        .map((id) => ({ id, balance: allocationBalancesById[id]?.[index] ?? 0 }))
        .filter((entry) => entry.balance > 0);
      const totalBalance = allocationBalances.reduce(
        (sum, entry) => sum + entry.balance,
        0
      );
      if (shortfall <= 0 || totalBalance <= 0) {
        if (shortfall > 0) {
          shortfallsByMonth.push({ month, shortfall, available: totalBalance });
        }
        return;
      }

      const withdrawalAmount = Math.min(shortfall, totalBalance);
      withdrawalTotalsByMonth[index] = withdrawalAmount;
      allocationBalances.forEach((entry) => {
        const amount = withdrawalAmount * (entry.balance / totalBalance);
        if (amount <= 0) {
          return;
        }
        withdrawalScheduleByBucketId[entry.id] = withdrawalScheduleByBucketId[entry.id] ?? [];
        withdrawalScheduleByBucketId[entry.id].push({ month, amount });
      });

      if (totalBalance < shortfall) {
        shortfallsByMonth.push({ month, shortfall, available: totalBalance });
      }
      return;
    }

    if (!allowContributions) {
      return;
    }

    if (cashBalance <= reserveTarget + normalizedThreshold) {
      return;
    }

    const excess = cashBalance - reserveTarget;
    const investAmount = Math.min(excess, excess * normalizedInvestPct);
    if (investAmount <= 0) {
      return;
    }
    const totalWeight = Array.from(allocationIds).reduce((sum, id) => {
      return sum + (weightsById[id]?.[index] ?? 0);
    }, 0);
    if (totalWeight <= 0) {
      return;
    }
    contributionTotalsByMonth[index] = investAmount;
    allocationIds.forEach((id) => {
      const weight = (weightsById[id]?.[index] ?? 0) / totalWeight;
      const amount = investAmount * weight;
      if (amount <= 0) {
        return;
      }
      contributionScheduleByBucketId[id] = contributionScheduleByBucketId[id] ?? [];
      contributionScheduleByBucketId[id].push({ month, amount });
    });
  });

  return {
    contributionScheduleByBucketId,
    withdrawalScheduleByBucketId,
    contributionTotalsByMonth,
    withdrawalTotalsByMonth,
    shortfallsByMonth,
  };
};

export const compileContributionSeries = (params: {
  policy: SmartInvestPolicy;
  months: string[];
  monthlyTotals: Array<{ income: number; outflow: number; net: number }>;
  reserveTargets: number[];
  weightsById: Record<string, number[]>;
  initialCash: number;
}): SmartInvestContributionSeries => {
  const {
    policy,
    months,
    monthlyTotals,
    reserveTargets,
    weightsById,
    initialCash,
  } = params;
  const contributionsByBucketId: Record<
    string,
    Array<{ month: string; amount: number }>
  > = {};
  const totalByMonth = Array.from({ length: months.length }, () => 0);
  let cashBalance = initialCash;

  months.forEach((month, index) => {
    const totals = monthlyTotals[index] ?? { income: 0, outflow: 0, net: 0 };
    cashBalance += totals.net;
    const reserveTarget = reserveTargets[index] ?? 0;
    if (cashBalance <= reserveTarget) {
      return;
    }
    const target = buildContributionTarget(
      policy,
      totals.income,
      Math.max(0, totals.net)
    );
    if (target <= 0) {
      return;
    }
    const available = Math.max(0, cashBalance - reserveTarget);
    const investAmount = Math.min(available, target);
    if (investAmount <= 0) {
      return;
    }
    totalByMonth[index] = investAmount;
    Object.entries(weightsById).forEach(([id, weights]) => {
      const weight = weights[index] ?? 0;
      if (weight <= 0) {
        return;
      }
      const amount = investAmount * weight;
      if (amount <= 0) {
        return;
      }
      if (!contributionsByBucketId[id]) {
        contributionsByBucketId[id] = [];
      }
      contributionsByBucketId[id].push({ month, amount });
    });
    cashBalance -= investAmount;
  });

  return { totalByMonth, contributionsByBucketId };
};

type RebalanceScheduleParams = {
  months: string[];
  allocationBalancesById: Record<string, number[]>;
  weightsById: Record<string, number[]>;
};

export const solveRebalanceSchedule = ({
  months,
  allocationBalancesById,
  weightsById,
}: RebalanceScheduleParams): SmartInvestRebalanceSchedule => {
  const contributionsByBucketId: SmartInvestRebalanceSchedule["contributionsByBucketId"] =
    {};
  const withdrawalsByBucketId: SmartInvestRebalanceSchedule["withdrawalsByBucketId"] =
    {};
  const allocationIds = new Set<string>([
    ...Object.keys(allocationBalancesById),
    ...Object.keys(weightsById),
  ]);
  const minDelta = 0.01;

  months.forEach((month, index) => {
    const totalValue = Array.from(allocationIds).reduce((sum, id) => {
      const balance = allocationBalancesById[id]?.[index] ?? 0;
      return sum + balance;
    }, 0);
    if (totalValue <= 0) {
      return;
    }

    const totalWeight = Array.from(allocationIds).reduce((sum, id) => {
      return sum + (weightsById[id]?.[index] ?? 0);
    }, 0);
    if (totalWeight <= 0) {
      return;
    }

    allocationIds.forEach((id) => {
      const weight = (weightsById[id]?.[index] ?? 0) / totalWeight;
      const currentValue = allocationBalancesById[id]?.[index] ?? 0;
      const targetValue = totalValue * weight;
      const delta = targetValue - currentValue;
      if (Math.abs(delta) < minDelta) {
        return;
      }
      if (delta > 0) {
        if (!contributionsByBucketId[id]) {
          contributionsByBucketId[id] = [];
        }
        contributionsByBucketId[id].push({ month, amount: delta });
      } else {
        if (!withdrawalsByBucketId[id]) {
          withdrawalsByBucketId[id] = [];
        }
        withdrawalsByBucketId[id].push({ month, amount: Math.abs(delta) });
      }
    });
  });

  return { contributionsByBucketId, withdrawalsByBucketId };
};

type WithdrawalScheduleParams = {
  months: string[];
  cashBalances: number[];
  reserveTargets: number[];
  allocationBalancesById: Record<string, number[]>;
};

export const solveWithdrawalsToMaintainReserve = ({
  months,
  cashBalances,
  reserveTargets,
  allocationBalancesById,
}: WithdrawalScheduleParams): SmartInvestWithdrawalSolveResult => {
  const schedule: SmartInvestWithdrawalSchedule = {};
  const totalByMonth = Array.from({ length: months.length }, () => 0);
  const shortfallsByMonth: SmartInvestWithdrawalSolveResult["shortfallsByMonth"] =
    [];

  Object.keys(allocationBalancesById).forEach((id) => {
    schedule[id] = [];
  });

  months.forEach((month, index) => {
    const reserveTarget = reserveTargets[index] ?? 0;
    const cashBalance = cashBalances[index] ?? 0;
    if (cashBalance >= reserveTarget) {
      return;
    }

    const shortfall = reserveTarget - cashBalance;
    const allocationBalances = Object.entries(allocationBalancesById)
      .map(([id, series]) => ({ id, balance: series[index] ?? 0 }))
      .filter((entry) => entry.balance > 0);
    const totalBalance = allocationBalances.reduce(
      (sum, entry) => sum + entry.balance,
      0
    );
    if (shortfall <= 0 || totalBalance <= 0) {
      if (shortfall > 0) {
        shortfallsByMonth.push({ month, shortfall, available: totalBalance });
      }
      return;
    }

    const withdrawalAmount = Math.min(shortfall, totalBalance);
    totalByMonth[index] = withdrawalAmount;
    allocationBalances.forEach((entry) => {
      const amount = withdrawalAmount * (entry.balance / totalBalance);
      if (amount <= 0) {
        return;
      }
      schedule[entry.id] = schedule[entry.id] ?? [];
      schedule[entry.id].push({ month, amount });
    });

    if (totalBalance < shortfall) {
      shortfallsByMonth.push({ month, shortfall, available: totalBalance });
    }
  });

  return { scheduleByBucketId: schedule, totalByMonth, shortfallsByMonth };
};

export const formatWithdrawalScheduleKey = (
  schedule: SmartInvestWithdrawalSchedule | null | undefined
) =>
  JSON.stringify(
    Object.entries(schedule ?? {})
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([id, entries]) => [
        id,
        [...entries]
          .sort((a, b) => (a.month < b.month ? -1 : 1))
          .map((entry) => ({
            month: entry.month,
            amount: Number(entry.amount.toFixed(4)),
          })),
      ])
  );

export const formatRebalanceScheduleKey = (
  schedule: SmartInvestRebalanceSchedule | null | undefined
) => {
  const normalized = schedule ?? { contributionsByBucketId: {}, withdrawalsByBucketId: {} };
  const normalizeEntries = (entries: Array<{ month: string; amount: number }>) =>
    [...entries]
      .sort((a, b) => (a.month < b.month ? -1 : 1))
      .map((entry) => ({
        month: entry.month,
        amount: Number(entry.amount.toFixed(4)),
      }));
  return JSON.stringify({
    contributions: Object.entries(normalized.contributionsByBucketId)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([id, entries]) => [id, normalizeEntries(entries)]),
    withdrawals: Object.entries(normalized.withdrawalsByBucketId)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([id, entries]) => [id, normalizeEntries(entries)]),
  });
};
