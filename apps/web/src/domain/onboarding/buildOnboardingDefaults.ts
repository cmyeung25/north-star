import type { ApplyScope } from "../applyScope";
import { getMemberAgeYears } from "../members/age";
import { normalizeMonthStrict } from "../../utils/month";
import { DEFAULT_ANNUAL_GROWTH_PCT } from "../constants";
import type {
  OnboardingBudgetRuleDraft,
  OnboardingIncomeDraft,
  OnboardingMemberDraft,
  OnboardingTimelineEventDraft,
} from "./applyDraft";

type BuildOnboardingDefaultsParams = {
  members: OnboardingMemberDraft[];
  baseMonth: string;
  scenarioId: string;
  existingIncomes?: OnboardingIncomeDraft[];
  existingTimelineEvents?: OnboardingTimelineEventDraft[];
  existingBudgetRules?: OnboardingBudgetRuleDraft[];
};

type OnboardingDefaults = {
  incomesToUpsert: OnboardingIncomeDraft[];
  timelineEventsToUpsert: OnboardingTimelineEventDraft[];
  budgetRulesToUpsert: OnboardingBudgetRuleDraft[];
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
  category: OnboardingBudgetRuleDraft["category"]
) => `seed:${category}:${normalizeMemberId(memberId)}`;

const buildExistingIncomeFingerprints = (params: BuildOnboardingDefaultsParams) => {
  const fingerprints = new Set<string>();

  params.existingIncomes?.forEach((income) => {
    if (income.subtype === "salary") {
      fingerprints.add(buildSalaryFingerprint(income.memberId));
    }
  });

  return fingerprints;
};

const buildExistingBudgetFingerprints = (params: BuildOnboardingDefaultsParams) => {
  const fingerprints = new Set<string>();

  params.existingBudgetRules?.forEach((rule) => {
    if (rule.category === "baseline") {
      fingerprints.add(buildBasicExpenseFingerprint(rule.memberId));
      return;
    }
    fingerprints.add(buildCategoryFingerprint(rule.memberId, rule.category));
  });

  return fingerprints;
};

const normalizeMemberForAge = (member: OnboardingMemberDraft) => {
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

export const buildOnboardingDefaults = (
  params: BuildOnboardingDefaultsParams
): OnboardingDefaults => {
  const normalizedBaseMonth = normalizeMonthStrict(params.baseMonth);
  if (!normalizedBaseMonth.ok) {
    return {
      incomesToUpsert: [],
      timelineEventsToUpsert: [],
      budgetRulesToUpsert: [],
    };
  }

  const incomeFingerprints = buildExistingIncomeFingerprints(params);
  const budgetFingerprints = buildExistingBudgetFingerprints(params);

  const incomesToUpsert: OnboardingIncomeDraft[] = [];
  const budgetRulesToUpsert: OnboardingBudgetRuleDraft[] = [];
  const timelineEventsToUpsert: OnboardingTimelineEventDraft[] = [];

  params.members.forEach((member) => {
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
        endMonth: "",
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
          endMonth: "",
          applyScope: buildApplyScope(params.scenarioId),
        });
      }
      return;
    }

    const hasAge =
      Boolean(member.birthMonth?.trim()) || typeof member.ageAtBaseMonth === "number";
    if (!hasAge) {
      return;
    }

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
        incomesToUpsert.push({
          id: fingerprint,
          title: "",
          memberId: member.id,
          subtype: "salary",
          monthlyAmount: 0,
          startMonth: normalizedBaseMonth.month,
          endMonth: "",
          endAtAgeYears: undefined,
          annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
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
          endMonth: "",
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
          endMonth: "",
          applyScope: buildApplyScope(params.scenarioId),
        });
      }
    }
  });

  return { incomesToUpsert, timelineEventsToUpsert, budgetRulesToUpsert };
};
