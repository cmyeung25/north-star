import { useMemo } from "react";
import { computeProjection, monthIndex } from "@north-star/engine";
import type { ProjectionInput, ProjectionResult } from "@north-star/engine";
import { mapScenarioToEngineInput, type AdapterWarning } from "./adapter";
import { compileScenarioCashflows } from "../domain/events/compiler";
import { getEventSign } from "../events/eventCatalog";
import { compileAllBudgetRules } from "../domain/budget/compileBudgetRules";
import type { BudgetRule, Scenario, ScenarioMember } from "../store/scenarioStore";
import type { EventDefinition } from "../domain/events/types";
import type { CashflowItem } from "../domain/ledger/types";
import { normalizeMonthStrict } from "../utils/month";
import {
  groupLedgerByMonth,
  summarizeMonth,
  type LedgerMonthSummary,
} from "../domain/ledger/ledgerUtils";
import { compileSellLifecycle } from "../domain/positions/compileSellLifecycle";
import {
  buildNetWorthBreakdownByMonth,
  type NetWorthBreakdown,
} from "../domain/netWorth/buildNetWorthBreakdown";
import {
  computeReserveTargetByMonth,
  compileAllocationWeightsByMonth,
  formatWithdrawalScheduleKey,
  getSmartInvestAssetKey,
  normalizeAllocations,
  solveExcessCashTransferPlan,
  solveRebalanceSchedule,
  type SmartInvestContributionSchedule,
  type SmartInvestRebalanceSchedule,
  type SmartInvestWithdrawalSchedule,
} from "../domain/smartInvest/solver";
import { buildSmartInvestProjectionBreakdown } from "../domain/smartInvest/projection";

type ProjectionWithLedger = {
  projection: ProjectionResult | null;
  ledger: CashflowItem[];
  months: string[];
  ledgerByMonth: Record<string, CashflowItem[]>;
  summaryByMonth: Record<string, LedgerMonthSummary>;
  positionCashflowsByMonth: Record<string, CashflowItem[]>;
  projectionNetCashflowByMonth: Record<string, number>;
  projectionNetCashflowMode: "netCashflow" | "cashDelta";
  netWorthBreakdownByMonth: Record<string, NetWorthBreakdown>;
  projectionWarnings: AdapterWarning[];
  smartInvestTransferSeries: Array<{
    month: string;
    amount: number;
    kind: "contribution" | "withdrawal";
  }>;
};

const emptyProjectionWithLedger: ProjectionWithLedger = {
  projection: null,
  ledger: [],
  months: [],
  ledgerByMonth: {},
  summaryByMonth: {},
  positionCashflowsByMonth: {},
  projectionNetCashflowByMonth: {},
  projectionNetCashflowMode: "netCashflow",
  netWorthBreakdownByMonth: {},
  projectionWarnings: [],
  smartInvestTransferSeries: [],
};

const filterLedgerToHorizon = (
  ledger: CashflowItem[],
  baseMonth: string,
  horizonMonths: number
) =>
  ledger.flatMap((entry) => {
    const normalized = normalizeMonthStrict(entry.month);
    if (!normalized.ok) {
      return [];
    }
    const offset = monthIndex(baseMonth, normalized.month);
    if (offset < 0 || offset >= horizonMonths) {
      return [];
    }
    return [{ ...entry, month: normalized.month }];
  });

const compileEventLedger = (
  scenario: Scenario,
  eventLibrary: EventDefinition[]
): CashflowItem[] => {
  const eventLookup = new Map(
    eventLibrary.map((definition) => [definition.id, definition])
  );
  const cashflows = compileScenarioCashflows({
    scenario,
    eventLibrary,
    signByType: getEventSign,
  });

  return cashflows.map((entry) => {
    const definition = eventLookup.get(entry.sourceEventId);
    return {
      month: entry.month,
      amount: entry.amountSigned,
      source: "event",
      sourceId: entry.sourceEventId,
      label: entry.title,
      category: entry.category,
      memberId: definition?.memberId,
    };
  });
};

