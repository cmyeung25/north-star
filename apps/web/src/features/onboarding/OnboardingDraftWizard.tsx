"use client";

import {
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultCurrency } from "../../../lib/i18n";
import MonthField from "../../../components/MonthField";
import { getCurrentMonth } from "./utils";
import { normalizeMonthStrict } from "../../utils/month";
import { compareMonthKey, isValidMonthKey } from "../../utils/monthKey";
import {
  getActiveScenario,
  useScenarioStore,
} from "../../store/scenarioStore";
import { buildScenarioUrl } from "../../utils/scenarioContext";
import OnboardingV2WizardShell from "./v2/OnboardingV2WizardShell";
import AssumptionsStep from "./v2/AssumptionsStep";
import IncomeStep from "./v2/IncomeStep";
import LivingSpendStep from "./v2/LivingSpendStep";
import HousingStep, { type HousingErrors } from "./v2/HousingStep";
import {
  type OnboardingV2Draft,
  type OnboardingV2DraftIncome,
  type OnboardingV2DraftHousing,
  type OnboardingV2DraftLivingSpend,
  type OnboardingV2DraftMember,
  type OnboardingV2IncomeFrequency,
  type OnboardingV2MemberRole,
  type OnboardingV2ScenarioChanges,
  ONBOARDING_V2_HOUSING_GENERATED_EVENT_ID,
  ONBOARDING_V2_INCOME_GENERATED_EVENT_ID,
  ONBOARDING_V2_LIVING_SPEND_GENERATED_EVENT_ID,
  mapOnboardingV2DraftToScenario,
} from "../../domain/onboarding/v2/mapOnboardingV2DraftToScenario";
import type { EventDefinition } from "../../domain/events/types";
import { createEventId } from "../../../components/timeline/utils";
import {
  type OnboardingV2DraftAssumptions,
  buildOnboardingAssumptionsDraft,
  mergeOnboardingAssumptionsDraft,
} from "../../domain/onboarding/v2/assumptions";
import { upsertMoneyItem } from "../../../features/moneyFlow/moneyFlowAdapter";
import { applyAssetItemChange } from "../../../features/assets/assetAdapter";
import { applyLiabilityItemChange } from "../../../features/liabilities/liabilityAdapter";

const steps = [
  "profile",
  "household",
  "assumptions",
  "income",
  "livingSpend",
  "housing",
  "result",
] as const;

const DRAFT_STORAGE_KEY = "onboarding:v2:draft";

type HorizonYears = 3 | 5 | 10;

type DraftProfileState = {
  baseCurrency: string;
  startMonth: string;
  horizonYears: HorizonYears;
};

type DraftHouseholdState = {
  hasPartner: boolean;
  childCount: number;
  petCount: number;
  members: OnboardingV2DraftMember[];
};

type DraftStorageState = {
  step: number;
  profile: DraftProfileState;
  household: DraftHouseholdState;
  assumptions: OnboardingV2DraftAssumptions;
  incomes: OnboardingV2DraftIncome[];
  livingSpend: OnboardingV2DraftLivingSpend;
  housing: OnboardingV2DraftHousing;
};

const clampCount = (value: number | null | undefined) =>
  Math.max(0, Math.floor(value ?? 0));

const buildMember = (
  id: string,
  role: OnboardingV2MemberRole,
  existing?: OnboardingV2DraftMember
): OnboardingV2DraftMember => ({
  id,
  role,
  name: existing?.name ?? "",
  birthMonth: existing?.birthMonth ?? "",
});

const buildHouseholdMembers = ({
  hasPartner,
  childCount,
  petCount,
  existingMembers,
}: {
  hasPartner: boolean;
  childCount: number;
  petCount: number;
  existingMembers: OnboardingV2DraftMember[];
}): OnboardingV2DraftMember[] => {
  const existingById = new Map(
    existingMembers.map((member) => [member.id, member])
  );
  const members: OnboardingV2DraftMember[] = [];

  members.push(buildMember("self", "self", existingById.get("self")));

  if (hasPartner) {
    members.push(buildMember("partner", "partner", existingById.get("partner")));
  }

  for (let index = 1; index <= childCount; index += 1) {
    const id = `child-${index}`;
    members.push(buildMember(id, "child", existingById.get(id)));
  }

  for (let index = 1; index <= petCount; index += 1) {
    const id = `pet-${index}`;
    members.push(buildMember(id, "pet", existingById.get(id)));
  }

  return members;
};

const resolveIncomeFrequency = (
  value?: string
): OnboardingV2IncomeFrequency =>
  value === "monthly" || value === "quarterly" || value === "yearly" || value === "oneOff"
    ? value
    : "monthly";

const buildIncomeDraft = ({
  id,
  startMonth,
  existing,
}: {
  id: string;
  startMonth: string;
  existing?: Partial<OnboardingV2DraftIncome>;
}): OnboardingV2DraftIncome => ({
  id,
  label: existing?.label ?? "",
  amount: typeof existing?.amount === "number" ? existing.amount : 0,
  frequency: resolveIncomeFrequency(existing?.frequency),
  startMonth: existing?.startMonth ?? startMonth,
  endMonth: existing?.endMonth ?? "",
  memberId: existing?.memberId ?? "",
  followIncomeGrowth: existing?.followIncomeGrowth !== false,
});

const normalizeDraftIncomes = ({
  existingIncomes,
  fallbackStartMonth,
}: {
  existingIncomes?: OnboardingV2DraftIncome[];
  fallbackStartMonth: string;
}) => {
  const incomes = Array.isArray(existingIncomes) ? existingIncomes : [];
  return incomes.map((income) =>
    buildIncomeDraft({
      id: income.id || `income-${nanoid(6)}`,
      startMonth: fallbackStartMonth,
      existing: income,
    })
  );
};

