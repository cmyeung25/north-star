import { defaultCurrency } from "../../../../lib/i18n";
import type { MoneyItemUpsert } from "../../../../features/moneyFlow/types";
import { addMonths } from "../../members/age";
import type { ApplyScope } from "../../applyScope";
import type { ScenarioMember, ScenarioAssumptions } from "../../../store/scenarioStore";
import { compareMonthKey, isValidMonthKey } from "../../../utils/monthKey";
import {
  type OnboardingV2DraftAssumptions,
  buildAssumptionsPatch,
} from "./assumptions";

export type OnboardingV2MemberRole = "self" | "partner" | "child" | "pet";

export type OnboardingV2DraftMember = {
  id: string;
  role: OnboardingV2MemberRole;
  name?: string;
  birthMonth?: string;
};

export type OnboardingV2DraftProfile = {
  baseCurrency?: string;
  horizonYears?: number;
  startMonth?: string;
};

export type OnboardingV2IncomeFrequency = "monthly" | "quarterly" | "yearly" | "oneOff";

export type OnboardingV2DraftIncome = {
  id: string;
  label: string;
  amount: number;
  frequency: OnboardingV2IncomeFrequency;
  startMonth?: string;
  endMonth?: string;
  memberId?: string;
  followIncomeGrowth: boolean;
};

export type OnboardingV2Draft = {
  profile: OnboardingV2DraftProfile;
  household: {
    members: OnboardingV2DraftMember[];
  };
  assumptions: OnboardingV2DraftAssumptions;
  incomes: OnboardingV2DraftIncome[];
};

export type OnboardingV2IncomeMoneyItem = {
  item: MoneyItemUpsert;
  annualGrowthPct: number;
};

export type OnboardingV2ScenarioChanges = {
  membersToUpsert: ScenarioMember[];
  memberIdsToDelete: string[];
  settingsPatch: {
    baseCurrency?: string;
    horizonMonths?: number;
    startMonth?: string;
  };
  assumptionsPatch: Partial<ScenarioAssumptions>;
  incomeMoneyItems: OnboardingV2IncomeMoneyItem[];
};

const ONBOARDING_MEMBER_ID = /^(self|partner|child-\d+|pet-\d+)$/;
export const ONBOARDING_V2_INCOME_GENERATED_EVENT_ID = "onboarding-v2-income";

const isOnboardingMemberId = (id: string) => ONBOARDING_MEMBER_ID.test(id);

const resolveHorizonMonths = (years?: number) => {
  if (years === 3) {
    return 36;
  }
  if (years === 10) {
    return 120;
  }
  return 60;
};

const normalizeCurrency = (currency?: string) => {
  const trimmed = currency?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : defaultCurrency;
};

const normalizeMonth = (value?: string) =>
  value && isValidMonthKey(value) ? value : undefined;

const normalizeMemberId = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const resolveRangeEndMonth = ({
  startMonth,
  endMonth,
  horizonEnd,
}: {
  startMonth: string;
  endMonth?: string;
  horizonEnd?: string;
}) => {
  if (endMonth && isValidMonthKey(endMonth)) {
    if (compareMonthKey(endMonth, startMonth) < 0) {
      return startMonth;
    }
    return endMonth;
  }
  return horizonEnd ?? startMonth;
};

const buildRecurringMonths = ({
  startMonth,
  endMonth,
  stepMonths,
}: {
  startMonth: string;
  endMonth: string;
  stepMonths: number;
}) => {
  const months: string[] = [];
  let current = startMonth;

  while (compareMonthKey(current, endMonth) <= 0) {
    months.push(current);
    current = addMonths(current, stepMonths);
  }

  return months;
};

const buildIncomeMoneyItems = ({
  incomes,
  baseCurrency,
  baseMonth,
  horizonEnd,
  incomeGrowthPct,
}: {
  incomes: OnboardingV2DraftIncome[];
  baseCurrency: string;
  baseMonth?: string;
  horizonEnd?: string;
  incomeGrowthPct: number;
}): OnboardingV2IncomeMoneyItem[] => {
  const items: OnboardingV2IncomeMoneyItem[] = [];

  incomes.forEach((income) => {
    const label = income.label?.trim();
    if (!label) {
      return;
    }
    if (!Number.isFinite(income.amount) || income.amount <= 0) {
      return;
    }

    const resolvedStart = normalizeMonth(income.startMonth) ?? baseMonth;
    const resolvedEnd = normalizeMonth(income.endMonth);
    const memberId = normalizeMemberId(income.memberId);

    if (!resolvedStart) {
      return;
    }

    if (income.frequency === "monthly") {
      items.push({
        item: {
          kind: "income",
          cadence: "recurring",
          amount: income.amount,
          currency: baseCurrency,
          category: "salary",
          memberId,
          startMonth: resolvedStart,
          endMonth: resolvedEnd,
          notes: label,
          source: "eventGenerated",
          generatedByEventId: ONBOARDING_V2_INCOME_GENERATED_EVENT_ID,
        },
        annualGrowthPct: income.followIncomeGrowth ? incomeGrowthPct : 0,
      });
      return;
    }

    if (income.frequency === "oneOff") {
      items.push({
        item: {
          kind: "income",
          cadence: "oneOff",
          amount: income.amount,
          currency: baseCurrency,
          category: "salary",
          memberId,
          month: resolvedStart,
          notes: label,
          source: "eventGenerated",
          generatedByEventId: ONBOARDING_V2_INCOME_GENERATED_EVENT_ID,
        },
        annualGrowthPct: 0,
      });
      return;
    }

    const endMonth = resolveRangeEndMonth({
      startMonth: resolvedStart,
      endMonth: resolvedEnd,
      horizonEnd,
    });
    const stepMonths = income.frequency === "quarterly" ? 3 : 12;
    const months = buildRecurringMonths({
      startMonth: resolvedStart,
      endMonth,
      stepMonths,
    });

    months.forEach((month) => {
      items.push({
        item: {
          kind: "income",
          cadence: "oneOff",
          amount: income.amount,
          currency: baseCurrency,
          category: "salary",
          memberId,
          month,
          notes: label,
          source: "eventGenerated",
          generatedByEventId: ONBOARDING_V2_INCOME_GENERATED_EVENT_ID,
        },
        annualGrowthPct: 0,
      });
    });
  });

  return items;
};

