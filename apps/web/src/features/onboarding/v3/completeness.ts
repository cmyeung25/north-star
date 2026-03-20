import type { ScenarioEvent, ScenarioEventDraft } from "../../../domain/scenarioV2/events";
import { deriveFromProperty } from "../../../domain/scenarioDraft/rules/deriveFromProperty";
import type { Scenario, ScenarioAsset, ScenarioMember } from "../../../store/scenarioStore";
import type { ScenarioDraftV3State } from "./types";

const AUTO_SALARY_TAG = "onboarding:v3:income:salary:auto";

export type OnboardingCompletenessLevel = "ready" | "needs_attention" | "incomplete";
export type OnboardingCompletenessGroupKey =
  | "household"
  | "income"
  | "fixedExpenses"
  | "housing"
  | "assetsLiabilities";

export type OnboardingCompletenessGroupStatus =
  | "complete"
  | "needs_attention"
  | "incomplete";

export type OnboardingCompletenessInput = {
  draft: ScenarioDraftV3State;
  scenario?: Pick<Scenario, "members" | "assets" | "liabilities" | "events"> | null;
};

export type OnboardingCompletenessGroupSummary = {
  key: OnboardingCompletenessGroupKey;
  stepId: "household" | "income" | "expense" | "assets";
  titleKey: string;
  summaryKey: string;
  status: OnboardingCompletenessGroupStatus;
  score: number;
  evidence: Record<string, number | boolean>;
};

export type OnboardingCompletenessSummary = {
  titleKey: string;
  level: OnboardingCompletenessLevel;
  levelKey: string;
  scorePct: number;
  counts: {
    complete: number;
    needsAttention: number;
    incomplete: number;
  };
  groups: OnboardingCompletenessGroupSummary[];
};

type CashflowLikeEvent = Extract<ScenarioEvent | ScenarioEventDraft, { type: "cashflow" }>;

type HousingSnapshot = {
  hasHousingSignal: boolean;
  hasRentingSignal: boolean;
  hasOwnedPropertySignal: boolean;
  isComplete: boolean;
  needsAttention: boolean;
};

const COMPLETENESS_TITLE_KEY = "completeness.title";

const groupTitleKey = (key: OnboardingCompletenessGroupKey) =>
  `completeness.groups.${key}.title`;

const groupSummaryKey = (
  key: OnboardingCompletenessGroupKey,
  status: OnboardingCompletenessGroupStatus
) => `completeness.groups.${key}.summary.${status}`;

const createGroup = (
  key: OnboardingCompletenessGroupKey,
  stepId: OnboardingCompletenessGroupSummary["stepId"],
  score: number,
  evidence: OnboardingCompletenessGroupSummary["evidence"]
): OnboardingCompletenessGroupSummary => {
  const status = toStatus(score);
  return {
    key,
    stepId,
    titleKey: groupTitleKey(key),
    summaryKey: groupSummaryKey(key, status),
    status,
    score,
    evidence,
  };
};

