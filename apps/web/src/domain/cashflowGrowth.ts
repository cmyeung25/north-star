import type { ScenarioAssumptions } from "../store/scenarioStore";
import type { CashflowEvent, IncomeGrowthMode } from "./scenarioV2/events";
import { monthsBetween } from "./members/age";

const resolveMonthlyGrowthRate = (annualGrowthPct: number): number => {
  if (!Number.isFinite(annualGrowthPct) || annualGrowthPct === 0) {
    return 0;
  }
  return Math.pow(1 + annualGrowthPct / 100, 1 / 12) - 1;
};

export const applyAnnualGrowth = (
  baseAmount: number,
  annualGrowthPct: number,
  monthIndex: number
): number => {
  const amount = Number.isFinite(baseAmount) ? baseAmount : 0;
  const index = Number.isFinite(monthIndex) ? Math.max(0, Math.floor(monthIndex)) : 0;
  const monthlyRate = resolveMonthlyGrowthRate(annualGrowthPct);
  if (monthlyRate === 0 || index === 0) {
    return amount;
  }
  return amount * Math.pow(1 + monthlyRate, index);
};

export const resolveIncomeGrowthMode = (
  event: CashflowEvent
): IncomeGrowthMode => event.growthMode ?? "none";

export const resolveIncomeGrowthPct = (
  event: CashflowEvent,
  assumptions: ScenarioAssumptions
): number => {
  if (event.kind !== "income" || resolveIncomeGrowthMode(event) !== "assumption") {
    return 0;
  }
  const growthPct = assumptions.salaryGrowthRate ?? 0;
  return Number.isFinite(growthPct) ? growthPct : 0;
};

export const resolveCashflowAmountForMonth = (params: {
  event: CashflowEvent;
  month: string;
  assumptions: ScenarioAssumptions;
}): number => {
  const { event, month, assumptions } = params;
  const baseAmount = Math.abs(event.amount ?? 0);
  const sign = event.kind === "expense" ? -1 : 1;
  const annualGrowthPct = resolveIncomeGrowthPct(event, assumptions);

  if (annualGrowthPct === 0 || event.cadence === "oneOff" || !event.startMonth) {
    return sign * baseAmount;
  }

  const monthIndex = monthsBetween(event.startMonth, month);
  return sign * applyAnnualGrowth(baseAmount, annualGrowthPct, monthIndex);
};
