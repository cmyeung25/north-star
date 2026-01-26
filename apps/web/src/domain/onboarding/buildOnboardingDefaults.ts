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

export const getCategoryName = (category: OnboardingBudgetRuleDraft["category"], memberName?: string): string => {
  const baselineNameByLocale = memberName ? `${memberName} 基本支出` : "家庭基本支出";
  const categoryNameMap: Record<OnboardingBudgetRuleDraft["category"], string> = {
    baseline: baselineNameByLocale,
    health: memberName ? `${memberName} 健康` : "健康",
    childcare: memberName ? `${memberName} 育兒` : "育兒",
    education: memberName ? `${memberName} 教育` : "教育",
    eldercare: memberName ? `${memberName} 長者照護` : "長者照護",
    petcare: memberName ? `${memberName} 寵物照護` : "寵物照護",
  };
  return categoryNameMap[category] || category;
};

/**
 * Gets the expected budget rule IDs that should exist for a given member.
 * This is used to determine which rules to remove when a member is deleted.
 */
export const getMemberBudgetRuleIds = (member: OnboardingMemberDraft, baseMonth: string): string[] => {
  const ruleIds: string[] = [];
  
  // All members (person and pet) get a baseline rule
  ruleIds.push(buildBasicExpenseFingerprint(member.id));

  if (member.kind === "pet") {
    // Pets get a petcare rule
    ruleIds.push(buildCategoryFingerprint(member.id, "petcare"));
    return ruleIds;
  }

  // For persons, check age to determine additional rules
  const hasAge = Boolean(member.birthMonth?.trim()) || typeof member.ageAtBaseMonth === "number";
  if (!hasAge) {
    return ruleIds;
  }

  const normalizedBaseMonth = normalizeMonthStrict(baseMonth);
  if (!normalizedBaseMonth.ok) {
    return ruleIds;
  }

  const normalizedMember = normalizeMemberForAge(member);
  const ageYears = getMemberAgeYears(
    normalizedMember,
    normalizedBaseMonth.month,
    normalizedBaseMonth.month
  );

  if (ageYears < 18) {
    ruleIds.push(buildCategoryFingerprint(member.id, "childcare"));
  }

  if (ageYears >= 65) {
    ruleIds.push(buildCategoryFingerprint(member.id, "eldercare"));
  }

  return ruleIds;
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

  // Track existing timeline events by ID to avoid duplicates
  const existingEventIds = new Set(
    params.existingTimelineEvents?.map((e) => e.id) ?? []
  );

  params.members.forEach((member) => {
    const basicExpenseFingerprint = buildBasicExpenseFingerprint(member.id);
    if (member.kind === "person") {
      if (!budgetFingerprints.has(basicExpenseFingerprint)) {
        budgetFingerprints.add(basicExpenseFingerprint);
        budgetRulesToUpsert.push({
          id: basicExpenseFingerprint,
          name: getCategoryName("baseline", member.name),
          enabled: true,
          memberId: member.id,
          category: "baseline",
          ageBand: { fromYears: 0, toYears: 120 },
          monthlyAmount: 5000,
          annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
          startMonth: normalizedBaseMonth.month,
          endMonth: "",
          applyScope: buildApplyScope(params.scenarioId),
        });
      }
    }

    if (member.kind === "pet") {
      const fingerprint = buildCategoryFingerprint(member.id, "petcare");
      if (!budgetFingerprints.has(fingerprint)) {
        budgetFingerprints.add(fingerprint);
        budgetRulesToUpsert.push({
          id: fingerprint,
          name: getCategoryName("petcare", member.name),
          enabled: true,
          memberId: member.id,
          category: "petcare",
          ageBand: { fromYears: 0, toYears: 120 },
          monthlyAmount: 3000,
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
          title: member.name ? `${member.name} 薪資` : "薪資",
          memberId: member.id,
          subtype: "salary",
          monthlyAmount: 20000,
          startMonth: normalizedBaseMonth.month,
          endMonth: "",
          endAtAgeYears: 60,
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
          name: getCategoryName("childcare", member.name),
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
          name: getCategoryName("eldercare", member.name),
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

  // Add common default events if they don't already exist
  const houseRentalId = "seed:houseRental";
  if (!existingEventIds.has(houseRentalId)) {
    timelineEventsToUpsert.push({
      id: houseRentalId,
      title: "租屋",
      type: "rent",
      memberId: "household",
      startMonth: normalizedBaseMonth.month,
      endMonth: "",
      monthlyAmount: 12000,
      oneTimeAmount: undefined,
      annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
    });
  }

  const travelId = "seed:travel";
  if (!existingEventIds.has(travelId)) {
    timelineEventsToUpsert.push({
      id: travelId,
      title: "旅行",
      type: "travel",
      memberId: "household",
      startMonth: normalizedBaseMonth.month,
      endMonth: "",
      monthlyAmount: 5000,
      oneTimeAmount: undefined,
      annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
    });
  }

  return { incomesToUpsert, timelineEventsToUpsert, budgetRulesToUpsert };
};

/**
 * Builds default common events for onboarding (house rental, travel, etc.)
 * These are optional and can be pre-added to the onboarding draft
 */
export const buildCommonDefaultEvents = (
  baseMonth: string
): OnboardingTimelineEventDraft[] => {
  const events: OnboardingTimelineEventDraft[] = [];

  // House rental event (monthly)
  events.push({
    id: `seed:houseRental`,
    title: "租屋",
    type: "rent",
    memberId: "household",
    startMonth: baseMonth,
    endMonth: "",
    monthlyAmount: 12000,
    oneTimeAmount: undefined,
    annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
  });

  // Travel/vacation event (one-time)
  events.push({
    id: `seed:travel`,
    title: "旅行",
    type: "travel",
    memberId: "household",
    startMonth: baseMonth,
    endMonth: "",
    monthlyAmount: undefined,
    oneTimeAmount: 50000,
    annualGrowthPct: undefined,
  });

  return events;
};

