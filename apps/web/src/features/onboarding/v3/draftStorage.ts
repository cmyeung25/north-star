import { resolvePlanningHorizonMonths } from "../../../domain/assumptions/planningHorizon";
import { buildAssumptionsPatch } from "../../../domain/onboarding/v2/assumptions";
import type { ScenarioEventDraft } from "../../../domain/scenarioV2/events";
import type { ScenarioSeedPayload } from "../../../scenarios/scenarioSeeds";
import type { ScenarioAssumptions, ScenarioMember } from "../../../store/scenarioStore";
import { buildOnboardingDraftStateFromSeed } from "../seedPrefill";
import {
  getDraftStorageKey as getOnboardingV2DraftStorageKey,
  type DraftStorageState as OnboardingV2DraftStorageState,
} from "../draftStorage";
import type {
  CashAsset,
  InvestmentAsset,
  PropertyAsset,
  ScenarioDraftV3State,
} from "./types";

export const ONBOARDING_V3_DRAFT_STORAGE_KEY_PREFIX = "onboarding:v3:draft";

const EXPENSE_DAILY_TAG = "onboarding:v3:expense:daily-monthly";
const EXPENSE_OTHER_FIXED_TAG = "onboarding:v3:expense:other-fixed";
const EXPENSE_TRAVEL_TAG = "onboarding:v3:expense:travel";
const EXPENSE_TAX_TAG = "onboarding:v3:expense:tax";
const EXPENSE_SOURCE_TAG = "onboarding:v3:expense:source-onboarding";
const INCOME_BONUS_TAG = "onboarding:v3:income:bonus";
const INCOME_SALARY_TAG = "onboarding:v3:income:salary";
const INCOME_SOURCE_TAG = "onboarding:v3:income:source-onboarding";

type DraftStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type AnnualExpenseDraft = OnboardingV2DraftStorageState["livingSpend"]["travel"];
type LegacyMember = OnboardingV2DraftStorageState["household"]["members"][number];

type OnboardingV3PrefillLabels = {
  dailyExpenseLabel: string;
  incomeBonusLabel: string;
  incomeSalaryLabel: string;
  rentExpenseLabel: string;
  taxExpenseLabel: string;
  travelExpenseLabel: string;
};

type ConvertOnboardingV2DraftToV3StateOptions = {
  draftState: OnboardingV2DraftStorageState;
  fallbackState: ScenarioDraftV3State;
  labels: OnboardingV3PrefillLabels;
};

