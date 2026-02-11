import type { ScenarioAssumptions } from "../store/scenarioStore";
import type { CashflowEvent, IncomeGrowthMode } from "./scenarioV2/events";
import { monthsBetween } from "./members/age";

const resolveMonthlyGrowthRate = (annualGrowthPct: number): number => {
  if (!Number.isFinite(annualGrowthPct) || annualGrowthPct === 0) {
    return 0;
  }
  return Math.pow(1 + annualGrowthPct / 100, 1 / 12) - 1;
};

const roundCurrency = (value: number): number => Math.round(value);

export const applyAnnualRate = (
  baseAmount: number,
  monthsFromStart: number,
  annualRatePct: number
): number => {
  const amount = Number.isFinite(baseAmount) ? baseAmount : 0;
  const months = Number.isFinite(monthsFromStart)
    ? Math.max(0, Math.floor(monthsFromStart))
    : 0;
  const annualRate = Number.isFinite(annualRatePct) ? annualRatePct / 100 : 0;
  const factor = Math.pow(1 + annualRate, months / 12);
  return roundCurrency(amount * factor);
};

export const applyDepreciation = (
  initialValue: number,
  monthsFromStart: number,
  annualDepreciationPct: number
): number => {
  const value = Number.isFinite(initialValue) ? initialValue : 0;
  const months = Number.isFinite(monthsFromStart)
    ? Math.max(0, Math.floor(monthsFromStart))
    : 0;
  const depreciation = Number.isFinite(annualDepreciationPct)
    ? annualDepreciationPct / 100
    : 0;
  const factor = Math.pow(1 - depreciation, months / 12);
  const result = value * factor;
  return Number.isFinite(result) ? roundCurrency(result) : roundCurrency(value);
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
  if (event.growthSource === "rentGrowth") {
    return assumptions.rentAnnualGrowthPct ?? 0;
  }
  if (event.growthSource === "inflation") {
    return assumptions.inflationRate ?? 0;
  }

  const growthMode = resolveIncomeGrowthMode(event);
  if (growthMode === "assumption") {
    const growthPct =
      event.kind === "income"
        ? assumptions.salaryGrowthRate ?? 0
        : assumptions.inflationRate ?? 0;
    return Number.isFinite(growthPct) ? growthPct : 0;
  }
  if (growthMode === "custom") {
    const customGrowthPct = event.customGrowthRatePct ?? 0;
    return Number.isFinite(customGrowthPct) ? customGrowthPct : 0;
  }
  return 0;
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
  return sign * applyAnnualRate(baseAmount, monthIndex, annualGrowthPct);
};
