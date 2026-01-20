import type { SmartInvestPolicy } from "./types";

export type SmartInvestNormalizedAllocation = SmartInvestPolicy["allocation"][number] & {
  normalizedPct: number;
};

export type SmartInvestWithdrawalSchedule = Record<
  string,
  Array<{ month: string; amount: number }>
>;

export const getSmartInvestInvestmentId = (allocationId: string) =>
  `smart-invest-${allocationId}`;

export const getSmartInvestAssetKey = (allocationId: string) =>
  `investment:${getSmartInvestInvestmentId(allocationId)}`;

export const normalizeAllocations = (
  policy: SmartInvestPolicy
): SmartInvestNormalizedAllocation[] => {
  const total = policy.allocation.reduce((sum, item) => sum + item.targetPct, 0);
  if (total <= 0) {
    return [];
  }
  return policy.allocation.map((item) => ({
    ...item,
    normalizedPct: item.targetPct / total,
  }));
};

export const buildReserveTarget = (
  policy: SmartInvestPolicy,
  monthlyOutflows: number[]
) => {
  if (policy.reserve.mode === "fixed") {
    return Math.max(0, policy.reserve.amount ?? 0);
  }
  const months = Math.max(0, policy.reserve.months ?? 0);
  const averageOutflow =
    monthlyOutflows.length > 0
      ? monthlyOutflows.reduce((sum, value) => sum + value, 0) /
        monthlyOutflows.length
      : 0;
  return Math.max(0, months * averageOutflow);
};

type WithdrawalScheduleParams = {
  months: string[];
  cashBalances: number[];
  reserveTarget: number;
  allocationBalancesById: Record<string, number[]>;
};

export const buildSmartInvestWithdrawalSchedule = ({
  months,
  cashBalances,
  reserveTarget,
  allocationBalancesById,
}: WithdrawalScheduleParams): SmartInvestWithdrawalSchedule => {
  const schedule: SmartInvestWithdrawalSchedule = {};

  Object.keys(allocationBalancesById).forEach((id) => {
    schedule[id] = [];
  });

  months.forEach((month, index) => {
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
      return;
    }

    const withdrawalAmount = Math.min(shortfall, totalBalance);
    allocationBalances.forEach((entry) => {
      const amount = withdrawalAmount * (entry.balance / totalBalance);
      if (amount <= 0) {
        return;
      }
      schedule[entry.id] = schedule[entry.id] ?? [];
      schedule[entry.id].push({ month, amount });
    });
  });

  return schedule;
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
