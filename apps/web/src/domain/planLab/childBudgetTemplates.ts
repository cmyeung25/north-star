import type { BudgetRule } from "../../store/scenarioStore";
import { createBudgetRuleId } from "../../store/scenarioStore";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../constants";

export type ChildBudgetTemplateParams = {
  memberId: string;
  memberName?: string;
};

const buildRuleName = (memberName: string | undefined, label: string) =>
  memberName ? `${memberName} ${label}` : label;

export const buildChildBudgetRuleTemplates = (
  params: ChildBudgetTemplateParams
): BudgetRule[] => [
  {
    id: createBudgetRuleId(),
    name: buildRuleName(params.memberName, "Childcare (0-3)"),
    enabled: true,
    memberId: params.memberId,
    category: "childcare",
    ageBand: { fromYears: 0, toYears: 3 },
    monthlyAmount: 0,
    annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  },
  {
    id: createBudgetRuleId(),
    name: buildRuleName(params.memberName, "Kindergarten (3-6)"),
    enabled: true,
    memberId: params.memberId,
    category: "childcare",
    ageBand: { fromYears: 3, toYears: 6 },
    monthlyAmount: 0,
    annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  },
  {
    id: createBudgetRuleId(),
    name: buildRuleName(params.memberName, "Education (6-18)"),
    enabled: true,
    memberId: params.memberId,
    category: "education",
    ageBand: { fromYears: 6, toYears: 18 },
    monthlyAmount: 0,
    annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  },
];
