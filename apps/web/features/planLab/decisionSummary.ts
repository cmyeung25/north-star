import { monthIndex } from "@north-star/engine";
import type {
  PlanLabDecisionRecommendedAction,
  PlanLabDecisionSummary,
} from "../../src/domain/planLab/types";

type TranslateFn = (
  key: string,
  fallback: string,
  values?: Record<string, string | number>
) => string;

type PlanLabDecisionRiskLevel = "healthy" | "warning" | "danger" | "unknown";

type PlanLabDecisionDriver = {
  title: string;
  contribution: number;
};

export type BuildPlanLabDecisionSummaryInput = {
  baseMonth: string | null;
  baselineTargetMonth: string | null;
  optionTargetMonth: string | null;
  baselineFirstNegativeCashMonth: string | null;
  optionFirstNegativeCashMonth: string | null;
  baselineRiskLevel: PlanLabDecisionRiskLevel;
  optionRiskLevel: PlanLabDecisionRiskLevel;
  minCashDelta: number | null;
  endNetWorthDelta: number | null;
  topDrivers: PlanLabDecisionDriver[];
  translate: TranslateFn;
};

const riskLevelRank: Record<PlanLabDecisionRiskLevel, number> = {
  unknown: -1,
  healthy: 0,
  warning: 1,
  danger: 2,
};

const resolveMonthDelta = (
  baseMonth: string | null,
  optionMonth: string | null,
  baselineMonth: string | null
): number | null => {
  if (!baseMonth || !optionMonth || !baselineMonth) {
    return null;
  }
  return monthIndex(baseMonth, optionMonth) - monthIndex(baseMonth, baselineMonth);
};

const pushAction = (
  bucket: PlanLabDecisionRecommendedAction[],
  next: PlanLabDecisionRecommendedAction
) => {
  if (bucket.some((item) => item.id === next.id)) {
    return;
  }
  bucket.push(next);
};

const resolveRecommendedActions = (
  input: BuildPlanLabDecisionSummaryInput,
  maxNegativeDriver: PlanLabDecisionDriver | null,
  riskTimingDelta: number | null
): PlanLabDecisionRecommendedAction[] => {
  const actions: PlanLabDecisionRecommendedAction[] = [];
  const t = input.translate;
  const riskWorsened = riskLevelRank[input.optionRiskLevel] > riskLevelRank[input.baselineRiskLevel];

  if (riskWorsened || (typeof input.minCashDelta === "number" && input.minCashDelta < 0)) {
    pushAction(actions, {
      id: "delay_target",
      label: t("planLabDecisionActionDelayTitle", "Delay high-cost decision"),
      reason: t(
        "planLabDecisionActionDelayReason",
        "Cash cushion is weaker than baseline; delay major spending or split the rollout."
      ),
    });
  }

  if (
    input.optionFirstNegativeCashMonth &&
    (!input.baselineFirstNegativeCashMonth ||
      (typeof riskTimingDelta === "number" && riskTimingDelta < 0))
  ) {
    pushAction(actions, {
      id: "build_cash_buffer",
      label: t("planLabDecisionActionBufferTitle", "Build cash buffer"),
      reason: t(
        "planLabDecisionActionBufferReason",
        "Negative-cash month arrives earlier; add reserve months or cut fixed outflow."
      ),
    });
  }

  if (typeof input.endNetWorthDelta === "number" && input.endNetWorthDelta < 0) {
    pushAction(actions, {
      id: "protect_income",
      label: t("planLabDecisionActionIncomeTitle", "Protect income line"),
      reason: t(
        "planLabDecisionActionIncomeReason",
        "Ending net worth is lower than baseline; protect income or raise non-salary inflow."
      ),
    });
  }

  if (maxNegativeDriver) {
    pushAction(actions, {
      id: "reduce_negative_driver",
      label: t("planLabDecisionActionDriverTitle", "Address top negative driver"),
      reason: t("planLabDecisionActionDriverReason", "Prioritize this driver first: {driver}", {
        driver: maxNegativeDriver.title,
      }),
    });
  }

  return actions.slice(0, 3);
};

