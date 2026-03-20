import {
  MEMBER_CASE_PRESET_SEED_IDS,
  type MemberCasePresetSeedId,
} from "../onboarding/seedPrefill";
import type { Locale } from "../../i18n/routing";

type MemberJourneyPolicy = {
  primaryPresetId: MemberCasePresetSeedId | null;
  fallbackToBlank: true;
};

export const MEMBER_JOURNEY_POLICY = {
  officeSaver: {
    primaryPresetId: "single-renter",
    fallbackToBlank: true,
  },
  coupleHome: {
    primaryPresetId: "dual-income-home",
    fallbackToBlank: true,
  },
  newParents: {
    primaryPresetId: "new-baby",
    fallbackToBlank: true,
  },
  mortgageOwner: {
    primaryPresetId: "high-asset",
    fallbackToBlank: true,
  },
} as const satisfies Record<string, MemberJourneyPolicy>;

export const MEMBER_JOURNEY_PRESET_MAP = Object.fromEntries(
  Object.entries(MEMBER_JOURNEY_POLICY).flatMap(([journeyId, policy]) =>
    policy.primaryPresetId ? [[journeyId, policy.primaryPresetId]] : []
  )
) as Record<keyof typeof MEMBER_JOURNEY_POLICY, MemberCasePresetSeedId>;

export type MemberJourneyId = keyof typeof MEMBER_JOURNEY_POLICY;

export type MemberCasesEntryIntent = {
  journey: MemberJourneyId | null;
  presetId: MemberCasePresetSeedId | null;
};

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const AUTH_RETURN_INTENT_STORAGE_KEY = "north-star.member-cases-entry-intent";
const presetAllowlist = new Set<string>(MEMBER_CASE_PRESET_SEED_IDS);
const journeyAllowlist = new Set<string>(Object.keys(MEMBER_JOURNEY_POLICY));

const readParam = (
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
  key: string,
) => {
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get(key);
  }

  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

const isJourneyId = (value: string): value is MemberJourneyId => journeyAllowlist.has(value);

const isAllowlistedPreset = (value: string): value is MemberCasePresetSeedId =>
  presetAllowlist.has(value);

const normalizeMemberCasesEntryIntent = (
  intent: MemberCasesEntryIntent,
): MemberCasesEntryIntent => {
  const journey = intent.journey && isJourneyId(intent.journey) ? intent.journey : null;
  const presetFromQuery =
    intent.presetId && isAllowlistedPreset(intent.presetId) ? intent.presetId : null;
  const presetFromJourney = journey ? MEMBER_JOURNEY_POLICY[journey].primaryPresetId : null;

  return {
    journey,
    presetId: presetFromQuery ?? presetFromJourney ?? null,
  };
};

export function resolveMemberCasesEntryIntent(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): MemberCasesEntryIntent {
  const rawJourney = readParam(searchParams, "journey");
  const rawPreset = readParam(searchParams, "preset");

  return normalizeMemberCasesEntryIntent({
    journey: rawJourney && isJourneyId(rawJourney) ? rawJourney : null,
    presetId: rawPreset && isAllowlistedPreset(rawPreset) ? rawPreset : null,
  });
}

export function buildMemberCasesEntryHref(
  locale: Locale | string,
  intent: MemberCasesEntryIntent,
): string {
  const normalizedIntent = normalizeMemberCasesEntryIntent(intent);
  const params = new URLSearchParams();

  if (normalizedIntent.journey) {
    params.set("journey", normalizedIntent.journey);
  }

  if (normalizedIntent.presetId) {
    params.set("preset", normalizedIntent.presetId);
  }

  const query = params.toString();
  return `/${locale}/member/cases${query ? `?${query}` : ""}`;
}

export function persistMemberCasesAuthReturnIntent(
  intent: MemberCasesEntryIntent,
  storage: StorageLike,
) {
  const normalizedIntent = normalizeMemberCasesEntryIntent(intent);
  storage.setItem(AUTH_RETURN_INTENT_STORAGE_KEY, JSON.stringify(normalizedIntent));
  return normalizedIntent;
}

export function consumeMemberCasesAuthReturnIntent(
  storage: StorageLike,
): MemberCasesEntryIntent | null {
  const rawValue = storage.getItem(AUTH_RETURN_INTENT_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  storage.removeItem(AUTH_RETURN_INTENT_STORAGE_KEY);

  try {
    const parsed = JSON.parse(rawValue) as Partial<MemberCasesEntryIntent>;
    return normalizeMemberCasesEntryIntent({
      journey: parsed.journey ?? null,
      presetId: parsed.presetId ?? null,
    });
  } catch {
    return {
      journey: null,
      presetId: null,
    };
  }
}
