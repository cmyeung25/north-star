import type { SmartInvestPolicy } from "../smartInvest/types";
import type {
  PlanLabExperiment,
  PlanLabSmartInvestAdjustExperiment,
  PlanLabSmartInvestPatch,
} from "./types";

const cloneSmartInvestPolicy = (policy: SmartInvestPolicy): SmartInvestPolicy => ({
  ...policy,
  reserve: { ...policy.reserve },
  contribution: { ...policy.contribution },
  allocation: policy.allocation.map((entry) => ({ ...entry })),
  allocationProfiles: policy.allocationProfiles?.map((profile) => ({
    ...profile,
    allocation: profile.allocation.map((entry) => ({ ...entry })),
  })),
  withdrawal: { ...policy.withdrawal },
});

export const applySmartInvestPatch = (
  basePolicy: SmartInvestPolicy,
  patch?: PlanLabSmartInvestPatch
): SmartInvestPolicy => {
  if (!patch) {
    return cloneSmartInvestPolicy(basePolicy);
  }
  let next = cloneSmartInvestPolicy(basePolicy);
  if (patch.patch) {
    const { reserve, contribution, allocation, allocationProfiles, withdrawal, ...rest } =
      patch.patch;
    next = {
      ...next,
      ...rest,
    };
    if (reserve) {
      next.reserve = reserve;
    }
    if (contribution) {
      next.contribution = contribution;
    }
    if (allocation) {
      next.allocation = allocation;
    }
    if (allocationProfiles) {
      next.allocationProfiles = allocationProfiles;
    }
    if (withdrawal) {
      next.withdrawal = {
        ...next.withdrawal,
        ...withdrawal,
      };
    }
  }
  if (patch.isDisabled !== undefined) {
    next.enabled = !patch.isDisabled;
  }
  return next;
};

const applyReserveOverride = (
  reserve: SmartInvestPolicy["reserve"],
  experiment: PlanLabSmartInvestAdjustExperiment
): SmartInvestPolicy["reserve"] => {
  if (!experiment.reserveMode && experiment.reserveAmount === undefined && experiment.reserveMonths === undefined) {
    return reserve;
  }
  if (experiment.reserveMode === "fixed") {
    return {
      mode: "fixed",
      amount:
        experiment.reserveAmount ??
        (reserve.mode === "fixed" ? reserve.amount : 0),
    };
  }
  if (experiment.reserveMode === "monthsOfOutflow") {
    return {
      mode: "monthsOfOutflow",
      months:
        experiment.reserveMonths ??
        (reserve.mode === "monthsOfOutflow" ? reserve.months : 0),
    };
  }
  if (reserve.mode === "fixed" && experiment.reserveAmount !== undefined) {
    return { ...reserve, amount: experiment.reserveAmount };
  }
  if (reserve.mode === "monthsOfOutflow" && experiment.reserveMonths !== undefined) {
    return { ...reserve, months: experiment.reserveMonths };
  }
  return reserve;
};

const applyContributionOverride = (
  contribution: SmartInvestPolicy["contribution"],
  experiment: PlanLabSmartInvestAdjustExperiment
): SmartInvestPolicy["contribution"] => {
  if (
    !experiment.contributionMode &&
    experiment.contributionPct === undefined &&
    experiment.contributionInvestPct === undefined &&
    experiment.contributionThresholdAmount === undefined
  ) {
    return contribution;
  }
  if (experiment.contributionMode === "percentOfIncome") {
    return {
      mode: "percentOfIncome",
      pct:
        experiment.contributionPct ??
        (contribution.mode === "percentOfIncome" ? contribution.pct : 0),
    };
  }
  if (experiment.contributionMode === "percentOfSurplus") {
    return {
      mode: "percentOfSurplus",
      pct:
        experiment.contributionPct ??
        (contribution.mode === "percentOfSurplus" ? contribution.pct : 0),
    };
  }
  if (experiment.contributionMode === "excessCash") {
    return {
      mode: "excessCash",
      investPct:
        experiment.contributionInvestPct ??
        (contribution.mode === "excessCash" ? contribution.investPct : 100),
      thresholdAmount:
        experiment.contributionThresholdAmount ??
        (contribution.mode === "excessCash" ? contribution.thresholdAmount : 0),
    };
  }
  if (experiment.contributionMode === "rebalance") {
    return { mode: "rebalance" };
  }
  if (
    (contribution.mode === "percentOfIncome" ||
      contribution.mode === "percentOfSurplus") &&
    experiment.contributionPct !== undefined
  ) {
    return { ...contribution, pct: experiment.contributionPct };
  }
  if (contribution.mode === "excessCash") {
    return {
      ...contribution,
      investPct:
        experiment.contributionInvestPct ?? contribution.investPct,
      thresholdAmount:
        experiment.contributionThresholdAmount ?? contribution.thresholdAmount,
    };
  }
  return contribution;
};

export const applySmartInvestAdjustExperiment = (
  basePolicy: SmartInvestPolicy,
  experiment: PlanLabSmartInvestAdjustExperiment
): SmartInvestPolicy => {
  const next = cloneSmartInvestPolicy(basePolicy);
  next.reserve = applyReserveOverride(next.reserve, experiment);
  next.contribution = applyContributionOverride(next.contribution, experiment);
  if (experiment.allocation) {
    next.allocation = experiment.allocation;
  }
  if (
    experiment.withdrawalEnabled !== undefined ||
    experiment.withdrawalMode ||
    experiment.withdrawalSellOrder
  ) {
    next.withdrawal = {
      ...next.withdrawal,
      enabled: experiment.withdrawalEnabled ?? next.withdrawal.enabled,
      mode: experiment.withdrawalMode ?? next.withdrawal.mode,
      sellOrder: experiment.withdrawalSellOrder ?? next.withdrawal.sellOrder,
    };
  }
  return next;
};

export const buildSmartInvestPolicyFromDraft = (params: {
  baselinePolicy?: SmartInvestPolicy;
  baselinePatch?: PlanLabSmartInvestPatch;
  experiments?: PlanLabExperiment[];
}): SmartInvestPolicy | null => {
  if (!params.baselinePolicy) {
    return null;
  }
  let next = applySmartInvestPatch(params.baselinePolicy, params.baselinePatch);
  (params.experiments ?? []).forEach((experiment) => {
    if (experiment.type !== "smartInvestAdjust") {
      return;
    }
    if (experiment.isEnabled === false) {
      return;
    }
    next = applySmartInvestAdjustExperiment(next, experiment);
  });
  return next;
};
