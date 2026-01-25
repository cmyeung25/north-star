import type { ApplyScope } from "../applyScope";
import type { ScenarioEventView } from "../events/types";
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
  existingEventViews?: ScenarioEventView[];
};

type OnboardingDefaults = {
  incomesToUpsert: OnboardingIncomeDraft[];
  timelineEventsToUpsert: OnboardingTimelineEventDraft[];
  budgetRulesToUpsert: OnboardingBudgetRuleDraft[];
};

const DAILY_LIVING_EVENT_TITLE = "Daily living expense";

const buildApplyScope = (scenarioId: string): ApplyScope => ({
  scope: "include",
  scenarioIds: [scenarioId],
});

const normalizeMemberId = (memberId?: string | null) =>
  memberId ? memberId : "household";

const buildIncomeFingerprint = (
  memberId?: string | null,
  subtype?: OnboardingIncomeDraft["subtype"]
) => `${normalizeMemberId(memberId)}:${subtype ?? "salary"}`;

const buildBudgetFingerprint = (
  memberId: string | null | undefined,
  category: OnboardingBudgetRuleDraft["category"]
) => `${normalizeMemberId(memberId)}:${category}`;

const buildEventFingerprint = (memberId?: string | null) =>
  `${normalizeMemberId(memberId)}:dailyLivingExpense`;

const buildExistingIncomeFingerprints = (params: BuildOnboardingDefaultsParams) => {
  const fingerprints = new Set<string>();

  params.existingIncomes?.forEach((income) => {
    fingerprints.add(buildIncomeFingerprint(income.memberId, income.subtype));
  });

  params.existingEventViews?.forEach((view) => {
    if (view.definition.kind !== "cashflow") {
      return;
    }
    if (!view.definition.incomeSubtype && view.definition.type !== "salary") {
      return;
    }
    fingerprints.add(
      buildIncomeFingerprint(view.definition.memberId, view.definition.incomeSubtype)
    );
  });

  return fingerprints;
};

const buildExistingBudgetFingerprints = (params: BuildOnboardingDefaultsParams) => {
  const fingerprints = new Set<string>();

  params.existingBudgetRules?.forEach((rule) => {
    fingerprints.add(buildBudgetFingerprint(rule.memberId, rule.category));
  });

  return fingerprints;
};

const buildExistingEventFingerprints = (params: BuildOnboardingDefaultsParams) => {
  const fingerprints = new Set<string>();

  params.existingTimelineEvents?.forEach((event) => {
    if (event.title === DAILY_LIVING_EVENT_TITLE) {
      fingerprints.add(buildEventFingerprint(event.memberId ?? "household"));
    }
  });

  params.existingEventViews?.forEach((view) => {
    if (view.definition.title === DAILY_LIVING_EVENT_TITLE) {
      fingerprints.add(buildEventFingerprint(view.definition.memberId));
    }
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
  const eventFingerprints = buildExistingEventFingerprints(params);

  const incomesToUpsert: OnboardingIncomeDraft[] = [];
  const budgetRulesToUpsert: OnboardingBudgetRuleDraft[] = [];
  const timelineEventsToUpsert: OnboardingTimelineEventDraft[] = [];

  params.members.forEach((member) => {
    if (member.kind === "pet") {
      const fingerprint = buildBudgetFingerprint(member.id, "petcare");
      if (!budgetFingerprints.has(fingerprint)) {
        budgetFingerprints.add(fingerprint);
        budgetRulesToUpsert.push({
          id: `seed-budget-${member.id}-petcare`,
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
      const fingerprint = buildIncomeFingerprint(member.id, "salary");
      if (!incomeFingerprints.has(fingerprint)) {
        incomeFingerprints.add(fingerprint);
        incomesToUpsert.push({
          id: `seed-income-${member.id}-salary`,
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
      const fingerprint = buildBudgetFingerprint(member.id, "childcare");
      if (!budgetFingerprints.has(fingerprint)) {
        budgetFingerprints.add(fingerprint);
        budgetRulesToUpsert.push({
          id: `seed-budget-${member.id}-childcare`,
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
      const fingerprint = buildBudgetFingerprint(member.id, "eldercare");
      if (!budgetFingerprints.has(fingerprint)) {
        budgetFingerprints.add(fingerprint);
        budgetRulesToUpsert.push({
          id: `seed-budget-${member.id}-eldercare`,
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

  const dailyLivingFingerprint = buildEventFingerprint("household");
  if (!eventFingerprints.has(dailyLivingFingerprint)) {
    timelineEventsToUpsert.push({
      id: "seed-event-household-daily-living",
      title: DAILY_LIVING_EVENT_TITLE,
      type: "custom",
      memberId: "household",
      startMonth: normalizedBaseMonth.month,
      endMonth: "",
      monthlyAmount: 0,
      oneTimeAmount: 0,
      annualGrowthPct: DEFAULT_ANNUAL_GROWTH_PCT,
    });
  }

  return { incomesToUpsert, timelineEventsToUpsert, budgetRulesToUpsert };
};
