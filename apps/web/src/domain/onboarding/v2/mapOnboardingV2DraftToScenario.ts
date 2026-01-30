import { defaultCurrency } from "../../../../lib/i18n";
import type { ApplyScope } from "../../applyScope";
import type { ScenarioMember } from "../../../store/scenarioStore";
import { isValidMonthKey } from "../../../utils/monthKey";

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

export type OnboardingV2Draft = {
  profile: OnboardingV2DraftProfile;
  household: {
    members: OnboardingV2DraftMember[];
  };
};

export type OnboardingV2ScenarioChanges = {
  membersToUpsert: ScenarioMember[];
  memberIdsToDelete: string[];
  settingsPatch: {
    baseCurrency?: string;
    horizonMonths?: number;
    startMonth?: string;
  };
};

const ONBOARDING_MEMBER_ID = /^(self|partner|child-\d+|pet-\d+)$/;

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
}: {
  draft: OnboardingV2Draft;
  scenarioId: string;
  existingMembers: ScenarioMember[];
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

  return {
    membersToUpsert,
    memberIdsToDelete,
    settingsPatch: {
      baseCurrency: normalizeCurrency(draft.profile.baseCurrency),
      horizonMonths: resolveHorizonMonths(draft.profile.horizonYears),
      startMonth,
    },
  };
};