const toStatus = (score: number): OnboardingCompletenessGroupStatus => {
  if (score >= 1) {
    return "complete";
  }
  if (score > 0) {
    return "needs_attention";
  }
  return "incomplete";
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFinitePositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isCashflowEvent = (
  event: ScenarioEvent | ScenarioEventDraft
): event is CashflowLikeEvent => event.type === "cashflow";

const isConfirmedIncomeEvent = (
  event: ScenarioEvent | ScenarioEventDraft
): event is CashflowLikeEvent =>
  isCashflowEvent(event) &&
  event.kind === "income" &&
  isFinitePositiveNumber(event.amount) &&
  !isAutoSalarySuggestion(event);

const isSuggestedIncomeEvent = (
  event: ScenarioEvent | ScenarioEventDraft
): event is CashflowLikeEvent =>
  isCashflowEvent(event) &&
  event.kind === "income" &&
  isFinitePositiveNumber(event.amount) &&
  isAutoSalarySuggestion(event);

const isRecurringExpenseEvent = (
  event: ScenarioEvent | ScenarioEventDraft
): event is CashflowLikeEvent =>
  isCashflowEvent(event) &&
  event.kind === "expense" &&
  isFinitePositiveNumber(event.amount) &&
  isRecurringCadence(event.cadence);

const isOneOffExpenseEvent = (
  event: ScenarioEvent | ScenarioEventDraft
): event is CashflowLikeEvent =>
  isCashflowEvent(event) &&
  event.kind === "expense" &&
  isFinitePositiveNumber(event.amount) &&
  isOneOffCadence(event.cadence);

const isRentExpenseEvent = (
  event: ScenarioEvent | ScenarioEventDraft
): event is CashflowLikeEvent =>
  isCashflowEvent(event) &&
  event.kind === "expense" &&
  isFinitePositiveNumber(event.amount) &&
  (!Array.isArray(event.tags) ||
    event.tags.includes("onboarding:v3:expense:daily-monthly") === false) &&
  (event.growthSource === "rentGrowth" ||
    event.tags?.includes("onboarding:v3:expense:rent") === true);

const isRecurringCadence = (value: CashflowLikeEvent["cadence"]) =>
  value === "monthly" || value === "quarterly" || value === "yearly" || value === "everyNMonths";

const isOneOffCadence = (value: CashflowLikeEvent["cadence"]) => value === "oneOff";

const isAutoSalarySuggestion = (event: CashflowLikeEvent) =>
  Array.isArray(event.tags) && event.tags.includes(AUTO_SALARY_TAG);

const hasNamedMembers = (members: ScenarioMember[]) =>
  members.length > 0 && members.every((member) => isNonEmptyString(member.name));

const toPropertySnapshot = (
  assets: Array<
    Pick<ScenarioAsset, "kind" | "currentValue" | "startMonth"> & {
      assetType?: string;
      usage?: string;
      rentMonthly?: number;
      mortgagePrincipalOutstanding?: number;
      mortgageAnnualInterestRatePct?: number;
      mortgageTermYears?: number;
      mortgageTermMonths?: number;
    }
  >,
  events: Array<ScenarioEvent | ScenarioEventDraft>
): HousingSnapshot => {
  const propertyAssets = assets.filter((asset) =>
    asset.assetType ? asset.assetType === "property" : asset.kind === "home"
  );
  const rentExpenseEvents = events.filter(isRentExpenseEvent);

  const hasRentingSignal = rentExpenseEvents.length > 0;
  const hasOwnedPropertySignal = propertyAssets.some(
    (asset) =>
      isFinitePositiveNumber(asset.currentValue) ||
      isFinitePositiveNumber(asset.mortgagePrincipalOutstanding) ||
      isFinitePositiveNumber(asset.rentMonthly)
  );

  if (!hasRentingSignal && !hasOwnedPropertySignal) {
    return {
      hasHousingSignal: false,
      hasRentingSignal: false,
      hasOwnedPropertySignal: false,
      isComplete: false,
      needsAttention: false,
    };
  }

  if (hasRentingSignal && !hasOwnedPropertySignal) {
    const rentIsComplete = rentExpenseEvents.some((event) => isNonEmptyString(event.startMonth));
    return {
      hasHousingSignal: true,
      hasRentingSignal: true,
      hasOwnedPropertySignal: false,
      isComplete: rentIsComplete,
      needsAttention: !rentIsComplete,
    };
  }

  const propertyNeedsMortgageDetails = propertyAssets.some((asset) => {
    if (!isFinitePositiveNumber(asset.mortgagePrincipalOutstanding)) {
      return false;
    }
    return !isFinitePositiveNumber(asset.mortgageAnnualInterestRatePct) ||
      (!isFinitePositiveNumber(asset.mortgageTermYears) &&
        !isFinitePositiveNumber(asset.mortgageTermMonths));
  });

  const propertyHasBasics = propertyAssets.some(
    (asset) =>
      isFinitePositiveNumber(asset.currentValue) &&
      isNonEmptyString(asset.startMonth) &&
      (asset.usage === "self" || asset.usage === "rent")
  );

  return {
    hasHousingSignal: true,
    hasRentingSignal,
    hasOwnedPropertySignal,
    isComplete: propertyHasBasics && !propertyNeedsMortgageDetails,
    needsAttention:
      !propertyHasBasics ||
      propertyNeedsMortgageDetails ||
      (hasRentingSignal && !rentExpenseEvents.some((event) => isNonEmptyString(event.startMonth))),
  };
};

export function buildOnboardingCompletenessSummary({
  draft,
  scenario,
}: OnboardingCompletenessInput): OnboardingCompletenessSummary {
  const derived = deriveFromProperty({ profile: draft.profile, assets: draft.assets });
  const draftEvents = draft.events ?? [];
  const mergedEvents = [...derived.events, ...draftEvents];
  const fallbackEvents = scenario?.events ?? [];
  const allEvents = [...mergedEvents, ...fallbackEvents];
  const members = draft.members.length > 0 ? draft.members : (scenario?.members ?? []);
  const allAssets = draft.assets.length > 0 ? draft.assets : ((scenario?.assets ?? []) as typeof draft.assets);
  const allLiabilities = [...derived.liabilities, ...(scenario?.liabilities ?? [])];

  const confirmedIncomeEvents = allEvents.filter(isConfirmedIncomeEvent);
  const suggestedIncomeEvents = allEvents.filter(isSuggestedIncomeEvent);

  const recurringConfirmedIncomeCount = confirmedIncomeEvents.filter((event) =>
    isRecurringCadence(event.cadence)
  ).length;
  const oneOffConfirmedIncomeCount = confirmedIncomeEvents.filter((event) =>
    isOneOffCadence(event.cadence)
  ).length;

  const recurringExpenseCount = allEvents.filter(isRecurringExpenseEvent).length;
  const oneOffExpenseCount = allEvents.filter(isOneOffExpenseEvent).length;

  const housing = toPropertySnapshot(allAssets, allEvents);
  const positiveAssetCount = allAssets.filter((asset) => isFinitePositiveNumber(asset.currentValue)).length;
  const positiveLiabilityCount = allLiabilities.filter((liability) =>
    isFinitePositiveNumber(liability.principalOutstanding)
  ).length;
  const enabledAssetToggleCount = [
    draft.assetToggles.propertyEnabled,
    draft.assetToggles.investmentEnabled,
  ].filter(Boolean).length;

  const groups: OnboardingCompletenessGroupSummary[] = [
    createGroup(
      "household",
      "household",
      hasNamedMembers(members) ? 1 : members.length > 0 ? 0.5 : 0,
      {
        memberCount: members.length,
        namedMemberCount: members.filter((member) => isNonEmptyString(member.name)).length,
      }
    ),
    createGroup(
      "income",
      "income",
      recurringConfirmedIncomeCount > 0
        ? 1
        : oneOffConfirmedIncomeCount > 0 || suggestedIncomeEvents.length > 0
          ? 0.5
          : 0,
      {
        recurringConfirmedIncomeCount,
        oneOffConfirmedIncomeCount,
        suggestedIncomeCount: suggestedIncomeEvents.length,
      }
    ),
    createGroup(
      "fixedExpenses",
      "expense",
      recurringExpenseCount > 0 ? 1 : oneOffExpenseCount > 0 ? 0.5 : 0,
      {
        recurringExpenseCount,
        oneOffExpenseCount,
      }
    ),
    createGroup("housing", "assets", housing.isComplete ? 1 : housing.needsAttention ? 0.5 : 0, {
      hasHousingSignal: housing.hasHousingSignal,
      hasRentingSignal: housing.hasRentingSignal,
      hasOwnedPropertySignal: housing.hasOwnedPropertySignal,
    }),
    createGroup(
      "assetsLiabilities",
      "assets",
      positiveAssetCount > 0 || positiveLiabilityCount > 0 ? 1 : enabledAssetToggleCount > 0 ? 0.5 : 0,
      {
        positiveAssetCount,
        positiveLiabilityCount,
        enabledAssetToggleCount,
      }
    ),
  ];

  const counts = groups.reduce(
    (accumulator, group) => {
      if (group.status === "complete") {
        accumulator.complete += 1;
      } else if (group.status === "needs_attention") {
        accumulator.needsAttention += 1;
      } else {
        accumulator.incomplete += 1;
      }
      return accumulator;
    },
    { complete: 0, needsAttention: 0, incomplete: 0 }
  );

  const scorePct = Math.round(
    (groups.reduce((total, group) => total + group.score, 0) / groups.length) * 100
  );

  let level: OnboardingCompletenessLevel = "needs_attention";
  if (counts.complete === groups.length) {
    level = "ready";
  } else if (counts.incomplete >= 2 || scorePct < 50) {
    level = "incomplete";
  }

  return {
    titleKey: COMPLETENESS_TITLE_KEY,
    level,
    levelKey: `completeness.level.${level}`,
    scorePct,
    counts,
    groups,
  };
}