const buildApplyScope = (scenarioId: string): ApplyScope => ({
  scope: "include",
  scenarioIds: [scenarioId],
});

const parseIndexedName = (id: string) => {
  const match = /-(\d+)$/.exec(id);
  if (!match) {
    return null;
  }
  const index = Number(match[1]);
  return Number.isFinite(index) ? index : null;
};

const fallbackMemberName = (member: OnboardingV2DraftMember) => {
  switch (member.role) {
    case "partner":
      return "伴侶";
    case "child": {
      const index = parseIndexedName(member.id);
      return `子女 ${index ?? ""}`.trim();
    }
    case "pet": {
      const index = parseIndexedName(member.id);
      return `寵物 ${index ?? ""}`.trim();
    }
    case "self":
    default:
      return "主要成員";
  }
};

const normalizeDraftMembers = (members: OnboardingV2DraftMember[]) => {
  const ordered: OnboardingV2DraftMember[] = [];
  const seen = new Set<string>();

  members.forEach((member) => {
    if (!member?.id || seen.has(member.id)) {
      return;
    }
    seen.add(member.id);
    ordered.push(member);
  });

  if (!seen.has("self")) {
    ordered.unshift({ id: "self", role: "self" });
  }

  return ordered;
};

export const mapOnboardingV2DraftToScenario = ({
  draft,
  scenarioId,
  existingMembers,
  existingAssumptions,
}: {
  draft: OnboardingV2Draft;
  scenarioId: string;
  existingMembers: ScenarioMember[];
  existingAssumptions?: ScenarioAssumptions;
}): OnboardingV2ScenarioChanges => {
  const applyScope = buildApplyScope(scenarioId);
  const normalizedMembers = normalizeDraftMembers(draft.household.members);
  const desiredMemberIds = new Set(
    normalizedMembers.map((member) => member.id)
  );

  const membersToUpsert = normalizedMembers.map((member) => ({
    id: member.id,
    name: member.name?.trim() || fallbackMemberName(member),
    kind: member.role === "pet" ? ("pet" as const) : ("person" as const),
    birthMonth: normalizeMonth(member.birthMonth),
    applyScope,
    milestones: [],
  }));

  const memberIdsToDelete = existingMembers
    .map((member) => member.id)
    .filter(
      (id) => isOnboardingMemberId(id) && !desiredMemberIds.has(id)
    );

  const startMonth = normalizeMonth(draft.profile.startMonth);
  const assumptionsPatch = buildAssumptionsPatch({
    draft: draft.assumptions,
    existing: existingAssumptions,
  });
  const incomeGrowthPct =
    typeof assumptionsPatch.salaryGrowthRate === "number"
      ? assumptionsPatch.salaryGrowthRate
      : existingAssumptions?.salaryGrowthRate ?? 0;
  const baseCurrency = normalizeCurrency(draft.profile.baseCurrency);
  const baseMonth = startMonth ?? normalizeMonth(existingAssumptions?.baseMonth ?? "");
  const horizonMonths = resolveHorizonMonths(draft.profile.horizonYears);
  const horizonEnd =
    baseMonth && Number.isFinite(horizonMonths)
      ? addMonths(baseMonth, Math.max(horizonMonths - 1, 0))
      : undefined;
  const incomeMoneyItems = buildIncomeMoneyItems({
    incomes: draft.incomes,
    baseCurrency,
    baseMonth,
    horizonEnd,
    incomeGrowthPct,
  });

  return {
    membersToUpsert,
    memberIdsToDelete,
    settingsPatch: {
      baseCurrency,
      horizonMonths,
      startMonth,
    },
    assumptionsPatch,
    incomeMoneyItems,
  };
};