const normalizeBudgetRulesForLedger = (rules: BudgetRule[]) =>
  rules.flatMap((rule) => {
    const startMonth = rule.startMonth
      ? normalizeMonthStrict(rule.startMonth)
      : null;
    if (rule.startMonth && !startMonth?.ok) {
      return [];
    }
    const endMonth = rule.endMonth ? normalizeMonthStrict(rule.endMonth) : null;
    if (rule.endMonth && !endMonth?.ok) {
      return [];
    }
    return [
      {
        ...rule,
        startMonth: startMonth?.ok ? startMonth.month : undefined,
        endMonth: endMonth?.ok ? endMonth.month : undefined,
      },
    ];
  });

const buildMonthlyOutflows = (months: string[], ledger: CashflowItem[]) => {
  const lookup = new Map<string, number>();
  months.forEach((month) => lookup.set(month, 0));
  ledger.forEach((entry) => {
    if (!lookup.has(entry.month)) {
      return;
    }
    if (entry.amount >= 0) {
      return;
    }
    lookup.set(entry.month, (lookup.get(entry.month) ?? 0) + Math.abs(entry.amount));
  });
  return months.map((month) => lookup.get(month) ?? 0);
};

const buildProjectionNetCashflowByMonth = (
  projection: ProjectionResult,
  initialCash: number
) => {
  if (projection.netCashflow.length > 0) {
    return {
      mode: "netCashflow" as const,
      byMonth: projection.months.reduce<Record<string, number>>(
        (acc, month, index) => {
          acc[month] = projection.netCashflow[index] ?? 0;
          return acc;
        },
        {}
      ),
    };
  }

  return {
    mode: "cashDelta" as const,
    byMonth: projection.months.reduce<Record<string, number>>(
      (acc, month, index) => {
        const current = projection.cashBalance[index] ?? 0;
        const previous =
          index === 0 ? initialCash : projection.cashBalance[index - 1] ?? 0;
        acc[month] = current - previous;
        return acc;
      },
      {}
    ),
  };
};

const normalizePositionSourceId = (key: string) => {
  const sanitized = key
    .replace(/:down_payment$/, ":downPayment")
    .replace(/:fees_one_time$/, ":feesOneTime")
    .replace(/:holding_cost$/, ":holdingCost")
    .replace(/:mortgage_interest$/, ":mortgageInterest")
    .replace(/:mortgage_principal$/, ":mortgagePrincipal")
    .replace(/:rental_income$/, ":rentalIncome")
    .replace(/:loan_interest$/, ":loanInterest")
    .replace(/:loan_principal$/, ":loanPrincipal")
    .replace(/:interest$/, ":interest")
    .replace(/:principal$/, ":principal")
    .replace(/:premium$/, ":premium")
    .replace(/:contribution$/, ":contribution")
    .replace(/:withdrawal$/, ":withdrawal");
  const parts = sanitized.split(":");
  if (parts.length >= 3) {
    return `${parts[0]}:${parts[parts.length - 1]}`;
  }
  return sanitized;
};

const isPositionCashflowKey = (key: string) =>
  /^(home|car|loan|insurance|investment):/.test(key);

const buildPositionCashflowsByMonth = (
  projection: ProjectionResult,
  scenario: Scenario
) => {
  const entries: Array<{ month: string; amount: number; sourceId: string }> = [];
  const breakdown = projection.breakdown?.cashflow.byKey ?? {};
  const months = projection.months;

  Object.entries(breakdown).forEach(([key, series]) => {
    if (!isPositionCashflowKey(key)) {
      return;
    }
    const sourceId = normalizePositionSourceId(key);
    series.forEach((amount, index) => {
      if (!amount) {
        return;
      }
      const month = months[index];
      if (!month) {
        return;
      }
      entries.push({ month, amount, sourceId });
    });
  });

  compileSellLifecycle(scenario).forEach((entry) => {
    entries.push({ month: entry.month, amount: entry.amount, sourceId: entry.sourceId });
  });

  return entries.reduce<Record<string, CashflowItem[]>>((acc, entry) => {
    if (!acc[entry.month]) {
      acc[entry.month] = [];
    }
    acc[entry.month].push({
      month: entry.month,
      amount: entry.amount,
      source: "position",
      sourceId: normalizePositionSourceId(entry.sourceId),
    });
    return acc;
  }, {});
};

