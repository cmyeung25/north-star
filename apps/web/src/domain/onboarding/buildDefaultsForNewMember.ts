import type { ApplyScope } from "../applyScope";
import { appliesToScenario } from "../applyScope";
import type { ScenarioEventView, EventDefinition } from "../events/types";
import type { BudgetRule, ScenarioMember } from "../../store/scenarioStore";
import { getMemberAgeYears } from "../members/age";
import { normalizeMonthStrict } from "../../utils/month";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../constants";

export type BuildDefaultsForNewMemberParams = {
  member: ScenarioMember;
  members: ScenarioMember[];
  baseMonth: string;
  scenarioId: string;
  baseCurrency?: string;
  existingBudgetRules?: BudgetRule[];
  existingEventViews?: ScenarioEventView[];
};

type DefaultsForNewMember = {
  eventDefinitionsToUpsert: EventDefinition[];
  budgetRulesToUpsert: BudgetRule[];
};

const buildApplyScope = (scenarioId: string): ApplyScope => ({
  scope: "include",
  scenarioIds: [scenarioId],
});

const normalizeMemberId = (memberId?: string | null) =>
  memberId ? memberId : "household";

const buildSalaryFingerprint = (memberId?: string | null) =>
  `seed:salary:${normalizeMemberId(memberId)}`;

const buildBasicExpenseFingerprint = (memberId?: string | null) =>
  `seed:basicExpense:${normalizeMemberId(memberId)}`;

const buildCategoryFingerprint = (
  memberId: string | null | undefined,
  category: BudgetRule["category"]
) => `seed:${category}:${normalizeMemberId(memberId)}`;

const buildExistingIncomeFingerprints = (params: BuildDefaultsForNewMemberParams) => {
  const fingerprints = new Set<string>();

  params.existingEventViews?.forEach((view) => {
    if (view.definition.kind !== "cashflow") {
      return;
    }
    if (view.definition.incomeSubtype === "salary" || view.definition.type === "salary") {
      fingerprints.add(buildSalaryFingerprint(view.definition.memberId));
    }
  });

  return fingerprints;
};

const buildExistingBudgetFingerprints = (params: BuildDefaultsForNewMemberParams) => {
  const fingerprints = new Set<string>();

  params.existingBudgetRules?.forEach((rule) => {
    if (!appliesToScenario(rule.applyScope, params.scenarioId)) {
      return;
    }
    if (rule.category === "baseline") {
      fingerprints.add(buildBasicExpenseFingerprint(rule.memberId));
      return;
    }
    fingerprints.add(buildCategoryFingerprint(rule.memberId, rule.category));
  });

  return fingerprints;
};

const normalizeMemberForAge = (member: ScenarioMember) => {
  const birthMonthInput = member.birthMonth?.trim() ?? "";
  const normalizedBirthMonth = birthMonthInput
    ? normalizeMonthStrict(birthMonthInput)
    : null;
  const birthMonth = normalizedBirthMonth?.ok ? normalizedBirthMonth.month : undefined;
  return {
    id: member.id,
    name: member.name,
    kind: member.kind,
    birthMonth,
    ageAtBaseMonth: member.ageAtBaseMonth,
  };
};

export const buildDefaultsForNewMember = (
  params: BuildDefaultsForNewMemberParams
): DefaultsForNewMember => {
  const normalizedBaseMonth = normalizeMonthStrict(params.baseMonth);
  if (!normalizedBaseMonth.ok) {
    return { eventDefinitionsToUpsert: [], budgetRulesToUpsert: [] };
  }

  const memberIncluded = params.members.some((entry) => entry.id === params.member.id);
  if (!memberIncluded) {
    return { eventDefinitionsToUpsert: [], budgetRulesToUpsert: [] };
  }

  const incomeFingerprints = buildExistingIncomeFingerprints(params);
  const budgetFingerprints = buildExistingBudgetFingerprints(params);

  const eventDefinitionsToUpsert: EventDefinition[] = [];
  const budgetRulesToUpsert: BudgetRule[] = [];

  const member = params.member;

  const basicExpenseFingerprint = buildBasicExpenseFingerprint(member.id);
  if (!budgetFingerprints.has(basicExpenseFingerprint)) {
    budgetFingerprints.add(basicExpenseFingerprint);
    budgetRulesToUpsert.push({
      id: basicExpenseFingerprint,
      name: "",
      enabled: true,
      memberId: member.id,
      category: "baseline",
      ageBand: { fromYears: 0, toYears: 120 },
      monthlyAmount: 0,
      annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
      startMonth: normalizedBaseMonth.month,
      endMonth: undefined,
      applyScope: buildApplyScope(params.scenarioId),
    });
  }

  if (member.kind === "pet") {
    const fingerprint = buildCategoryFingerprint(member.id, "petcare");
    if (!budgetFingerprints.has(fingerprint)) {
      budgetFingerprints.add(fingerprint);
      budgetRulesToUpsert.push({
        id: fingerprint,
        name: "",
        enabled: true,
        memberId: member.id,
        category: "petcare",
        ageBand: { fromYears: 0, toYears: 120 },
        monthlyAmount: 0,
        annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
        startMonth: normalizedBaseMonth.month,
        endMonth: undefined,
        applyScope: buildApplyScope(params.scenarioId),
      });
    }
  } else {
    const hasAge =
      Boolean(member.birthMonth?.trim()) || typeof member.ageAtBaseMonth === "number";
    if (hasAge) {
      const normalizedMember = normalizeMemberForAge(member);
      const ageYears = getMemberAgeYears(
        normalizedMember,
        normalizedBaseMonth.month,
        normalizedBaseMonth.month
      );

      if (ageYears >= 18) {
        const fingerprint = buildSalaryFingerprint(member.id);
        if (!incomeFingerprints.has(fingerprint)) {
          incomeFingerprints.add(fingerprint);
          eventDefinitionsToUpsert.push({
            id: fingerprint,
            title: "",
            type: "salary",
            kind: "cashflow",
            rule: {
              mode: "params",
              startMonth: normalizedBaseMonth.month,
              endMonth: null,
              monthlyAmount: 0,
              oneTimeAmount: 0,
              annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
            },
            currency: params.baseCurrency,
            memberId: member.id,
            incomeSubtype: "salary",
          });
        }
      }

      if (ageYears < 18) {
        const fingerprint = buildCategoryFingerprint(member.id, "childcare");
        if (!budgetFingerprints.has(fingerprint)) {
          budgetFingerprints.add(fingerprint);
          budgetRulesToUpsert.push({
            id: fingerprint,
            name: "",
            enabled: true,
            memberId: member.id,
            category: "childcare",
            ageBand: { fromYears: 0, toYears: 12 },
            monthlyAmount: 0,
            annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
            startMonth: normalizedBaseMonth.month,
            endMonth: undefined,
            applyScope: buildApplyScope(params.scenarioId),
          });
        }
      }

      if (ageYears >= 65) {
        const fingerprint = buildCategoryFingerprint(member.id, "eldercare");
        if (!budgetFingerprints.has(fingerprint)) {
          budgetFingerprints.add(fingerprint);
          budgetRulesToUpsert.push({
            id: fingerprint,
            name: "",
            enabled: true,
            memberId: member.id,
            category: "eldercare",
            ageBand: { fromYears: 65, toYears: 120 },
            monthlyAmount: 0,
            annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
            startMonth: normalizedBaseMonth.month,
            endMonth: undefined,
            applyScope: buildApplyScope(params.scenarioId),
          });
        }
      }
    }
  }

  return { eventDefinitionsToUpsert, budgetRulesToUpsert };
};
