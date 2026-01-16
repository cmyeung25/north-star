import { buildMonthRange, monthIndex } from "@north-star/engine";
import type { BudgetRule, Scenario } from "../../store/scenarioStore";
import { getMemberAgeYears } from "../members/age";

export type BudgetRuleMonthlyEntry = {
  month: string;
  amountSigned: number;
  sourceRuleId: string;
  memberId?: string;
  label: string;
};

export const compileBudgetRuleToMonthlySeries = (
  rule: BudgetRule,
  scenario: Scenario
): BudgetRuleMonthlyEntry[] => {
  if (!rule.enabled) {
    return [];
  }

  const baseMonth = scenario.assumptions.baseMonth;
  const horizonMonths = scenario.assumptions.horizonMonths ?? 0;

  if (!baseMonth || horizonMonths <= 0) {
    return [];
  }

  const startMonth = rule.startMonth ?? baseMonth;
  const endMonth = rule.endMonth ?? null;
  const startIndex = monthIndex(baseMonth, startMonth);
  const endIndex = endMonth ? monthIndex(baseMonth, endMonth) : horizonMonths - 1;
  const rangeStart = Math.max(0, startIndex);
  const rangeEnd = Math.min(horizonMonths - 1, endIndex);

  if (rangeStart > rangeEnd) {
    return [];
  }

  const months = buildMonthRange(baseMonth, horizonMonths);
  const monthlyAmount = Math.abs(rule.monthlyAmount ?? 0);
  const annualGrowthPct = rule.annualGrowthPct ?? 0;
  const monthlyFactor = Math.pow(1 + annualGrowthPct / 100, 1 / 12);
  const member = rule.memberId
    ? (scenario.members ?? []).find((entry) => entry.id === rule.memberId) ?? null
    : null;

  if (rule.memberId && !member) {
    return [];
  }
  if (monthlyAmount === 0) {
    return [];
  }

  const series: BudgetRuleMonthlyEntry[] = [];

  for (let i = rangeStart; i <= rangeEnd; i += 1) {
    const month = months[i];
    if (member) {
      const ageYears = getMemberAgeYears(member, month, baseMonth);
      if (ageYears < rule.ageBand.fromYears || ageYears >= rule.ageBand.toYears) {
        continue;
      }
    }

    const monthsSinceStart = i - startIndex;
    const grownMonthlyAmount =
      monthlyAmount * Math.pow(monthlyFactor, monthsSinceStart);

    series.push({
      month,
      amountSigned: -Math.abs(grownMonthlyAmount),
      sourceRuleId: rule.id,
      memberId: rule.memberId,
      label: rule.name,
    });
  }

  return series;
};

export const compileAllBudgetRules = (scenario: Scenario): BudgetRuleMonthlyEntry[] =>
  (scenario.budgetRules ?? [])
    .filter((rule) => rule.enabled)
    .flatMap((rule) => compileBudgetRuleToMonthlySeries(rule, scenario));
