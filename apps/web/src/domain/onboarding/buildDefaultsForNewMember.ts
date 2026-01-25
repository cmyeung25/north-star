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

const DAILY_LIVING_EVENT_TITLE = "Daily living expense";

const buildApplyScope = (scenarioId: string): ApplyScope => ({
  scope: "include",
  scenarioIds: [scenarioId],
});

const normalizeMemberId = (memberId?: string | null) =>
  memberId ? memberId : "household";

const buildIncomeFingerprint = (
  memberId?: string | null,
  subtype?: string
) => `${normalizeMemberId(memberId)}:${subtype ?? "salary"}`;

const buildBudgetFingerprint = (
  memberId: string | null | undefined,
  category: BudgetRule["category"]
) => `${normalizeMemberId(memberId)}:${category}`;

const buildEventFingerprint = (memberId?: string | null) =>
  `${normalizeMemberId(memberId)}:dailyLivingExpense`;

const buildExistingIncomeFingerprints = (params: BuildDefaultsForNewMemberParams) => {
  const fingerprints = new Set<string>();

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

const buildExistingBudgetFingerprints = (params: BuildDefaultsForNewMemberParams) => {
  const fingerprints = new Set<string>();

  params.existingBudgetRules?.forEach((rule) => {
    if (!appliesToScenario(rule.applyScope, params.scenarioId)) {
      return;
    }
    fingerprints.add(buildBudgetFingerprint(rule.memberId, rule.category));
  });

  return fingerprints;
};

const buildExistingEventFingerprints = (params: BuildDefaultsForNewMemberParams) => {
  const fingerprints = new Set<string>();

  params.existingEventViews?.forEach((view) => {
    if (view.definition.title === DAILY_LIVING_EVENT_TITLE) {
      fingerprints.add(buildEventFingerprint(view.definition.memberId));
    }
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
  const eventFingerprints = buildExistingEventFingerprints(params);

  const eventDefinitionsToUpsert: EventDefinition[] = [];
  const budgetRulesToUpsert: BudgetRule[] = [];

  const member = params.member;

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
        const fingerprint = buildIncomeFingerprint(member.id, "salary");
        if (!incomeFingerprints.has(fingerprint)) {
          incomeFingerprints.add(fingerprint);
          eventDefinitionsToUpsert.push({
            id: `seed-income-${member.id}-salary`,
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
            endMonth: undefined,
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
            endMonth: undefined,
            applyScope: buildApplyScope(params.scenarioId),
          });
        }
      }
    }
  }

  const dailyLivingFingerprint = buildEventFingerprint("household");
  if (!eventFingerprints.has(dailyLivingFingerprint)) {
    eventDefinitionsToUpsert.push({
      id: "seed-event-household-daily-living",
      title: DAILY_LIVING_EVENT_TITLE,
      type: "custom",
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
    });
  }

  return { eventDefinitionsToUpsert, budgetRulesToUpsert };
};
