import { buildMonthRange } from "@north-star/engine";
import type { BudgetRule, Scenario } from "../../store/scenarioStore";
import { getMemberAgeYears, monthsBetween } from "../members/age";

export type BudgetRuleMonthlyEntry = {
  month: string;
  amountSigned: number;
  sourceRuleId: string;
  memberId?: string;
  label: string;
  category: string;
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

  const months = buildMonthRange(baseMonth, horizonMonths);
  const horizonEndMonth = months.at(-1);
  if (!horizonEndMonth) {
    return [];
  }

  const effectiveStartMonth = rule.startMonth ?? baseMonth;
  const effectiveEndMonth = rule.endMonth ?? horizonEndMonth;
  const monthlyAmountBase = -Math.abs(rule.monthlyAmount ?? 0);
  const annualGrowthPct = rule.annualGrowthPct ?? 0;
  const monthlyFactor = Math.pow(1 + annualGrowthPct / 100, 1 / 12);
  const member = rule.memberId
    ? (scenario.members ?? []).find((entry) => entry.id === rule.memberId) ?? null
    : null;

  if (rule.memberId && !member) {
    return [];
  }

  const series: BudgetRuleMonthlyEntry[] = [];

  for (const month of months) {
    const withinEffectiveRange =
      monthsBetween(effectiveStartMonth, month) >= 0 &&
      monthsBetween(month, effectiveEndMonth) >= 0;
    const withinAgeBand = member
      ? (() => {
          const ageYears = getMemberAgeYears(member, month, baseMonth);
          return ageYears >= rule.ageBand.fromYears && ageYears < rule.ageBand.toYears;
        })()
      : true;

    const monthsSinceStart = monthsBetween(effectiveStartMonth, month);
    const grownMonthlyAmount =
      withinEffectiveRange && withinAgeBand
        ? monthlyAmountBase * Math.pow(monthlyFactor, Math.max(monthsSinceStart, 0))
        : 0;
    series.push({
      month,
      amountSigned: Math.round(grownMonthlyAmount),
      sourceRuleId: rule.id,
      memberId: rule.memberId,
      label: rule.name,
      category: rule.category,
    });
  }

  return series;
};

export const compileAllBudgetRules = (scenario: Scenario): BudgetRuleMonthlyEntry[] =>
  (scenario.budgetRules ?? [])
    .filter((rule) => rule.enabled)
    .flatMap((rule) => compileBudgetRuleToMonthlySeries(rule, scenario));

export const sumByMonth = (
  ledger: BudgetRuleMonthlyEntry[]
): Array<{ month: string; totalAmountSigned: number }> => {
  const totals = new Map<string, number>();

  ledger.forEach((entry) => {
    totals.set(entry.month, (totals.get(entry.month) ?? 0) + entry.amountSigned);
  });

  return Array.from(totals.entries())
    .map(([month, totalAmountSigned]) => ({
      month,
      totalAmountSigned,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
};
