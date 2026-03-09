import {
  MEMBER_CASE_PRESET_SEED_IDS,
  type MemberCasePresetSeedId,
} from "../onboarding/seedPrefill";

export const MEMBER_JOURNEY_PRESET_MAP = {
  officeSaver: "single-renter",
  coupleHome: "dual-income-home",
  newParents: "new-baby",
  mortgageOwner: "high-asset",
} as const satisfies Record<string, MemberCasePresetSeedId>;

export type MemberJourneyId = keyof typeof MEMBER_JOURNEY_PRESET_MAP;

export type MemberCasesEntryIntent = {
  journey: MemberJourneyId | null;
  presetId: MemberCasePresetSeedId | null;
};

const presetAllowlist = new Set<string>(MEMBER_CASE_PRESET_SEED_IDS);

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

const isJourneyId = (value: string): value is MemberJourneyId => value in MEMBER_JOURNEY_PRESET_MAP;

const isAllowlistedPreset = (value: string): value is MemberCasePresetSeedId =>
  presetAllowlist.has(value);

export function resolveMemberCasesEntryIntent(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams,
): MemberCasesEntryIntent {
  const rawJourney = readParam(searchParams, "journey");
  const rawPreset = readParam(searchParams, "preset");

  const journey = rawJourney && isJourneyId(rawJourney) ? rawJourney : null;
  const presetFromQuery = rawPreset && isAllowlistedPreset(rawPreset) ? rawPreset : null;

  return {
    journey,
    presetId: presetFromQuery ?? (journey ? MEMBER_JOURNEY_PRESET_MAP[journey] : null),
  };
}