export const buildPlanLabDecisionSummary = (
  input: BuildPlanLabDecisionSummaryInput
): PlanLabDecisionSummary => {
  const t = input.translate;
  const targetDelta = resolveMonthDelta(
    input.baseMonth,
    input.optionTargetMonth,
    input.baselineTargetMonth
  );

  const targetTiming =
    typeof targetDelta === "number"
      ? targetDelta < 0
        ? t("planLabDecisionTargetEarlier", "{months} months earlier", {
            months: Math.abs(targetDelta),
          })
        : targetDelta > 0
        ? t("planLabDecisionTargetLater", "{months} months later", {
            months: Math.abs(targetDelta),
          })
        : t("planLabDecisionTargetUnchanged", "Goal timing unchanged")
      : t("planLabDecisionTargetUnknown", "Goal timing comparison unavailable");

  const riskTimingDelta = resolveMonthDelta(
    input.baseMonth,
    input.optionFirstNegativeCashMonth,
    input.baselineFirstNegativeCashMonth
  );

  const riskTiming = input.optionFirstNegativeCashMonth
    ? !input.baselineFirstNegativeCashMonth
      ? t(
          "planLabDecisionRiskTimingIntroduced",
          "Negative cash is introduced at {month}.",
          { month: input.optionFirstNegativeCashMonth }
        )
      : typeof riskTimingDelta === "number"
      ? riskTimingDelta < 0
        ? t("planLabDecisionRiskTimingEarlier", "Negative cash arrives {months} months earlier.", {
            months: Math.abs(riskTimingDelta),
          })
        : riskTimingDelta > 0
        ? t("planLabDecisionRiskTimingLater", "Negative cash is delayed by {months} months.", {
            months: Math.abs(riskTimingDelta),
          })
        : t("planLabDecisionRiskTimingUnchanged", "Negative cash timing unchanged.")
      : t(
          "planLabDecisionRiskTimingAtMonth",
          "First negative cash month: {month}",
          { month: input.optionFirstNegativeCashMonth }
        )
    : input.baselineFirstNegativeCashMonth
    ? t("planLabDecisionRiskTimingRemoved", "Negative cash is no longer observed.")
    : t("planLabDecisionRiskTimingNoNegative", "No negative cash month detected.");

  const optionRiskRank = riskLevelRank[input.optionRiskLevel];
  const baselineRiskRank = riskLevelRank[input.baselineRiskLevel];
  const riskTrend =
    optionRiskRank >= 0 && baselineRiskRank >= 0
      ? optionRiskRank < baselineRiskRank
        ? t("planLabDecisionRiskImproved", "Cash risk improved")
        : optionRiskRank > baselineRiskRank
        ? t("planLabDecisionRiskWorsened", "Cash risk worsened")
        : t("planLabDecisionRiskUnchanged", "Cash risk unchanged")
      : t("planLabDecisionRiskUnknown", "Cash risk comparison unavailable");

  const riskLevel =
    input.optionRiskLevel === "danger"
      ? t("planLabDecisionRiskLevelDanger", "Danger")
      : input.optionRiskLevel === "warning"
      ? t("planLabDecisionRiskLevelWarning", "Watch")
      : input.optionRiskLevel === "healthy"
      ? t("planLabDecisionRiskLevelHealthy", "Healthy")
      : t("planLabDecisionRiskLevelUnknown", "Unknown");

  const maxPositiveDriver =
    input.topDrivers
      .filter((driver) => driver.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)[0] ?? null;

  const maxNegativeDriver =
    input.topDrivers
      .filter((driver) => driver.contribution < 0)
      .sort((a, b) => a.contribution - b.contribution)[0] ?? null;

  const recommendedActions = resolveRecommendedActions(
    input,
    maxNegativeDriver,
    riskTimingDelta
  );

  return {
    targetTiming,
    riskTiming,
    riskTrend,
    riskLevel,
    maxPositiveDriver,
    maxNegativeDriver,
    recommendedActions,
  };
};
