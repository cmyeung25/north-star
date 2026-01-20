import type { EngineInvestment } from "@north-star/engine";
import { addMonths } from "../members/age";
import type { Scenario } from "../../store/scenarioStore";
import type { SmartInvestPolicy } from "./types";
import {
  buildReserveTarget,
  getSmartInvestInvestmentId,
  normalizeAllocations,
  type SmartInvestWithdrawalSchedule,
} from "./solver";

type BaselineCashflowEntry = {
  month: string;
  amount: number;
};

type CompileSmartInvestParams = {
  baseMonth: string;
  horizonMonths: number;
  scenario: Scenario;
  policy: SmartInvestPolicy;
  baselineCashflows: BaselineCashflowEntry[];
  withdrawalScheduleByAllocation?: SmartInvestWithdrawalSchedule;
};

const buildMonthRange = (baseMonth: string, horizonMonths: number) =>
  Array.from({ length: horizonMonths }, (_, index) => addMonths(baseMonth, index));

const sumByMonth = (
  months: string[],
  cashflows: BaselineCashflowEntry[]
) => {
  const lookup = new Map<string, { income: number; outflow: number; net: number }>();
  months.forEach((month) =>
    lookup.set(month, { income: 0, outflow: 0, net: 0 })
  );
  cashflows.forEach((entry) => {
    const bucket = lookup.get(entry.month);
    if (!bucket) {
      return;
    }
    bucket.net += entry.amount;
    if (entry.amount >= 0) {
      bucket.income += entry.amount;
    } else {
      bucket.outflow += Math.abs(entry.amount);
    }
  });

  return months.map((month) => ({
    month,
    ...(lookup.get(month) ?? { income: 0, outflow: 0, net: 0 }),
  }));
};

const buildContributionTarget = (
  policy: SmartInvestPolicy,
  income: number,
  surplus: number
) => {
  if (policy.contribution.mode === "percentOfIncome") {
    return Math.max(0, (income * (policy.contribution.pct ?? 0)) / 100);
  }
  return Math.max(0, (surplus * (policy.contribution.pct ?? 0)) / 100);
};

export const compileSmartInvest = ({
  baseMonth,
  horizonMonths,
  scenario,
  policy,
  baselineCashflows,
  withdrawalScheduleByAllocation,
}: CompileSmartInvestParams): EngineInvestment[] => {
  if (!policy.enabled || horizonMonths <= 0) {
    return [];
  }
  const allocations = normalizeAllocations(policy);
  if (allocations.length === 0) {
    return [];
  }

  const months = buildMonthRange(baseMonth, horizonMonths);
  const monthlyTotals = sumByMonth(months, baselineCashflows);
  const reserveTarget = buildReserveTarget(
    policy,
    monthlyTotals.map((entry) => entry.outflow)
  );
  let cashBalance = scenario.assumptions.initialCash ?? 0;
  const contributionSchedules = new Map<string, Map<string, number>>();

  allocations.forEach((allocation) => {
    contributionSchedules.set(allocation.id, new Map());
  });

  monthlyTotals.forEach((entry) => {
    cashBalance += entry.net;
    if (cashBalance > reserveTarget) {
      const target = buildContributionTarget(
        policy,
        entry.income,
        Math.max(0, entry.net)
      );
      const available = Math.max(0, cashBalance - reserveTarget);
      const investAmount = Math.min(available, target);
      if (investAmount > 0) {
        allocations.forEach((allocation) => {
          const amount = investAmount * allocation.normalizedPct;
          if (amount <= 0) {
            return;
          }
          const schedule = contributionSchedules.get(allocation.id);
          if (schedule) {
            schedule.set(entry.month, (schedule.get(entry.month) ?? 0) + amount);
          }
        });
        cashBalance -= investAmount;
      }
    }
  });

  return allocations.map((allocation) => {
    const contributionSchedule = contributionSchedules.get(allocation.id);
    const withdrawalSchedule = withdrawalScheduleByAllocation?.[allocation.id];

    return {
      id: getSmartInvestInvestmentId(allocation.id),
      startMonth: baseMonth,
      initialValue: 0,
      annualReturnRate: (allocation.assumedAnnualReturnPct ?? 0) / 100,
      contributionSchedule: contributionSchedule
        ? Array.from(contributionSchedule.entries())
            .filter(([, amount]) => amount > 0)
            .map(([month, amount]) => ({ month, amount }))
        : undefined,
      withdrawalSchedule:
        withdrawalSchedule && withdrawalSchedule.length > 0
          ? withdrawalSchedule.map((entry) => ({
              month: entry.month,
              amount: entry.amount,
            }))
          : undefined,
    };
  });
};