type LoadOnboardingV3DraftStateOptions = {
  fallbackState: ScenarioDraftV3State;
  labels: OnboardingV3PrefillLabels;
  scenarioId?: string;
  storage?: DraftStorageLike;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const getStorage = (storage?: DraftStorageLike) => {
  if (storage) {
    return storage;
  }
  if (typeof window !== "undefined") {
    return window.localStorage;
  }
  return undefined;
};

const resolveMonth = (value: string | undefined, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

const resolveMoneyAmount = (...values: Array<number | null | undefined>) => {
  for (const value of values) {
    if (isFiniteNumber(value)) {
      return value;
    }
  }
  return 0;
};

const resolveGrowthMode = (mode: AnnualExpenseDraft["growthMode"]): "assumption" | "custom" | "none" => {
  if (mode === "custom") {
    return "custom";
  }
  if (mode === "none") {
    return "none";
  }
  return "assumption";
};

const resolveMemberName = (member: LegacyMember, fallbackState: ScenarioDraftV3State) => {
  if (member.name?.trim()) {
    return member.name.trim();
  }
  if (member.id === "self") {
    return fallbackState.members.find((entry) => entry.id === "self")?.name ?? "";
  }
  return "";
};

const mapMembers = (
  draftState: OnboardingV2DraftStorageState,
  fallbackState: ScenarioDraftV3State
): ScenarioMember[] => {
  const members = draftState.household.members.map((member) => ({
    id: member.id,
    kind: member.role === "pet" ? ("pet" as const) : ("person" as const),
    name: resolveMemberName(member, fallbackState),
    birthMonth: member.birthMonth || undefined,
  }));

  if (members.some((member) => member.id === "self")) {
    return members;
  }

  return [...fallbackState.members, ...members];
};

const buildAssumptions = (
  draftState: OnboardingV2DraftStorageState,
  profileStartMonth: string,
  horizonMonths: number
): Partial<ScenarioAssumptions> => {
  const assumptions = buildAssumptionsPatch({
    draft: draftState.assumptions,
  });
  const ownHousing = draftState.housing.own;

  const mortgageTermYears = isFiniteNumber(ownHousing.mortgageTermYears)
    ? ownHousing.mortgageTermYears
    : isFiniteNumber(ownHousing.mortgageTermMonths)
      ? ownHousing.mortgageTermMonths / 12
      : undefined;

  return {
    ...assumptions,
    baseMonth: profileStartMonth,
    horizonMonths,
    mortgageRatePct: isFiniteNumber(ownHousing.mortgageRatePct)
      ? ownHousing.mortgageRatePct
      : undefined,
    mortgageTermYears,
  };
};

const buildCashAsset = (
  draftState: OnboardingV2DraftStorageState,
  profileStartMonth: string,
  baseCurrency: string
): CashAsset | null => {
  const amount = resolveMoneyAmount(draftState.assets.cash.amount);
  if (amount <= 0) {
    return null;
  }

  return {
    id: "prefill-cash",
    assetType: "cash",
    kind: "cash",
    source: "manual",
    currency: baseCurrency,
    startMonth: resolveMonth(draftState.assets.cash.startMonth, profileStartMonth),
    amount,
    currentValue: amount,
  };
};

const buildInvestmentAsset = (
  draftState: OnboardingV2DraftStorageState,
  profileStartMonth: string,
  baseCurrency: string
): InvestmentAsset | null => {
  const totalAmount = resolveMoneyAmount(draftState.assets.investment.totalAmount);
  if (totalAmount <= 0) {
    return null;
  }

  return {
    id: "prefill-investment",
    assetType: "investment",
    kind: "investment",
    source: "manual",
    currency: baseCurrency,
    startMonth: resolveMonth(draftState.assets.investment.startMonth, profileStartMonth),
    principal: totalAmount,
    currentValue: totalAmount,
    returnMode: "assumption",
  };
};

const resolveDownPaymentAmount = (
  propertyMarketValue: number,
  mortgageBaseValue: number,
  draftState: OnboardingV2DraftStorageState
) => {
  const ownHousing = draftState.housing.own;
  if (ownHousing.downPaymentMode === "amount") {
    return resolveMoneyAmount(ownHousing.downPaymentAmount);
  }

  const downPaymentPercent = resolveMoneyAmount(ownHousing.downPaymentPercent);
  const percentBase = propertyMarketValue > 0 ? propertyMarketValue : mortgageBaseValue;
  return (percentBase * downPaymentPercent) / 100;
};

const buildPropertyAsset = (
  draftState: OnboardingV2DraftStorageState,
  profileStartMonth: string,
  baseCurrency: string
): PropertyAsset | null => {
  if (draftState.housing.mode !== "own") {
    return null;
  }

  const ownHousing = draftState.housing.own;
  const propertyMarketValue = resolveMoneyAmount(
    ownHousing.propertyMarketValue,
    ownHousing.propertyValue
  );
  const mortgageBaseValue = resolveMoneyAmount(
    ownHousing.mortgageBaseValue,
    ownHousing.propertyMarketValue,
    ownHousing.propertyValue
  );
  const downPaymentAmount = resolveDownPaymentAmount(
    propertyMarketValue,
    mortgageBaseValue,
    draftState
  );
  const ongoingCosts = ownHousing.ongoingCosts.reduce(
    (sum, cost) => sum + resolveMoneyAmount(cost.amount),
    0
  );
  const hasProperty =
    propertyMarketValue > 0 ||
    mortgageBaseValue > 0 ||
    ownHousing.mortgageEnabled ||
    ongoingCosts > 0 ||
    ownHousing.rental.enabled;

  if (!hasProperty) {
    return null;
  }

  return {
    id: "prefill-property",
    assetType: "property",
    kind: "home",
    source: "manual",
    currency: baseCurrency,
    startMonth: resolveMonth(ownHousing.startMonth, profileStartMonth),
    usage: ownHousing.rental.enabled ? "rent" : "self",
    currentValue: propertyMarketValue,
    rentMonthly: ownHousing.rental.enabled ? resolveMoneyAmount(ownHousing.rental.amount) : undefined,
    mortgagePrincipalOutstanding: ownHousing.mortgageEnabled
      ? Math.max(0, mortgageBaseValue - downPaymentAmount)
      : undefined,
    mortgageAnnualInterestRatePct: isFiniteNumber(ownHousing.mortgageRatePct)
      ? ownHousing.mortgageRatePct
      : undefined,
    mortgageTermYears: isFiniteNumber(ownHousing.mortgageTermYears)
      ? ownHousing.mortgageTermYears
      : undefined,
    mortgageTermMonths: isFiniteNumber(ownHousing.mortgageTermMonths)
      ? ownHousing.mortgageTermMonths
      : undefined,
    holdingCostMonthly: ongoingCosts,
  };
};

const buildIncomeEvents = (
  draftState: OnboardingV2DraftStorageState,
  profileStartMonth: string,
  labels: OnboardingV3PrefillLabels
): ScenarioEventDraft[] =>
  draftState.incomes
    .filter((income) => resolveMoneyAmount(income.amount) > 0)
    .map((income) => {
      const cadence = income.frequency;
      const startMonth = resolveMonth(income.startMonth, profileStartMonth);
      const salaryLike = cadence === "monthly" || cadence === "quarterly";
      const label = income.label.trim() || (salaryLike ? labels.incomeSalaryLabel : labels.incomeBonusLabel);

      return {
        id: `prefill-income-${income.id}`,
        type: "cashflow",
        kind: "income",
        label,
        amount: resolveMoneyAmount(income.amount),
        cadence,
        memberId: income.memberId || undefined,
        startMonth: cadence === "oneOff" ? undefined : startMonth,
        endMonth: cadence === "oneOff" ? undefined : income.endMonth || undefined,
        occurrenceMonth: cadence === "oneOff" ? startMonth : undefined,
        growthMode: income.followIncomeGrowth && cadence !== "oneOff" ? "assumption" : "none",
        tags: [
          salaryLike ? INCOME_SALARY_TAG : INCOME_BONUS_TAG,
          INCOME_SOURCE_TAG,
        ],
        meta: {
          onboardingManualTitle: label,
          onboardingIsCustomTitle: false,
        },
      };
    });

const buildRentExpenseEvent = (
  draftState: OnboardingV2DraftStorageState,
  profileStartMonth: string,
  labels: OnboardingV3PrefillLabels
): ScenarioEventDraft[] => {
  if (
    draftState.housing.mode !== "rent" ||
    draftState.housing.rent.noPayment ||
    resolveMoneyAmount(draftState.housing.rent.amount) <= 0
  ) {
    return [];
  }

  return [
    {
      id: "prefill-expense-rent",
      type: "cashflow",
      kind: "expense",
      label: labels.rentExpenseLabel,
      amount: resolveMoneyAmount(draftState.housing.rent.amount),
      cadence: "monthly",
      startMonth: resolveMonth(draftState.housing.rent.startMonth, profileStartMonth),
      endMonth: draftState.housing.rent.endMonth || undefined,
      growthMode: "assumption",
      growthSource: "rentGrowth",
      tags: [EXPENSE_OTHER_FIXED_TAG, EXPENSE_SOURCE_TAG],
    },
  ];
};

const buildDailyExpenseEvent = (
  draftState: OnboardingV2DraftStorageState,
  profileStartMonth: string,
  labels: OnboardingV3PrefillLabels
): ScenarioEventDraft[] => {
  const dailyAmount = draftState.livingSpend.categoryBreakdown.enabled
    ? Object.values(draftState.livingSpend.categoryBreakdown.categories).reduce(
        (sum, amount) => sum + resolveMoneyAmount(amount),
        0
      ) + resolveMoneyAmount(draftState.livingSpend.variable.amount)
    : resolveMoneyAmount(draftState.livingSpend.fixed.amount) +
      resolveMoneyAmount(draftState.livingSpend.variable.amount);

  if (dailyAmount <= 0) {
    return [];
  }

  return [
    {
      id: "prefill-expense-daily",
      type: "cashflow",
      kind: "expense",
      label: labels.dailyExpenseLabel,
      amount: dailyAmount,
      cadence: "monthly",
      startMonth: resolveMonth(draftState.livingSpend.fixed.startMonth, profileStartMonth),
      endMonth: draftState.livingSpend.fixed.endMonth || undefined,
      growthMode: "assumption",
      growthSource: "inflation",
      tags: [EXPENSE_DAILY_TAG, EXPENSE_SOURCE_TAG],
    },
  ];
};

const buildAnnualExpenseEvent = ({
  draft,
  eventId,
  label,
  profileStartMonth,
  tag,
}: {
  draft: AnnualExpenseDraft;
  eventId: string;
  label: string;
  profileStartMonth: string;
  tag: string;
}): ScenarioEventDraft[] => {
  const growthMode = resolveGrowthMode(draft.growthMode);
  const customGrowthRatePct = growthMode === "custom" && isFiniteNumber(draft.growthRate)
    ? draft.growthRate
    : undefined;

  if (draft.mode === "monthly") {
    const amount = resolveMoneyAmount(draft.monthlyAmount);
    if (amount <= 0) {
      return [];
    }

    return [
      {
        id: eventId,
        type: "cashflow",
        kind: "expense",
        label,
        amount,
        cadence: "monthly",
        startMonth: profileStartMonth,
        growthMode,
        growthSource: "inflation",
        customGrowthRatePct,
        tags: [tag, EXPENSE_SOURCE_TAG],
      },
    ];
  }

  const amount = resolveMoneyAmount(draft.annualAmount);
  const occurrenceMonths = Array.from(new Set(draft.months.filter(Boolean))).sort();
  if (amount <= 0 || occurrenceMonths.length === 0) {
    return [];
  }

  return [
    {
      id: eventId,
      type: "cashflow",
      kind: "expense",
      label,
      amount,
      cadence: "yearly",
      startMonth: occurrenceMonths[0],
      growthMode,
      growthSource: "inflation",
      customGrowthRatePct,
      tags: [tag, EXPENSE_SOURCE_TAG, `allocation:${occurrenceMonths.join(",")}`],
    },
  ];
};

const buildOtherFixedExpenseEvents = (
  draftState: OnboardingV2DraftStorageState,
  profileStartMonth: string
): ScenarioEventDraft[] =>
  draftState.livingSpend.otherFixed
    .filter((item) => item.label.trim().length > 0 && resolveMoneyAmount(item.amount) > 0)
    .map((item) => ({
      id: `prefill-expense-other-${item.id}`,
      type: "cashflow",
      kind: "expense",
      label: item.label.trim(),
      amount: resolveMoneyAmount(item.amount),
      cadence: "monthly",
      startMonth: resolveMonth(item.startMonth, profileStartMonth),
      endMonth: item.endMonth || undefined,
      growthMode: "assumption",
      growthSource: "inflation",
      tags: [EXPENSE_OTHER_FIXED_TAG, EXPENSE_SOURCE_TAG],
    }));

const normalizeDraftState = (
  parsed: Partial<ScenarioDraftV3State>,
  fallbackState: ScenarioDraftV3State
): ScenarioDraftV3State => ({
  profile: {
    baseCurrency:
      parsed.profile?.baseCurrency?.trim() || fallbackState.profile.baseCurrency,
    startMonth: resolveMonth(parsed.profile?.startMonth, fallbackState.profile.startMonth ?? ""),
    horizonMonths: isFiniteNumber(parsed.profile?.horizonMonths)
      ? parsed.profile.horizonMonths
      : fallbackState.profile.horizonMonths,
  },
  assumptions:
    parsed.assumptions && typeof parsed.assumptions === "object"
      ? { ...fallbackState.assumptions, ...parsed.assumptions }
      : fallbackState.assumptions,
  personaFocuses: Array.isArray(parsed.personaFocuses) ? parsed.personaFocuses : fallbackState.personaFocuses,
  members:
    Array.isArray(parsed.members) && parsed.members.length > 0
      ? parsed.members
      : fallbackState.members,
  assets: Array.isArray(parsed.assets) ? parsed.assets : fallbackState.assets,
  assetToggles:
    parsed.assetToggles && typeof parsed.assetToggles === "object"
      ? {
          propertyEnabled:
            parsed.assetToggles.propertyEnabled ??
            fallbackState.assetToggles.propertyEnabled,
          investmentEnabled:
            parsed.assetToggles.investmentEnabled ??
            fallbackState.assetToggles.investmentEnabled,
        }
      : fallbackState.assetToggles,
  events: Array.isArray(parsed.events) ? parsed.events : fallbackState.events,
});

export const getOnboardingV3DraftStorageKey = (scenarioId?: string) =>
  scenarioId
    ? `${ONBOARDING_V3_DRAFT_STORAGE_KEY_PREFIX}:${scenarioId}`
    : ONBOARDING_V3_DRAFT_STORAGE_KEY_PREFIX;

export const convertOnboardingV2DraftToV3State = ({
  draftState,
  fallbackState,
  labels,
}: ConvertOnboardingV2DraftToV3StateOptions): ScenarioDraftV3State => {
  const profileStartMonth = resolveMonth(
    draftState.profile.startMonth,
    fallbackState.profile.startMonth ?? ""
  );
  const horizonMonths = isFiniteNumber(draftState.profile.horizonYears)
    ? resolvePlanningHorizonMonths(draftState.profile.horizonYears)
    : fallbackState.profile.horizonMonths ?? 120;
  const fallbackBaseCurrency = fallbackState.profile.baseCurrency ?? "HKD";
  const baseCurrency = draftState.profile.baseCurrency?.trim() || fallbackBaseCurrency;
  const cashAsset = buildCashAsset(draftState, profileStartMonth, baseCurrency);
  const investmentAsset = buildInvestmentAsset(draftState, profileStartMonth, baseCurrency);
  const propertyAsset = buildPropertyAsset(draftState, profileStartMonth, baseCurrency);

  return {
    profile: {
      baseCurrency,
      startMonth: profileStartMonth,
      horizonMonths,
    },
    assumptions: buildAssumptions(draftState, profileStartMonth, horizonMonths),
    personaFocuses: fallbackState.personaFocuses,
    members: mapMembers(draftState, fallbackState),
    assets: [cashAsset, propertyAsset, investmentAsset].filter(
      (asset): asset is NonNullable<typeof asset> => asset !== null
    ),
    assetToggles: {
      propertyEnabled: propertyAsset !== null,
      investmentEnabled: investmentAsset !== null,
    },
    events: [
      ...buildIncomeEvents(draftState, profileStartMonth, labels),
      ...buildRentExpenseEvent(draftState, profileStartMonth, labels),
      ...buildDailyExpenseEvent(draftState, profileStartMonth, labels),
      ...buildAnnualExpenseEvent({
        draft: draftState.livingSpend.travel,
        eventId: "prefill-expense-travel",
        label: labels.travelExpenseLabel,
        profileStartMonth,
        tag: EXPENSE_TRAVEL_TAG,
      }),
      ...buildAnnualExpenseEvent({
        draft: draftState.livingSpend.tax,
        eventId: "prefill-expense-tax",
        label: labels.taxExpenseLabel,
        profileStartMonth,
        tag: EXPENSE_TAX_TAG,
      }),
      ...buildOtherFixedExpenseEvents(draftState, profileStartMonth),
    ],
  };
};

export const loadOnboardingV3DraftState = ({
  fallbackState,
  labels,
  scenarioId,
  storage,
}: LoadOnboardingV3DraftStateOptions): ScenarioDraftV3State => {
  if (!scenarioId) {
    return fallbackState;
  }

  const draftStorage = getStorage(storage);
  if (!draftStorage) {
    return fallbackState;
  }

  const v3Key = getOnboardingV3DraftStorageKey(scenarioId);
  const storedV3 = draftStorage.getItem(v3Key);
  if (storedV3) {
    try {
      const parsed = JSON.parse(storedV3) as Partial<ScenarioDraftV3State>;
      return normalizeDraftState(parsed, fallbackState);
    } catch (error) {
      console.warn("Failed to parse onboarding v3 draft state", error);
    }
  }

  const storedV2 = draftStorage.getItem(getOnboardingV2DraftStorageKey(scenarioId));
  if (!storedV2) {
    return fallbackState;
  }

  try {
    const parsed = JSON.parse(storedV2) as OnboardingV2DraftStorageState;
    const converted = convertOnboardingV2DraftToV3State({
      draftState: parsed,
      fallbackState,
      labels,
    });
    draftStorage.setItem(v3Key, JSON.stringify(converted));
    return converted;
  } catch (error) {
    console.warn("Failed to parse onboarding v2 draft state for v3 migration", error);
    return fallbackState;
  }
};

export const persistOnboardingV3DraftState = (
  scenarioId: string | undefined,
  draftState: ScenarioDraftV3State,
  storage?: DraftStorageLike
) => {
  if (!scenarioId) {
    return;
  }

  const draftStorage = getStorage(storage);
  if (!draftStorage) {
    return;
  }

  draftStorage.setItem(
    getOnboardingV3DraftStorageKey(scenarioId),
    JSON.stringify(draftState)
  );
};

export const clearOnboardingDraftState = (
  scenarioId: string | undefined,
  storage?: DraftStorageLike
) => {
  if (!scenarioId) {
    return;
  }

  const draftStorage = getStorage(storage);
  if (!draftStorage) {
    return;
  }

  draftStorage.removeItem(getOnboardingV3DraftStorageKey(scenarioId));
  draftStorage.removeItem(getOnboardingV2DraftStorageKey(scenarioId));
};

export const hasPersistedOnboardingDraftState = (
  scenarioId: string | undefined,
  storage?: DraftStorageLike
) => {
  if (!scenarioId) {
    return false;
  }

  const draftStorage = getStorage(storage);
  if (!draftStorage) {
    return false;
  }

  return Boolean(
    draftStorage.getItem(getOnboardingV3DraftStorageKey(scenarioId)) ??
      draftStorage.getItem(getOnboardingV2DraftStorageKey(scenarioId))
  );
};

type ReplaceActiveScenarioOnboardingDraftPresetStateOptions = {
  scenarioId?: string;
  presetPayload: ScenarioSeedPayload;
  fallbackState: ScenarioDraftV3State;
  labels: OnboardingV3PrefillLabels;
  storage?: DraftStorageLike;
};

export const replaceActiveScenarioOnboardingDraftPresetState = ({
  scenarioId,
  presetPayload,
  fallbackState,
  labels,
  storage,
}: ReplaceActiveScenarioOnboardingDraftPresetStateOptions): ScenarioDraftV3State => {
  const draftStorage = getStorage(storage);
  if (!draftStorage || !scenarioId) {
    return fallbackState;
  }

  const legacyDraft = buildOnboardingDraftStateFromSeed(presetPayload);
  draftStorage.removeItem(getOnboardingV3DraftStorageKey(scenarioId));
  draftStorage.setItem(getOnboardingV2DraftStorageKey(scenarioId), JSON.stringify(legacyDraft));

  return loadOnboardingV3DraftState({
    scenarioId,
    fallbackState,
    labels,
    storage: draftStorage,
  });
};

export type { OnboardingV3PrefillLabels };
