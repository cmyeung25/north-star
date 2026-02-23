import type { ScenarioAssumptionsOverride } from "../../components/ScenarioAssumptionsOverrideForm";

export const ENV_ASSUMPTION_LABELS: Record<keyof ScenarioAssumptionsOverride, string> = {
  inflationRate: "通脹率",
  salaryGrowthRate: "薪金增長",
  emergencyFundMonths: "緊急儲備目標",
  rentAnnualGrowthPct: "租金增長",
  propertyAppreciationPct: "房產增值",
  cashYieldPct: "現金收益率",
  carDepreciationRatePct: "汽車折舊",
};
