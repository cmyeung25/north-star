import type { EngineInvestment } from "@north-star/engine";
import { addMonths } from "../members/age";
import type { Scenario } from "../../store/scenarioStore";
import type { SmartInvestPolicy } from "./types";
import {
  compileAllocationWeightsByMonth,
  compileContributionSeries,
  computeReserveTargetByMonth,
  getSmartInvestInvestmentId,
  type SmartInvestContributionSchedule,
  type SmartInvestRebalanceSchedule,
  type SmartInvestWithdrawalSchedule,
} from "./solver";
import { normalizeMonthStrict } from "../../utils/month";

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
  contributionScheduleByAllocation?: SmartInvestContributionSchedule;
  withdrawalScheduleByAllocation?: SmartInvestWithdrawalSchedule;
  rebalanceScheduleByAllocation?: SmartInvestRebalanceSchedule;
};

const buildMonthRange = (baseMonth: string, horizonMonths: number) =>
  Array.from({ length: horizonMonths }, (_, index) => addMonths(baseMonth, index));

const normalizeBaselineCashflows = (
  baseMonth: string,
  horizonMonths: number,
  cashflows: BaselineCashflowEntry[]
) => {
  const months = buildMonthRange(baseMonth, horizonMonths);
  const indexLookup = new Map(months.map((month, index) => [month, index]));
  const totals = months.map(() => ({ income: 0, outflow: 0, net: 0 }));

  cashflows.forEach((entry) => {
    const normalized = normalizeMonthStrict(entry.month);
    if (!normalized.ok) {
      return;
    }
    const index = indexLookup.get(normalized.month);
    if (index === undefined) {
      return;
    }
    const bucket = totals[index];
    bucket.net += entry.amount;
    if (entry.amount >= 0) {
      bucket.income += entry.amount;
    } else {
      bucket.outflow += Math.abs(entry.amount);
    }
  });

  return { months, totals };
};

export const compileSmartInvest = ({
  baseMonth,
  horizonMonths,
  scenario,
  policy,
  baselineCashflows,
  contributionScheduleByAllocation,
  withdrawalScheduleByAllocation,
  rebalanceScheduleByAllocation,
}: CompileSmartInvestParams): EngineInvestment[] => {
  if (!policy.enabled || horizonMonths <= 0) {
    return [];
  }

  const allocationProfiles =
    policy.allocationProfiles && policy.allocationProfiles.length > 0
      ? policy.allocationProfiles
      : [
          {
            id: "default",
            name: "default",
            startMonth: baseMonth,
            allocation: policy.allocation,
          },
        ];
  const weightsByMonth = compileAllocationWeightsByMonth(
    allocationProfiles,
    baseMonth,
    horizonMonths
  );
  const allocationMeta = weightsByMonth.allocationMetaById;
  if (Object.keys(allocationMeta).length === 0) {
    return [];
  }

  const { months, totals: monthlyTotals } = normalizeBaselineCashflows(
    baseMonth,
    horizonMonths,
    baselineCashflows
  );
  const reserveTargets = computeReserveTargetByMonth(
    policy.reserve,
    monthlyTotals.map((entry) => entry.outflow)
  );
  const contributions =
    contributionScheduleByAllocation
      ? {
          totalByMonth: Array.from({ length: months.length }, () => 0),
          contributionsByBucketId: contributionScheduleByAllocation,
        }
      : compileContributionSeries({
          policy,
          months,
          monthlyTotals,
          reserveTargets,
          weightsById: weightsByMonth.weightsById,
          initialCash: scenario.assumptions.initialCash ?? 0,
        });

  return Object.values(allocationMeta).map((allocation) => {
    const contributionSchedule = contributions.contributionsByBucketId[allocation.id];
    const withdrawalSchedule = withdrawalScheduleByAllocation?.[allocation.id] ?? [];
    const rebalanceContributionSchedule =
      rebalanceScheduleByAllocation?.contributionsByBucketId?.[allocation.id] ?? [];
    const rebalanceWithdrawalSchedule =
      rebalanceScheduleByAllocation?.withdrawalsByBucketId?.[allocation.id] ?? [];
    const combinedContributionSchedule = [
      ...(contributionSchedule ?? []),
      ...rebalanceContributionSchedule,
    ];
    const combinedWithdrawalSchedule = [
      ...withdrawalSchedule,
      ...rebalanceWithdrawalSchedule,
    ];

    return {
      id: getSmartInvestInvestmentId(allocation.id),
      startMonth: baseMonth,
      initialValue: 0,
      annualReturnRate: (allocation.assumedAnnualReturnPct ?? 0) / 100,
      contributionSchedule:
        combinedContributionSchedule.length > 0
          ? combinedContributionSchedule.map((entry) => ({
              month: entry.month,
              amount: entry.amount,
            }))
          : undefined,
      withdrawalSchedule:
        combinedWithdrawalSchedule.length > 0
          ? combinedWithdrawalSchedule
              .map((entry) => {
                const normalized = normalizeMonthStrict(entry.month);
                if (!normalized.ok) {
                  return null;
                }
                return {
                  month: normalized.month,
                  amount: entry.amount,
                };
              })
              .filter((entry): entry is { month: string; amount: number } =>
                Boolean(entry)
              )
          : undefined,
    };
  });
};