export const computeProjectionWithSmartInvest = (
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  options: {
    members?: ScenarioMember[];
    budgetRules?: BudgetRule[];
    maxPasses?: number;
    horizonMonths?: number;
  } = {}
): {
  input: ProjectionInput;
  projection: ProjectionResult;
  warnings: AdapterWarning[];
  smartInvestWithdrawalSchedule: SmartInvestWithdrawalSchedule;
  smartInvestRebalanceSchedule: SmartInvestRebalanceSchedule | null;
  smartInvestTransferSeries: Array<{
    month: string;
    amount: number;
    kind: "contribution" | "withdrawal";
  }>;
} => {
  const maxPasses = options.maxPasses ?? 3;
  const members = options.members ?? [];
  const budgetRules = options.budgetRules ?? [];
  const { input: baseInput, warnings: baseWarnings } = mapScenarioToEngineInput(
    scenario,
    eventLibrary,
    {
      strict: false,
      members,
      budgetRules,
      horizonMonths: options.horizonMonths,
    }
  );
  let input = baseInput;
  let warnings = baseWarnings;
  let projection = computeProjection(baseInput);
  const smartInvestPolicy = scenario.assumptions.smartInvest;
  const normalizedAllocations = smartInvestPolicy
    ? normalizeAllocations(smartInvestPolicy)
    : [];
  const includeSmartInvest =
    smartInvestPolicy?.enabled &&
    (normalizedAllocations.length > 0 ||
      (smartInvestPolicy.allocationProfiles ?? []).some(
        (profile) => profile.allocation.length > 0
      ));

  if (!includeSmartInvest) {
    return {
      input,
      projection,
      warnings,
      smartInvestWithdrawalSchedule: {},
      smartInvestRebalanceSchedule: null,
      smartInvestTransferSeries: [],
    };
  }

  const scenarioForLedger = {
    ...scenario,
    assumptions: {
      ...scenario.assumptions,
      baseMonth: input.baseMonth,
      horizonMonths: input.horizonMonths,
    },
  };
  const includeBudgetRulesInProjection =
    scenario.assumptions.includeBudgetRulesInProjection ?? true;
  const budgetLedger = includeBudgetRulesInProjection
    ? compileAllBudgetRules(
        scenarioForLedger,
        normalizeBudgetRulesForLedger(budgetRules),
        members
      )
    : [];
  const eventLedger = compileScenarioCashflows({
    scenario: scenarioForLedger,
    eventLibrary,
    signByType: getEventSign,
  }).map((entry) => ({
    month: entry.month,
    amount: entry.amountSigned,
    source: "event" as const,
    sourceId: entry.sourceEventId,
    label: entry.title,
    category: entry.category,
  }));
  const combinedLedger = filterLedgerToHorizon(
    [...eventLedger, ...budgetLedger],
    input.baseMonth,
    input.horizonMonths
  );
  const reserveTargets = computeReserveTargetByMonth(
    smartInvestPolicy.reserve,
    buildMonthlyOutflows(projection.months, combinedLedger)
  );

  let withdrawalSchedule: SmartInvestWithdrawalSchedule = {};
  let rebalanceSchedule: SmartInvestRebalanceSchedule | null = null;
  let contributionSchedule: SmartInvestContributionSchedule | null = null;
  let transferSeries: Array<{
    month: string;
    amount: number;
    kind: "contribution" | "withdrawal";
  }> = [];
  let withdrawalWarnings: AdapterWarning[] = [];
  let passCount = 1;

  const getAllocationBalancesById = () => {
    const assetsByKey = projection.breakdown?.assets.assetsByKey ?? {};
    const allocationIds = new Set<string>();
    normalizedAllocations.forEach((allocation) => allocationIds.add(allocation.id));
    smartInvestPolicy.allocationProfiles?.forEach((profile) => {
      profile.allocation.forEach((allocation) => allocationIds.add(allocation.id));
    });
    return Array.from(allocationIds).reduce<Record<string, number[]>>((acc, id) => {
      acc[id] = assetsByKey[getSmartInvestAssetKey(id)] ?? [];
      return acc;
    }, {});
  };

  const weightsByMonth = compileAllocationWeightsByMonth(
    smartInvestPolicy.allocationProfiles && smartInvestPolicy.allocationProfiles.length > 0
      ? smartInvestPolicy.allocationProfiles
      : [
          {
            id: "default",
            name: "default",
            startMonth: input.baseMonth,
            allocation: smartInvestPolicy.allocation,
          },
        ],
    input.baseMonth,
    input.horizonMonths
  );

  const allocationBalancesById = getAllocationBalancesById();
  const excessCashContribution =
    smartInvestPolicy.contribution.mode === "excessCash"
      ? smartInvestPolicy.contribution
      : null;
  const isExcessCashMode = Boolean(excessCashContribution);
  const excessCashInvestPct = excessCashContribution?.investPct ?? 100;
  const excessCashThreshold = excessCashContribution?.thresholdAmount ?? 0;

  const buildSmartInvestNetCashflowByMonth = () => {
    const cashflow = projection.breakdown?.cashflow.byKey ?? {};
    const netByMonth = Array.from({ length: projection.months.length }, () => 0);
    Object.entries(cashflow).forEach(([key, series]) => {
      if (!key.startsWith("investment:smart-invest-")) {
        return;
      }
      series.forEach((amount, index) => {
        netByMonth[index] += amount ?? 0;
      });
    });
    return netByMonth;
  };

  const buildCashBalancesExcludingSmartInvest = () => {
    const netByMonth = buildSmartInvestNetCashflowByMonth();
    let cumulative = 0;
    return projection.months.map((_, index) => {
      cumulative += netByMonth[index] ?? 0;
      return (projection.cashBalance[index] ?? 0) - cumulative;
    });
  };

  const cashBalancesExcludingSmartInvest = buildCashBalancesExcludingSmartInvest();
  if (isExcessCashMode || smartInvestPolicy.withdrawal.enabled) {
    const transferPlan = solveExcessCashTransferPlan({
      months: projection.months,
      cashBalances: cashBalancesExcludingSmartInvest,
      reserveTargets,
      allocationBalancesById,
      weightsById: weightsByMonth.weightsById,
      investPct: isExcessCashMode ? excessCashInvestPct : 0,
      thresholdAmount: isExcessCashMode ? excessCashThreshold : 0,
      allowWithdrawals: smartInvestPolicy.withdrawal.enabled,
      allowContributions: isExcessCashMode,
    });
    if (smartInvestPolicy.withdrawal.enabled) {
      withdrawalSchedule = transferPlan.withdrawalScheduleByBucketId;
    }
    if (isExcessCashMode) {
      contributionSchedule = transferPlan.contributionScheduleByBucketId;
    }
    transferSeries = transferPlan.transferSeries;
    withdrawalWarnings = transferPlan.shortfallsByMonth.map((shortfall) => ({
      code: "smart-invest-reserve-shortfall",
      message: "Smart Invest withdrawals cannot fully cover the reserve shortfall.",
      meta: shortfall,
    }));
  }

  const hasWithdrawalSchedule =
    Object.values(withdrawalSchedule).flat().length > 0;
  const hasContributionSchedule =
    Boolean(contributionSchedule) &&
    Object.values(contributionSchedule ?? {}).flat().length > 0;

  const runProjectionPass = (params: {
    smartInvestContributionSchedules?: SmartInvestContributionSchedule;
    smartInvestWithdrawalSchedules?: SmartInvestWithdrawalSchedule;
    smartInvestRebalanceSchedules?: SmartInvestRebalanceSchedule;
  }) => {
    if (passCount >= maxPasses) {
      return;
    }
    const result = mapScenarioToEngineInput(scenario, eventLibrary, {
      strict: false,
      members,
      budgetRules,
      smartInvestContributionSchedules: params.smartInvestContributionSchedules,
      smartInvestWithdrawalSchedules: params.smartInvestWithdrawalSchedules,
      smartInvestRebalanceSchedules: params.smartInvestRebalanceSchedules,
      horizonMonths: options.horizonMonths,
    });
    input = result.input;
    warnings = result.warnings;
    projection = computeProjection(result.input);
    passCount += 1;
  };

  if (hasWithdrawalSchedule || hasContributionSchedule) {
    runProjectionPass({
      smartInvestContributionSchedules: contributionSchedule ?? undefined,
      smartInvestWithdrawalSchedules: withdrawalSchedule,
    });
  }

  if (
    smartInvestPolicy.withdrawal.enabled &&
    passCount < maxPasses &&
    projection.months.length > 0
  ) {
    const updatedAllocationBalancesById = getAllocationBalancesById();
    const updatedTransferPlan = solveExcessCashTransferPlan({
      months: projection.months,
      cashBalances: cashBalancesExcludingSmartInvest,
      reserveTargets,
      allocationBalancesById: updatedAllocationBalancesById,
      weightsById: weightsByMonth.weightsById,
      investPct: isExcessCashMode ? excessCashInvestPct : 0,
      thresholdAmount: isExcessCashMode ? excessCashThreshold : 0,
      allowWithdrawals: smartInvestPolicy.withdrawal.enabled,
      allowContributions: isExcessCashMode,
    });
    const previousKey = formatWithdrawalScheduleKey(withdrawalSchedule);
    const nextKey = formatWithdrawalScheduleKey(
      updatedTransferPlan.withdrawalScheduleByBucketId
    );
    if (previousKey !== nextKey) {
      withdrawalSchedule = updatedTransferPlan.withdrawalScheduleByBucketId;
      transferSeries = updatedTransferPlan.transferSeries;
      withdrawalWarnings = updatedTransferPlan.shortfallsByMonth.map((shortfall) => ({
        code: "smart-invest-reserve-shortfall",
        message: "Smart Invest withdrawals cannot fully cover the reserve shortfall.",
        meta: shortfall,
      }));
      runProjectionPass({
        smartInvestContributionSchedules: contributionSchedule ?? undefined,
        smartInvestWithdrawalSchedules: withdrawalSchedule,
      });
    }
  }

  if (smartInvestPolicy.contribution.mode === "rebalance") {
    const updatedAllocationBalancesById = getAllocationBalancesById();
    const candidateSchedule = solveRebalanceSchedule({
      months: projection.months,
      allocationBalancesById: updatedAllocationBalancesById,
      weightsById: weightsByMonth.weightsById,
    });
    const hasRebalanceEntries =
      Object.values(candidateSchedule.contributionsByBucketId).flat().length > 0 ||
      Object.values(candidateSchedule.withdrawalsByBucketId).flat().length > 0;
    rebalanceSchedule = hasRebalanceEntries ? candidateSchedule : null;
    if (rebalanceSchedule) {
      runProjectionPass({
        smartInvestContributionSchedules: contributionSchedule ?? undefined,
        smartInvestWithdrawalSchedules: withdrawalSchedule,
        smartInvestRebalanceSchedules: rebalanceSchedule ?? undefined,
      });
    }
  }

  if (withdrawalWarnings.length > 0) {
    warnings = [...warnings, ...withdrawalWarnings];
  }

  return {
    input,
    projection,
    warnings,
    smartInvestWithdrawalSchedule: withdrawalSchedule,
    smartInvestRebalanceSchedule: rebalanceSchedule,
    smartInvestTransferSeries: transferSeries,
  };
};