const normalizeAnnualExpenseDraft = (
  existing?: Partial<OnboardingV2DraftLivingSpend["travel"]>
): OnboardingV2DraftLivingSpend["travel"] => ({
  mode: existing?.mode === "annual" ? "annual" : "monthly",
  monthlyAmount:
    typeof existing?.monthlyAmount === "number" ? existing.monthlyAmount : 0,
  annualAmount:
    typeof existing?.annualAmount === "number" ? existing.annualAmount : 0,
  months: Array.isArray(existing?.months)
    ? existing.months.filter((month) => isValidMonthKey(month))
    : [],
});

const buildLivingSpendDraft = ({
  baseMonth,
  existing,
}: {
  baseMonth: string;
  existing?: Partial<OnboardingV2DraftLivingSpend>;
}): OnboardingV2DraftLivingSpend => {
  const categories = existing?.categoryBreakdown?.categories;
  const normalizeAmount = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  return {
    fixed: {
      amount: normalizeAmount(existing?.fixed?.amount),
      startMonth: existing?.fixed?.startMonth ?? baseMonth,
      endMonth: existing?.fixed?.endMonth ?? "",
    },
    variable: {
      amount: normalizeAmount(existing?.variable?.amount),
    },
    categoryBreakdown: {
      enabled: existing?.categoryBreakdown?.enabled ?? false,
      categories: {
        food: normalizeAmount(categories?.food),
        transport: normalizeAmount(categories?.transport),
        entertainment: normalizeAmount(categories?.entertainment),
        medical: normalizeAmount(categories?.medical),
        education: normalizeAmount(categories?.education),
        misc: normalizeAmount(categories?.misc),
      },
    },
    travel: normalizeAnnualExpenseDraft(existing?.travel),
    tax: normalizeAnnualExpenseDraft(existing?.tax),
    otherFixed: Array.isArray(existing?.otherFixed)
      ? existing.otherFixed.map((item) => ({
          id: item.id || `living-${nanoid(6)}`,
          label: item.label ?? "",
          amount: normalizeAmount(item.amount),
          startMonth: item.startMonth ?? baseMonth,
          endMonth: item.endMonth ?? "",
        }))
      : [],
  };
};

const buildHousingDraft = ({
  baseMonth,
  existing,
}: {
  baseMonth: string;
  existing?: Partial<OnboardingV2DraftHousing>;
}): OnboardingV2DraftHousing => {
  const toNumber = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const toOptional = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  return {
    mode: existing?.mode === "own" ? "own" : "rent",
    rent: {
      amount: toNumber(existing?.rent?.amount),
      startMonth: existing?.rent?.startMonth ?? baseMonth,
      endMonth: existing?.rent?.endMonth ?? "",
      rentGrowthPct: toOptional(existing?.rent?.rentGrowthPct),
    },
    own: {
      propertyValue: toNumber(existing?.own?.propertyValue),
      startMonth: existing?.own?.startMonth ?? baseMonth,
      downPaymentMode:
        existing?.own?.downPaymentMode === "amount" ? "amount" : "percent",
      downPaymentPercent: toNumber(existing?.own?.downPaymentPercent),
      downPaymentAmount: toNumber(existing?.own?.downPaymentAmount),
      mortgageEnabled: existing?.own?.mortgageEnabled ?? true,
      mortgageRatePct: toNumber(existing?.own?.mortgageRatePct ?? 4),
      mortgageTermMonths: toNumber(existing?.own?.mortgageTermMonths ?? 360),
      mortgagePayment: toNumber(existing?.own?.mortgagePayment),
      fees: Array.isArray(existing?.own?.fees) ? existing?.own?.fees : [],
      ongoingCosts: Array.isArray(existing?.own?.ongoingCosts)
        ? existing?.own?.ongoingCosts
        : [],
      rental: {
        enabled: existing?.own?.rental?.enabled ?? false,
        amount: toNumber(existing?.own?.rental?.amount),
        startMonth: existing?.own?.rental?.startMonth ?? baseMonth,
        endMonth: existing?.own?.rental?.endMonth ?? "",
        discountAmount: toNumber(existing?.own?.rental?.discountAmount),
      },
    },
  };
};

const buildIncomeEventDefinition = (
  entry: OnboardingV2ScenarioChanges["incomeMoneyItems"][number],
  baseCurrency: string
): EventDefinition => ({
  id: createEventId(),
  title: entry.item.notes?.trim() || "Income",
  type: "salary",
  kind: "cashflow",
  rule: {
    mode: "params",
    startMonth:
      entry.item.cadence === "recurring"
        ? entry.item.startMonth ?? ""
        : entry.item.month ?? "",
    endMonth: entry.item.cadence === "recurring" ? entry.item.endMonth ?? null : null,
    monthlyAmount: entry.item.cadence === "recurring" ? entry.item.amount : 0,
    oneTimeAmount: entry.item.cadence === "oneOff" ? entry.item.amount : 0,
    annualGrowthPct:
      entry.item.cadence === "recurring" ? entry.annualGrowthPct : 0,
  },
  currency: entry.item.currency ?? baseCurrency,
  memberId: entry.item.memberId,
  generatedByEventId: entry.item.generatedByEventId,
  source: entry.item.source,
});

