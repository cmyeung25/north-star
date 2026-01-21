import type { ProjectionResult } from "@north-star/engine";
import type { RiskLevel } from "../../../features/overview/types";
import type { RunwaySimulation } from "./runway";

export type RiskAssessment = {
  level: RiskLevel;
  runwayMonths: number | null;
  runwayBucket: "low" | "medium" | "high" | "unknown";
  debtRatio: number | null;
  debtRatioThreshold: number;
  bumpedByDebt: boolean;
};

const bumpRisk = (level: RiskLevel): RiskLevel => {
  if (level === "Low") {
    return "Medium";
  }
  if (level === "Medium") {
    return "High";
  }
  return level;
};

const resolveRunwayBucket = (runwayMonths: number | null) => {
  if (runwayMonths === null) {
    return "unknown";
  }
  if (runwayMonths >= 36) {
    return "high";
  }
  if (runwayMonths >= 18) {
    return "medium";
  }
  return "low";
};

export const computeRiskAssessment = (params: {
  projection: ProjectionResult;
  runway: RunwaySimulation;
  debtRatioThreshold?: number;
}): RiskAssessment => {
  const { projection, runway, debtRatioThreshold = 0.6 } = params;
  const runwayMonths = runway.months;
  const runwayBucket = resolveRunwayBucket(runwayMonths);
  let level: RiskLevel = "Medium";
  if (runwayBucket === "high") {
    level = "Low";
  } else if (runwayBucket === "medium") {
    level = "Medium";
  } else if (runwayBucket === "low") {
    level = "High";
  }

  const baseAssets =
    (projection.assets?.total?.[0] ?? 0) + (projection.cashBalance?.[0] ?? 0);
  const liabilities = projection.liabilities?.total?.[0] ?? 0;
  const debtRatio =
    baseAssets > 0 ? Math.min(1, Math.max(0, liabilities / baseAssets)) : null;
  const bumpedByDebt = debtRatio !== null && debtRatio >= debtRatioThreshold;
  if (bumpedByDebt) {
    level = bumpRisk(level);
  }

  return {
    level,
    runwayMonths,
    runwayBucket,
    debtRatio,
    debtRatioThreshold,
    bumpedByDebt,
  };
};
