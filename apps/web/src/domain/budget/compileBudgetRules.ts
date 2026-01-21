import { buildMonthRange } from "@north-star/engine";
import type { BudgetRule, Scenario, ScenarioMember } from "../../store/scenarioStore";
import { getMemberAgeYears, monthsBetween } from "../members/age";
import { appliesToScenario } from "../applyScope";
import type { CashflowItem } from "../ledger/types";
import { normalizeMonthStrict } from "../../utils/month";

export type BudgetRuleMonthlyEntry = CashflowItem;

const isHousingCategory = (category: string) => category === "housing";

export const compileBudgetRuleToMonthlySeries = (
  rule: BudgetRule,
  scenario: Scenario,
  members: ScenarioMember[]
): BudgetRuleMonthlyEntry[] => {
  if (!rule.enabled) {
    return [];
  }
  if (!appliesToScenario(rule.applyScope, scenario.id)) {
    return [];
  }
  if (isHousingCategory(rule.category)) {
    return [];
  }

  const baseMonth = scenario.assumptions.baseMonth;
  const horizonMonths = scenario.assumptions.horizonMonths ?? 0;

  if (!baseMonth || horizonMonths <= 0) {
    return [];
  }
  const normalizedBaseMonth = normalizeMonthStrict(baseMonth);
  if (!normalizedBaseMonth.ok) {
    return [];
  }

  const months = buildMonthRange(normalizedBaseMonth.month, horizonMonths);
  const horizonEndMonth = months.at(-1);
  if (!horizonEndMonth) {
    return [];
  }

  const normalizedStartMonth = rule.startMonth
    ? normalizeMonthStrict(rule.startMonth)
    : null;
  if (rule.startMonth && !normalizedStartMonth?.ok) {
    return [];
  }
  const normalizedEndMonth = rule.endMonth ? normalizeMonthStrict(rule.endMonth) : null;
  if (rule.endMonth && !normalizedEndMonth?.ok) {
    return [];
  }

  const effectiveStartMonth = normalizedStartMonth?.ok
    ? normalizedStartMonth.month
    : normalizedBaseMonth.month;
  const effectiveEndMonth = normalizedEndMonth?.ok ? normalizedEndMonth.month : horizonEndMonth;
  const monthlyAmountBase = -Math.abs(rule.monthlyAmount ?? 0);
  const annualGrowthPct = rule.annualGrowthPct ?? 0;
  const monthlyFactor = Math.pow(1 + annualGrowthPct / 100, 1 / 12);
  const member = rule.memberId
    ? members.find((entry) => entry.id === rule.memberId) ?? null
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
      amount: Math.round(grownMonthlyAmount),
      source: "budget",
      sourceId: rule.id,
      memberId: rule.memberId,
      label: rule.name,
      category: rule.category,
    });
  }

  return series;
};

export const compileAllBudgetRules = (
  scenario: Scenario,
  rules: BudgetRule[],
  members: ScenarioMember[]
): BudgetRuleMonthlyEntry[] =>
  rules
    .filter((rule) => rule.enabled && !isHousingCategory(rule.category))
    .flatMap((rule) => compileBudgetRuleToMonthlySeries(rule, scenario, members));

export const sumByMonth = (
  ledger: BudgetRuleMonthlyEntry[]
): Array<{ month: string; totalAmountSigned: number }> => {
  const totals = new Map<string, number>();

  ledger.forEach((entry) => {
    totals.set(entry.month, (totals.get(entry.month) ?? 0) + entry.amount);
  });

  return Array.from(totals.entries())
    .map(([month, totalAmountSigned]) => ({
      month,
      totalAmountSigned,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
};