const getInitialDraftState = ({
  baseCurrency,
  assumptions,
}: {
  baseCurrency: string;
  assumptions?: OnboardingV2DraftAssumptions;
}): DraftStorageState => {
  const assumptionsFallback =
    assumptions ?? buildOnboardingAssumptionsDraft(undefined);
  const fallback: DraftStorageState = {
    step: 0,
    profile: {
      baseCurrency,
      startMonth: "",
      horizonYears: 5,
    },
    household: {
      hasPartner: false,
      childCount: 0,
      petCount: 0,
      members: buildHouseholdMembers({
        hasPartner: false,
        childCount: 0,
        petCount: 0,
        existingMembers: [],
      }),
    },
    assumptions: assumptionsFallback,
    incomes: [],
    livingSpend: buildLivingSpendDraft({
      baseMonth: getCurrentMonth(),
    }),
    housing: buildHousingDraft({ baseMonth: getCurrentMonth() }),
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) {
      return fallback;
    }
    const parsed = JSON.parse(stored) as Partial<DraftStorageState>;
    const profile: DraftProfileState = {
      baseCurrency:
        parsed.profile?.baseCurrency?.trim() || fallback.profile.baseCurrency,
      startMonth: parsed.profile?.startMonth ?? fallback.profile.startMonth,
      horizonYears:
        parsed.profile?.horizonYears === 3 ||
        parsed.profile?.horizonYears === 5 ||
        parsed.profile?.horizonYears === 10
          ? parsed.profile.horizonYears
          : fallback.profile.horizonYears,
    };
    const household: DraftHouseholdState = {
      hasPartner: parsed.household?.hasPartner ?? fallback.household.hasPartner,
      childCount: clampCount(parsed.household?.childCount),
      petCount: clampCount(parsed.household?.petCount),
      members: buildHouseholdMembers({
        hasPartner: parsed.household?.hasPartner ?? false,
        childCount: clampCount(parsed.household?.childCount),
        petCount: clampCount(parsed.household?.petCount),
        existingMembers: parsed.household?.members ?? [],
      }),
    };
    const assumptions = mergeOnboardingAssumptionsDraft(
      fallback.assumptions,
      parsed.assumptions
    );
    const incomes = normalizeDraftIncomes({
      existingIncomes: parsed.incomes,
      fallbackStartMonth: profile.startMonth ?? fallback.profile.startMonth,
    });
    const livingSpend = buildLivingSpendDraft({
      baseMonth: profile.startMonth || fallback.profile.startMonth || getCurrentMonth(),
      existing: parsed.livingSpend,
    });
    const housing = buildHousingDraft({
      baseMonth: profile.startMonth || fallback.profile.startMonth || getCurrentMonth(),
      existing: parsed.housing,
    });

    return {
      step: typeof parsed.step === "number" ? parsed.step : fallback.step,
      profile,
      household,
      assumptions,
      incomes,
      livingSpend,
      housing,
    };
  } catch (error) {
    console.warn("Failed to parse onboarding draft state", error);
    return fallback;
  }
};

const getMemberLabel = (
  t: (key: string, values?: Record<string, number>) => string,
  member: OnboardingV2DraftMember
) => {
  if (member.role === "self") {
    return t("memberRoleSelf");
  }
  if (member.role === "partner") {
    return t("memberRolePartner");
  }
  if (member.role === "child") {
    const index = Number(member.id.split("-")[1] ?? 0);
    return t("memberRoleChild", { index });
  }
  const index = Number(member.id.split("-")[1] ?? 0);
  return t("memberRolePet", { index });
};

const normalizeHouseholdCounts = (
  current: DraftHouseholdState,
  patch: Partial<Pick<DraftHouseholdState, "hasPartner" | "childCount" | "petCount">>
): DraftHouseholdState => {
  const hasPartner = patch.hasPartner ?? current.hasPartner;
  const childCount =
    patch.childCount !== undefined ? clampCount(patch.childCount) : current.childCount;
  const petCount =
    patch.petCount !== undefined ? clampCount(patch.petCount) : current.petCount;

  return {
    hasPartner,
    childCount,
    petCount,
    members: buildHouseholdMembers({
      hasPartner,
      childCount,
      petCount,
      existingMembers: current.members,
    }),
  };
};