export const useProjectionWithLedger = (
  scenario: Scenario | null | undefined,
  eventLibrary: EventDefinition[],
  options: { members?: ScenarioMember[]; budgetRules?: BudgetRule[] } = {}
): ProjectionWithLedger =>
  useMemo(() => {
    if (!scenario) {
      return emptyProjectionWithLedger;
    }

    const {
      input,
      warnings,
      projection,
      smartInvestWithdrawalSchedule,
      smartInvestRebalanceSchedule,
      smartInvestTransferSeries,
    } = computeProjectionWithSmartInvest(scenario, eventLibrary, {
      members: options.members ?? [],
      budgetRules: options.budgetRules ?? [],
    });
    const scenarioForLedger = {
      ...scenario,
      assumptions: {
        ...scenario.assumptions,
        baseMonth: input.baseMonth,
        horizonMonths: input.horizonMonths,
      },
    };
    const includeBudgetRulesInProjection =
      scenario.assumptions.includeBudgetRulesInProjection ?? true;
    const eventLedger = compileEventLedger(scenarioForLedger, eventLibrary);
    const members = options.members ?? [];
    const budgetRules = normalizeBudgetRulesForLedger(options.budgetRules ?? []);
    const budgetLedger = includeBudgetRulesInProjection
      ? compileAllBudgetRules(scenarioForLedger, budgetRules, members)
      : [];
    const smartInvestLedger =
      projection && scenario.assumptions.smartInvest?.contribution.mode === "rebalance"
        ? (() => {
            const allocationNameLookup = new Map(
              scenario.assumptions.smartInvest?.allocation?.map((allocation) => [
                allocation.id,
                allocation.name,
              ]) ?? []
            );
            const entries: CashflowItem[] = [];
            if (smartInvestRebalanceSchedule) {
              Object.entries(smartInvestRebalanceSchedule.contributionsByBucketId).forEach(
                ([bucketId, schedule]) => {
                  schedule.forEach((entry) => {
                    entries.push({
                      month: entry.month,
                      amount: -entry.amount,
                      source: "smartInvest",
                      sourceId: `smartInvest:${bucketId}:rebalance`,
                      label: "rebalance",
                      category: "smartInvest",
                      bucketId,
                      bucketName: allocationNameLookup.get(bucketId) ?? bucketId,
                      kind: "rebalance",
                    });
                  });
                }
              );
              Object.entries(smartInvestRebalanceSchedule.withdrawalsByBucketId).forEach(
                ([bucketId, schedule]) => {
                  schedule.forEach((entry) => {
                    entries.push({
                      month: entry.month,
                      amount: entry.amount,
                      source: "smartInvest",
                      sourceId: `smartInvest:${bucketId}:rebalance`,
                      label: "rebalance",
                      category: "smartInvest",
                      bucketId,
                      bucketName: allocationNameLookup.get(bucketId) ?? bucketId,
                      kind: "rebalance",
                    });
                  });
                }
              );
            }
            Object.entries(smartInvestWithdrawalSchedule).forEach(
              ([bucketId, schedule]) => {
                schedule.forEach((entry) => {
                  entries.push({
                    month: entry.month,
                    amount: entry.amount,
                    source: "smartInvest",
                    sourceId: `smartInvest:${bucketId}:withdrawal`,
                    label: "withdrawal",
                    category: "smartInvest",
                    bucketId,
                    bucketName: allocationNameLookup.get(bucketId) ?? bucketId,
                    kind: "withdrawal",
                  });
                });
              }
            );
            return entries;
          })()
        : projection
          ? buildSmartInvestProjectionBreakdown(
              projection,
              scenario.assumptions.smartInvest?.allocation
            ).cashflowEntries.map((entry) => {
              const kind: CashflowItem["kind"] =
                entry.label === "withdrawal" ? "withdrawal" : "contribution";
              return {
                month: entry.month,
                amount: entry.amount,
                source: "smartInvest" as const,
                sourceId: entry.sourceId,
                label: entry.label,
                category: "smartInvest",
                bucketId: entry.bucketId,
                bucketName: entry.bucketName,
                kind,
              };
            })
          : [];
    const ledger = filterLedgerToHorizon(
      [...eventLedger, ...budgetLedger, ...smartInvestLedger],
      input.baseMonth,
      input.horizonMonths
    );
    if (process.env.NODE_ENV === "development") {
      if (
        includeBudgetRulesInProjection &&
        budgetRules.length > 0 &&
        budgetLedger.length > 0 &&
        !ledger.some((entry) => entry.source === "budget")
      ) {
        console.warn("[projection] Budget rules enabled but no budget ledger entries.");
      }
    }
    const ledgerByMonth = groupLedgerByMonth(ledger);
    const summaryByMonth = projection.months.reduce<
      Record<string, LedgerMonthSummary>
    >((acc, month) => {
      acc[month] = summarizeMonth(ledgerByMonth[month] ?? []);
      return acc;
    }, {});
    const netCashflowLookup = buildProjectionNetCashflowByMonth(
      projection,
      input.initialCash ?? 0
    );

    const positionCashflowsByMonth = buildPositionCashflowsByMonth(
      projection,
      scenarioForLedger
    );
    const netWorthBreakdownByMonth = buildNetWorthBreakdownByMonth(projection);

    return {
      projection,
      ledger,
      months: projection.months,
      ledgerByMonth,
      summaryByMonth,
      positionCashflowsByMonth,
      projectionNetCashflowByMonth: netCashflowLookup.byMonth,
      projectionNetCashflowMode: netCashflowLookup.mode,
      netWorthBreakdownByMonth,
      projectionWarnings: warnings,
      smartInvestTransferSeries,
    };
  }, [eventLibrary, options.budgetRules, options.members, scenario]);