export default function OnboardingDraftWizard() {
  const t = useTranslations("onboardingDraft");
  const locale = useLocale();
  const router = useRouter();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const membersStore = useScenarioStore((state) => state.members);
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );
  const addEventToScenarios = useScenarioStore((state) => state.addEventToScenarios);
  const cleanupGeneratedEntities = useScenarioStore(
    (state) => state.cleanupGeneratedEntities
  );
  const createBudgetRule = useScenarioStore((state) => state.createBudgetRule);
  const updateBudgetRule = useScenarioStore((state) => state.updateBudgetRule);
  const updateEventDefinition = useScenarioStore((state) => state.updateEventDefinition);
  const updateScenarioClientComputed = useScenarioStore(
    (state) => state.updateScenarioClientComputed
  );
  const updateScenarioMeta = useScenarioStore((state) => state.updateScenarioMeta);
  const updateScenarioBaseCurrency = useScenarioStore(
    (state) => state.updateScenarioBaseCurrency
  );
  const setScenarioPositions = useScenarioStore((state) => state.setScenarioPositions);
  const createMember = useScenarioStore((state) => state.createMember);
  const updateMember = useScenarioStore((state) => state.updateMember);
  const deleteMember = useScenarioStore((state) => state.deleteMember);
  const scenario = useMemo(
    () => getActiveScenario(scenarios, activeScenarioId),
    [activeScenarioId, scenarios]
  );
  const initialState = useMemo(
    () =>
      getInitialDraftState({
        baseCurrency: scenario?.baseCurrency ?? defaultCurrency,
        assumptions: buildOnboardingAssumptionsDraft(scenario?.assumptions),
      }),
    [scenario?.assumptions, scenario?.baseCurrency]
  );
  const [step, setStep] = useState(
    Math.min(initialState.step, steps.length - 1)
  );
  const [profile, setProfile] = useState<DraftProfileState>(
    initialState.profile
  );
  const [household, setHousehold] = useState<DraftHouseholdState>(
    initialState.household
  );
  const [assumptions, setAssumptions] = useState<OnboardingV2DraftAssumptions>(
    initialState.assumptions
  );
  const [incomes, setIncomes] = useState<OnboardingV2DraftIncome[]>(
    initialState.incomes
  );
  const [livingSpend, setLivingSpend] = useState<OnboardingV2DraftLivingSpend>(
    initialState.livingSpend
  );
  const [housing, setHousing] = useState<OnboardingV2DraftHousing>(
    initialState.housing
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const payload: DraftStorageState = {
      step,
      profile,
      household,
      assumptions,
      incomes,
      livingSpend,
      housing,
    };
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
  }, [assumptions, household, housing, incomes, livingSpend, profile, step]);

  const resolvedBaseMonth = useMemo(() => {
    const raw = appSettings.globalBaseMonth ?? getCurrentMonth();
    const normalized = normalizeMonthStrict(raw);
    return normalized.ok ? normalized.month : getCurrentMonth();
  }, [appSettings.globalBaseMonth]);

  const scenarioId = scenario?.id ?? "";
  const currencyOptions = useMemo(() => {
    const options = new Set(
      [
        profile.baseCurrency,
        scenario?.baseCurrency,
        defaultCurrency,
        "USD",
        "HKD",
        "CNY",
        "EUR",
        "GBP",
        "JPY",
        "SGD",
        "AUD",
      ].filter(Boolean)
    );

    return Array.from(options).map((value) => ({ value, label: value }));
  }, [profile.baseCurrency, scenario?.baseCurrency]);

  const selfMember = household.members.find((member) => member.id === "self");
  const selfBirthMonth = selfMember?.birthMonth ?? "";

  const profileErrors = {
    birthMonth: !selfBirthMonth
      ? t("requiredField")
      : isValidMonthKey(selfBirthMonth)
        ? ""
        : t("monthInvalid"),
    startMonth:
      profile.startMonth && !isValidMonthKey(profile.startMonth)
        ? t("monthInvalid")
        : "",
    baseCurrency: profile.baseCurrency.trim()
      ? ""
      : t("requiredField"),
  };

  const hasProfileError = Object.values(profileErrors).some((value) => value);

  const memberMonthErrors = household.members.reduce<Record<string, string>>(
    (acc, member) => {
      if (member.birthMonth && !isValidMonthKey(member.birthMonth)) {
        acc[member.id] = t("monthInvalid");
      }
      return acc;
    },
    {}
  );
  const hasMemberMonthErrors = Object.keys(memberMonthErrors).length > 0;

  const assumptionsErrors: Partial<
    Record<keyof OnboardingV2DraftAssumptions, string>
  > = {
    inflationPct:
      assumptions.inflationPct === null ? t("requiredField") : "",
    incomeGrowthPct:
      assumptions.incomeGrowthPct === null ? t("requiredField") : "",
    investmentReturnPct:
      assumptions.investmentReturnPct === null ? t("requiredField") : "",
  };

  const hasAssumptionErrors = Object.values(assumptionsErrors).some(
    (value) => value
  );

  const incomeErrors = incomes.reduce<
    Record<
      string,
      Partial<{
        label: string;
        amount: string;
        startMonth: string;
        endMonth: string;
      }>
    >
  >((acc, income) => {
    const errors: Partial<{
      label: string;
      amount: string;
      startMonth: string;
      endMonth: string;
    }> = {};
    if (!income.label.trim()) {
      errors.label = t("incomeNameRequired");
    }
    if (!Number.isFinite(income.amount) || income.amount <= 0) {
      errors.amount = t("incomeAmountRequired");
    }
    if (!income.startMonth) {
      errors.startMonth = t("incomeStartMonthRequired");
    } else if (!isValidMonthKey(income.startMonth)) {
      errors.startMonth = t("monthInvalid");
    }
    if (income.frequency !== "oneOff" && income.endMonth) {
      if (!isValidMonthKey(income.endMonth)) {
        errors.endMonth = t("monthInvalid");
      } else if (
        income.startMonth &&
        isValidMonthKey(income.startMonth) &&
        compareMonthKey(income.startMonth, income.endMonth) > 0
      ) {
        errors.endMonth = t("incomeEndMonthBeforeStart");
      }
    }
    if (Object.keys(errors).length > 0) {
      acc[income.id] = errors;
    }
    return acc;
  }, {});

  const hasIncomeErrors = Object.keys(incomeErrors).length > 0;

  const livingSpendErrors: {
    fixed: Partial<{ amount: string; startMonth: string; endMonth: string }>;
    travel: Partial<{ months: string }>;
    tax: Partial<{ months: string }>;
    otherFixed: Record<
      string,
      Partial<{ label: string; amount: string; startMonth: string; endMonth: string }>
    >;
  } = {
    fixed: {},
    travel: {},
    tax: {},
    otherFixed: {},
  };

  if (!Number.isFinite(livingSpend.fixed.amount) || livingSpend.fixed.amount <= 0) {
    livingSpendErrors.fixed.amount = t("livingFixedAmountRequired");
  }

  if (!livingSpend.fixed.startMonth) {
    livingSpendErrors.fixed.startMonth = t("livingFixedStartMonthRequired");
  }

  const fixedStartMonth = livingSpend.fixed.startMonth ?? "";
  const fixedStartValid = isValidMonthKey(fixedStartMonth);
  if (livingSpend.fixed.startMonth && !fixedStartValid) {
    livingSpendErrors.fixed.startMonth = t("monthInvalid");
  }

  if (livingSpend.fixed.endMonth) {
    if (!isValidMonthKey(livingSpend.fixed.endMonth)) {
      livingSpendErrors.fixed.endMonth = t("monthInvalid");
    } else if (
      fixedStartValid &&
      compareMonthKey(fixedStartMonth, livingSpend.fixed.endMonth) > 0
    ) {
      livingSpendErrors.fixed.endMonth = t("livingEndMonthBeforeStart");
    }
  }

  const validateAnnualMonths = (entry: OnboardingV2DraftLivingSpend["travel"]) => {
    if (entry.mode === "annual" && entry.annualAmount > 0 && entry.months.length === 0) {
      return t("livingAnnualMonthsRequired");
    }
    return "";
  };

  livingSpendErrors.travel.months = validateAnnualMonths(livingSpend.travel);
  livingSpendErrors.tax.months = validateAnnualMonths(livingSpend.tax);

  livingSpend.otherFixed.forEach((item) => {
    const entryErrors: Partial<{
      label: string;
      amount: string;
      startMonth: string;
      endMonth: string;
    }> = {};
    const hasAny =
      item.label.trim() ||
      item.amount > 0 ||
      item.startMonth ||
      item.endMonth;

    if (!hasAny) {
      return;
    }

    if (!item.label.trim()) {
      entryErrors.label = t("livingOtherLabelRequired");
    }
    if (!Number.isFinite(item.amount) || item.amount <= 0) {
      entryErrors.amount = t("livingOtherAmountRequired");
    }
    const startMonthValue = item.startMonth ?? "";
    const startMonthValid = isValidMonthKey(startMonthValue);
    if (!item.startMonth) {
      entryErrors.startMonth = t("livingOtherStartMonthRequired");
    } else if (!startMonthValid) {
      entryErrors.startMonth = t("monthInvalid");
    }
    if (item.endMonth) {
      if (!isValidMonthKey(item.endMonth)) {
        entryErrors.endMonth = t("monthInvalid");
      } else if (
        startMonthValid &&
        compareMonthKey(startMonthValue, item.endMonth) > 0
      ) {
        entryErrors.endMonth = t("livingEndMonthBeforeStart");
      }
    }

    if (Object.keys(entryErrors).length > 0) {
      livingSpendErrors.otherFixed[item.id] = entryErrors;
    }
  });

  const hasLivingSpendErrors =
    Object.values(livingSpendErrors.fixed).some((value) => value) ||
    Object.values(livingSpendErrors.travel).some((value) => value) ||
    Object.values(livingSpendErrors.tax).some((value) => value) ||
    Object.keys(livingSpendErrors.otherFixed).length > 0;

  const housingErrors: HousingErrors = {
    rent: {},
    own: {
      fees: {},
      ongoingCosts: {},
      rental: {},
    },
  };

  if (housing.mode === "rent") {
    if (!Number.isFinite(housing.rent.amount) || housing.rent.amount <= 0) {
      housingErrors.rent.amount = t("housingRentAmountRequired");
    }
    if (!housing.rent.startMonth) {
      housingErrors.rent.startMonth = t("housingRentStartMonthRequired");
    } else if (!isValidMonthKey(housing.rent.startMonth)) {
      housingErrors.rent.startMonth = t("monthInvalid");
    }
    if (housing.rent.endMonth) {
      if (!isValidMonthKey(housing.rent.endMonth)) {
        housingErrors.rent.endMonth = t("monthInvalid");
      } else if (
        housing.rent.startMonth &&
        compareMonthKey(housing.rent.startMonth, housing.rent.endMonth) > 0
      ) {
        housingErrors.rent.endMonth = t("livingEndMonthBeforeStart");
      }
    }
  }

  if (housing.mode === "own") {
    if (!Number.isFinite(housing.own.propertyValue) || housing.own.propertyValue <= 0) {
      housingErrors.own.propertyValue = t("housingPropertyValueRequired");
    }
    if (!housing.own.startMonth) {
      housingErrors.own.startMonth = t("housingPropertyStartMonthRequired");
    } else if (!isValidMonthKey(housing.own.startMonth)) {
      housingErrors.own.startMonth = t("monthInvalid");
    }

    if (housing.own.mortgageEnabled) {
      const mortgageRatePct = housing.own.mortgageRatePct ?? NaN;
      const mortgageTermMonths = housing.own.mortgageTermMonths ?? NaN;
      const mortgagePayment = housing.own.mortgagePayment ?? NaN;

      if (!Number.isFinite(mortgageRatePct) || mortgageRatePct < 0) {
        housingErrors.own.mortgageRatePct = t("housingMortgageRateRequired");
      }
      if (!Number.isFinite(mortgageTermMonths) || mortgageTermMonths <= 0) {
        housingErrors.own.mortgageTermMonths = t("housingMortgageTermRequired");
      }
      if (!Number.isFinite(mortgagePayment) || mortgagePayment <= 0) {
        housingErrors.own.mortgagePayment = t("housingMortgagePaymentRequired");
      }
    }

    housing.own.fees.forEach((fee) => {
      const entryErrors: NonNullable<HousingErrors["own"]["fees"][string]> = {};
      if (!fee.label?.trim()) {
        entryErrors.label = t("requiredField");
      }
      if (!Number.isFinite(fee.amount) || fee.amount <= 0) {
        entryErrors.amount = t("requiredField");
      }
      if (!fee.month) {
        entryErrors.month = t("requiredField");
      } else if (!isValidMonthKey(fee.month)) {
        entryErrors.month = t("monthInvalid");
      }
      if (Object.keys(entryErrors).length > 0) {
        housingErrors.own.fees[fee.id] = entryErrors;
      }
    });

    housing.own.ongoingCosts.forEach((cost) => {
      const entryErrors: NonNullable<HousingErrors["own"]["ongoingCosts"][string]> = {};
      if (!cost.label?.trim()) {
        entryErrors.label = t("requiredField");
      }
      if (!Number.isFinite(cost.amount) || cost.amount <= 0) {
        entryErrors.amount = t("requiredField");
      }
      if (!cost.startMonth) {
        entryErrors.startMonth = t("requiredField");
      } else if (!isValidMonthKey(cost.startMonth)) {
        entryErrors.startMonth = t("monthInvalid");
      }
      if (cost.endMonth) {
        if (!isValidMonthKey(cost.endMonth)) {
          entryErrors.endMonth = t("monthInvalid");
        } else if (
          cost.startMonth &&
          compareMonthKey(cost.startMonth, cost.endMonth) > 0
        ) {
          entryErrors.endMonth = t("livingEndMonthBeforeStart");
        }
      }
      if (Object.keys(entryErrors).length > 0) {
        housingErrors.own.ongoingCosts[cost.id] = entryErrors;
      }
    });

    if (housing.own.rental.enabled) {
      if (!Number.isFinite(housing.own.rental.amount) || housing.own.rental.amount <= 0) {
        housingErrors.own.rental.amount = t("housingRentalAmountRequired");
      }
      if (!housing.own.rental.startMonth) {
        housingErrors.own.rental.startMonth = t("housingRentalStartMonthRequired");
      } else if (!isValidMonthKey(housing.own.rental.startMonth)) {
        housingErrors.own.rental.startMonth = t("monthInvalid");
      }
      if (housing.own.rental.endMonth) {
        if (!isValidMonthKey(housing.own.rental.endMonth)) {
          housingErrors.own.rental.endMonth = t("monthInvalid");
        } else if (
          housing.own.rental.startMonth &&
          compareMonthKey(housing.own.rental.startMonth, housing.own.rental.endMonth) > 0
        ) {
          housingErrors.own.rental.endMonth = t("livingEndMonthBeforeStart");
        }
      }
    }
  }

  const hasHousingErrors =
    Object.values(housingErrors.rent).some((value) => value) ||
    Object.values(housingErrors.own).some(
      (value) => typeof value === "string" && value.length > 0
    ) ||
    Object.keys(housingErrors.own.fees).length > 0 ||
    Object.keys(housingErrors.own.ongoingCosts).length > 0 ||
    Object.values(housingErrors.own.rental).some((value) => value);

  const canProceed =
    !hasProfileError &&
    !hasMemberMonthErrors &&
    !hasAssumptionErrors &&
    !hasIncomeErrors &&
    !hasLivingSpendErrors &&
    !hasHousingErrors;

  const draft = useMemo<OnboardingV2Draft>(
    () => ({
      profile,
      household: {
        members: household.members,
      },
      assumptions,
      incomes,
      livingSpend,
      housing,
    }),
    [assumptions, household.members, housing, incomes, livingSpend, profile]
  );

  const scenarioChanges = useMemo(
    () =>
      scenarioId
        ? mapOnboardingV2DraftToScenario({
            draft,
            scenarioId,
            existingMembers: membersStore,
            existingAssumptions: scenario?.assumptions,
          })
        : null,
    [draft, membersStore, scenario?.assumptions, scenarioId]
  );

  useEffect(() => {
    if (!scenarioId || !scenarioChanges) {
      return;
    }
    cleanupGeneratedEntities(scenarioId, ONBOARDING_V2_INCOME_GENERATED_EVENT_ID);
    cleanupGeneratedEntities(
      scenarioId,
      ONBOARDING_V2_LIVING_SPEND_GENERATED_EVENT_ID
    );
    cleanupGeneratedEntities(scenarioId, ONBOARDING_V2_HOUSING_GENERATED_EVENT_ID);
    const baseCurrency =
      scenarioChanges.settingsPatch.baseCurrency ??
      scenario?.baseCurrency ??
      defaultCurrency;

    scenarioChanges.incomeMoneyItems.forEach((entry) => {
      addEventToScenarios(
        buildIncomeEventDefinition(entry, baseCurrency),
        [scenarioId]
      );
    });
    scenarioChanges.expenseMoneyItems.forEach((item) => {
      upsertMoneyItem({
        item,
        scenarioId,
        baseCurrency,
        eventLibrary: [],
        budgetRules: [],
        actions: {
          createBudgetRule,
          updateBudgetRule,
          addEventToScenarios,
          updateEventDefinition,
        },
        resolveCategoryLabel: (category) => category,
      });
    });

    scenarioChanges.housingEventDefinitions.forEach((definition) => {
      addEventToScenarios(definition, [scenarioId]);
    });

    if (
      scenarioChanges.housingAssets.length > 0 ||
      scenarioChanges.housingLiabilities.length > 0
    ) {
      const latestScenario =
        getActiveScenario(useScenarioStore.getState().scenarios, scenarioId) ??
        scenario;
      if (latestScenario) {
        let workingScenario = { ...latestScenario };
        let nextPositions = latestScenario.positions ?? {};

        scenarioChanges.housingAssets.forEach((item) => {
          nextPositions = applyAssetItemChange(workingScenario, {
            type: "upsert",
            item,
          });
          workingScenario = { ...workingScenario, positions: nextPositions };
        });

        scenarioChanges.housingLiabilities.forEach((item) => {
          nextPositions = applyLiabilityItemChange(workingScenario, {
            type: "upsert",
            item,
          });
          workingScenario = { ...workingScenario, positions: nextPositions };
        });

        setScenarioPositions(scenarioId, nextPositions);
      }
    }
  }, [
    addEventToScenarios,
    cleanupGeneratedEntities,
    createBudgetRule,
    scenario?.baseCurrency,
    scenarioChanges,
    scenarioId,
    scenario,
    setScenarioPositions,
    updateBudgetRule,
    updateEventDefinition,
  ]);

  const handleNext = () => {
    if (step === 0 && hasProfileError) {
      return;
    }
    if (step === 1 && hasMemberMonthErrors) {
      return;
    }
    if (step === 2 && hasAssumptionErrors) {
      return;
    }
    if (step === 3 && hasIncomeErrors) {
      return;
    }
    if (step === 4 && hasLivingSpendErrors) {
      return;
    }
    if (step === 5 && hasHousingErrors) {
      return;
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSave = () => {
    if (!scenarioId || !canProceed) {
      return;
    }

    const mapping = scenarioChanges;
    if (!mapping) {
      return;
    }

    mapping.memberIdsToDelete.forEach((memberId) => {
      deleteMember(memberId);
    });

    mapping.membersToUpsert.forEach((member) => {
      const existing = membersStore.find((entry) => entry.id === member.id);
      if (existing) {
        updateMember(member.id, member);
      } else {
        createMember(member);
      }
    });

    if (mapping.settingsPatch.baseCurrency) {
      updateScenarioBaseCurrency(scenarioId, mapping.settingsPatch.baseCurrency);
    }

    if (typeof mapping.settingsPatch.horizonMonths === "number") {
      updateScenarioAssumptions(scenarioId, {
        horizonMonths: mapping.settingsPatch.horizonMonths,
      });
    }

    if (mapping.settingsPatch.startMonth) {
      updateScenarioAssumptions(scenarioId, {
        baseMonth: mapping.settingsPatch.startMonth,
      });
    }

    if (Object.keys(mapping.assumptionsPatch).length > 0) {
      updateScenarioAssumptions(scenarioId, mapping.assumptionsPatch);
    }

    updateScenarioMeta(scenarioId, { onboardingVersion: 2 });
    updateScenarioClientComputed(scenarioId, { onboardingCompleted: true });
    router.push(`/${locale}${buildScenarioUrl("/money", scenarioId)}`);
  };

  const handleLater = () => {
    if (!scenarioId) {
      return;
    }
    updateScenarioMeta(scenarioId, { onboardingVersion: 2 });
    updateScenarioClientComputed(scenarioId, { onboardingCompleted: true });
    router.push(`/${locale}${buildScenarioUrl("/dashboard", scenarioId)}`);
  };

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>{t("title")}</Title>
        <Text size="sm" c="dimmed">
          {t("subtitle")}
        </Text>
        <Group justify="space-between" wrap="wrap">
          <Text size="xs" c="dimmed">
            {t("baseMonthLabel", { month: resolvedBaseMonth })}
          </Text>
          <Badge color="orange" variant="light">
            {t("draftBadge")}
          </Badge>
        </Group>
      </Stack>

      <OnboardingV2WizardShell
        activeStep={step}
        onStepChange={setStep}
        steps={[
          {
            id: "profile",
            title: t("step.profile"),
            content: (
              <Card withBorder radius="md" padding="md">
                <Stack gap="md">
                  <Title order={4}>{t("profileTitle")}</Title>
                  <Text size="sm" c="dimmed">
                    {t("profileHint")}
                  </Text>
                  <MonthField
                    label={t("birthMonth")}
                    placeholder={t("monthPlaceholder")}
                    value={selfBirthMonth}
                    error={profileErrors.birthMonth || undefined}
                    onChange={(value) =>
                      setHousehold((current) => ({
                        ...current,
                        members: current.members.map((member) =>
                          member.id === "self"
                            ? { ...member, birthMonth: value }
                            : member
                        ),
                      }))
                    }
                  />
                  <Select
                    label={t("baseCurrency")}
                    data={currencyOptions}
                    searchable
                    value={profile.baseCurrency}
                    error={profileErrors.baseCurrency || undefined}
                    onChange={(value) =>
                      setProfile((current) => ({
                        ...current,
                        baseCurrency: value ?? "",
                      }))
                    }
                  />
                  <SegmentedControl
                    value={String(profile.horizonYears)}
                    onChange={(value) =>
                      setProfile((current) => ({
                        ...current,
                        horizonYears: Number(value) as HorizonYears,
                      }))
                    }
                    data={[
                      { label: t("horizonYears3"), value: "3" },
                      { label: t("horizonYears5"), value: "5" },
                      { label: t("horizonYears10"), value: "10" },
                    ]}
                  />
                  <MonthField
                    label={t("startMonth")}
                    placeholder={t("monthPlaceholder")}
                    value={profile.startMonth}
                    error={profileErrors.startMonth || undefined}
                    onChange={(value) =>
                      setProfile((current) => ({
                        ...current,
                        startMonth: value,
                      }))
                    }
                  />
                  <Text size="xs" c="dimmed">
                    {t("startMonthHint")}
                  </Text>
                </Stack>
              </Card>
            ),
          },
          {
            id: "household",
            title: t("step.household"),
            content: (
              <Stack gap="md">
                <Card withBorder radius="md" padding="md">
                  <Stack gap="md">
                    <Title order={4}>{t("householdTitle")}</Title>
                    <Text size="sm" c="dimmed">
                      {t("householdHint")}
                    </Text>
                    <Switch
                      label={t("includePartner")}
                      checked={household.hasPartner}
                      onChange={(event) =>
                        setHousehold((current) =>
                          normalizeHouseholdCounts(current, {
                            hasPartner: event.currentTarget.checked,
                          })
                        )
                      }
                    />
                    <Group grow align="flex-start">
                      <NumberInput
                        label={t("childrenCount")}
                        min={0}
                        value={household.childCount}
                        onChange={(value) =>
                          setHousehold((current) =>
                            normalizeHouseholdCounts(current, {
                              childCount: typeof value === "number" ? value : 0,
                            })
                          )
                        }
                      />
                      <NumberInput
                        label={t("petsCount")}
                        min={0}
                        value={household.petCount}
                        onChange={(value) =>
                          setHousehold((current) =>
                            normalizeHouseholdCounts(current, {
                              petCount: typeof value === "number" ? value : 0,
                            })
                          )
                        }
                      />
                    </Group>
                  </Stack>
                </Card>

                <Card withBorder radius="md" padding="md">
                  <Stack gap="md">
                    <Title order={5}>{t("memberListTitle")}</Title>
                    <Text size="sm" c="dimmed">
                      {t("memberListHint")}
                    </Text>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      {household.members.map((member) => (
                        <Card key={member.id} withBorder radius="md" padding="md">
                          <Stack gap="sm">
                            <Text fw={600}>{getMemberLabel(t, member)}</Text>
                            <TextInput
                              label={t("memberName")}
                              placeholder={t("memberNamePlaceholder")}
                              value={member.name}
                              onChange={(event) =>
                                setHousehold((current) => ({
                                  ...current,
                                  members: current.members.map((entry) =>
                                    entry.id === member.id
                                      ? {
                                          ...entry,
                                          name: event.currentTarget.value,
                                        }
                                      : entry
                                  ),
                                }))
                              }
                            />
                            <MonthField
                              label={t("memberBirthMonth")}
                              placeholder={t("monthPlaceholder")}
                              value={member.birthMonth}
                              error={memberMonthErrors[member.id]}
                              onChange={(value) =>
                                setHousehold((current) => ({
                                  ...current,
                                  members: current.members.map((entry) =>
                                    entry.id === member.id
                                      ? { ...entry, birthMonth: value }
                                      : entry
                                  ),
                                }))
                              }
                            />
                          </Stack>
                        </Card>
                      ))}
                    </SimpleGrid>
                  </Stack>
                </Card>
              </Stack>
            ),
          },
          {
            id: "assumptions",
            title: t("step.assumptions"),
            content: (
              <AssumptionsStep
                assumptions={assumptions}
                errors={assumptionsErrors}
                onChange={(patch) =>
                  setAssumptions((current) => ({ ...current, ...patch }))
                }
                t={t}
              />
            ),
          },
          {
            id: "income",
            title: t("step.income"),
            content: (
              <IncomeStep
                incomes={incomes}
                members={household.members}
                baseMonth={profile.startMonth || resolvedBaseMonth}
                errors={incomeErrors}
                onChange={setIncomes}
                t={t}
              />
            ),
          },
          {
            id: "livingSpend",
            title: t("step.livingSpend"),
            content: (
              <LivingSpendStep
                livingSpend={livingSpend}
                baseMonth={profile.startMonth || resolvedBaseMonth}
                horizonYears={profile.horizonYears}
                errors={livingSpendErrors}
                onChange={setLivingSpend}
                t={t}
              />
            ),
          },
          {
            id: "housing",
            title: t("step.housing"),
            content: (
              <HousingStep
                housing={housing}
                baseMonth={profile.startMonth || resolvedBaseMonth}
                errors={housingErrors}
                onChange={setHousing}
                t={t}
              />
            ),
          },
          {
            id: "result",
            title: t("step.result"),
            content: (
              <Card withBorder radius="md" padding="md">
                <Stack gap="md">
                  <Title order={4}>{t("resultTitle")}</Title>
                  <Text size="sm" c="dimmed">
                    {t("resultHint")}
                  </Text>
                  <Group align="center" wrap="wrap">
                    <Button onClick={handleSave} disabled={!canProceed}>
                      {t("saveCta")}
                    </Button>
                    <Button variant="default" onClick={handleLater}>
                      {t("laterCta")}
                    </Button>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {t("saveHint")}
                  </Text>
                </Stack>
              </Card>
            ),
          },
        ]}
        navigation={
          <>
            <Button variant="default" onClick={handleBack} disabled={step === 0}>
              {t("back")}
            </Button>
            <Button
              onClick={handleNext}
              disabled={
                step === steps.length - 1 ||
                (step === 0 && hasProfileError) ||
                (step === 1 && hasMemberMonthErrors) ||
                (step === 2 && hasAssumptionErrors) ||
                (step === 3 && hasIncomeErrors) ||
                (step === 4 && hasLivingSpendErrors) ||
                (step === 5 && hasHousingErrors)
              }
            >
              {t("next")}
            </Button>
          </>
        }
      />
    </Stack>
  );
}
