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
  Skeleton,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { defaultCurrency } from "../../../lib/i18n";
import MonthField from "../../../components/MonthField";
import { getCurrentMonth } from "./utils";
import { normalizeMonthStrict } from "../../utils/month";
import { compareMonthKey, isValidMonthKey } from "../../utils/monthKey";
import {
  getScenarioById,
  isScenarioV2,
  useScenarioStore,
} from "../../store/scenarioStore";
import OnboardingV2WizardShell from "./v2/OnboardingV2WizardShell";
import AssumptionsStep from "./v2/AssumptionsStep";
import IncomeStep from "./v2/IncomeStep";
import LivingSpendStep from "./v2/LivingSpendStep";
import HousingStep, { type HousingErrors } from "./v2/HousingStep";
import AssetsStep, { type AssetsErrors } from "./v2/AssetsStep";
import DebtsStep, { type DebtsErrors } from "./v2/DebtsStep";
import InsuranceStep, { type InsuranceErrors } from "./v2/InsuranceStep";
import ReviewStep from "./v2/ReviewStep";
import {
  type OnboardingV2Draft,
  type OnboardingV2DraftAssets,
  type OnboardingV2DraftDebt,
  type OnboardingV2DraftDebtType,
  type OnboardingV2DraftIncome,
  type OnboardingV2DraftHousing,
  type OnboardingV2DraftInsurance,
  type OnboardingV2DraftLivingSpend,
  type OnboardingV2DraftMember,
  type OnboardingV2IncomeFrequency,
  type OnboardingV2MemberRole,
} from "../../domain/onboarding/v2/draftTypes";
import {
  applyOnboardingV2DraftToScenarioV2,
  isOnboardingMemberId,
} from "../../domain/onboarding/v2/applyOnboardingV2DraftToScenarioV2";
import {
  type OnboardingV2DraftAssumptions,
  buildOnboardingAssumptionsDraft,
  mergeOnboardingAssumptionsDraft,
} from "../../domain/onboarding/v2/assumptions";
import {
  DEFAULT_PLANNING_HORIZON_YEARS,
  PLANNING_HORIZON_YEARS,
  isPlanningHorizonYears,
} from "../../domain/assumptions/planningHorizon";
import { scenarioAssumptionSchema } from "../../domain/scenarioAssumptions";
import { saveScenarioPayloadAction } from "../../../app/(app)/app/actions/scenarioSave.actions";
import { useScenarioContext } from "../../hooks/useScenarioContext";
import { exportScenarioState } from "../../store/scenarioState";
import { scenarioDashboardPath, scenarioPath } from "../../../lib/routes/appRoutes";
import { ensureEventSchemaMarker } from "@north-star/adapters";
import { formatIsoYmdHms } from "../../../lib/date/format";

const steps = [
  "profile",
  "household",
  "assumptions",
  "income",
  "livingSpend",
  "housing",
  "assets",
  "debts",
  "insurance",
  "review",
] as const;

const DRAFT_STORAGE_KEY_PREFIX = "onboarding:v2:draft";
const TELEMETRY_STORAGE_KEY = "onboarding:v2:telemetry";
const TELEMETRY_EVENT_LIMIT = 50;
const isDev = process.env.NODE_ENV === "development";

const getDraftStorageKey = (scenarioId?: string) =>
  scenarioId ? `${DRAFT_STORAGE_KEY_PREFIX}:${scenarioId}` : DRAFT_STORAGE_KEY_PREFIX;

type OnboardingTelemetryEvent = {
  name:
    | "onboarding_v2_started"
    | "onboarding_v2_step_viewed"
    | "onboarding_v2_step_completed"
    | "onboarding_v2_completed"
    | "onboarding_v2_abandoned";
  ts: string;
  stepId?: (typeof steps)[number];
  stepIndex?: number;
  scenarioId?: string;
  action?: "save" | "later";
};

type HorizonYears = (typeof PLANNING_HORIZON_YEARS)[number];

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
  assets: OnboardingV2DraftAssets;
  debts: OnboardingV2DraftDebt[];
  insurance: OnboardingV2DraftInsurance;
};

const loadTelemetryEvents = () => {
  if (typeof window === "undefined" || !isDev) {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(TELEMETRY_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to parse onboarding telemetry", error);
    return [];
  }
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
  growthMode:
    existing?.growthMode === "custom" || existing?.growthMode === "none"
      ? existing.growthMode
      : "follow_env",
  growthRate:
    typeof existing?.growthRate === "number" && Number.isFinite(existing.growthRate)
      ? existing.growthRate
      : null,
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
  const propertyMarketValue = toNumber(
    existing?.own?.propertyMarketValue ?? existing?.own?.propertyValue
  );
  const mortgageBaseValue =
    typeof existing?.own?.mortgageBaseValue === "number" &&
    Number.isFinite(existing?.own?.mortgageBaseValue)
      ? existing?.own?.mortgageBaseValue
      : propertyMarketValue;
  const mortgageBaseMode =
    existing?.own?.mortgageBaseMode ??
    (mortgageBaseValue !== propertyMarketValue ? "CUSTOM" : "SYNC");

  return {
    mode: existing?.mode === "own" ? "own" : "rent",
    rent: {
      amount: toNumber(existing?.rent?.amount),
      noPayment: existing?.rent?.noPayment ?? true,
      startMonth: existing?.rent?.startMonth ?? baseMonth,
      endMonth: existing?.rent?.endMonth ?? "",
      rentGrowthPct: toOptional(existing?.rent?.rentGrowthPct),
    },
    own: {
      propertyMarketValue,
      mortgageBaseValue,
      mortgageBaseMode,
      startMonth: existing?.own?.startMonth ?? baseMonth,
      downPaymentMode:
        existing?.own?.downPaymentMode === "amount" ? "amount" : "percent",
      downPaymentPercent: toNumber(existing?.own?.downPaymentPercent),
      downPaymentAmount: toNumber(existing?.own?.downPaymentAmount),
      mortgageEnabled: existing?.own?.mortgageEnabled ?? true,
      mortgageRatePct: toNumber(existing?.own?.mortgageRatePct ?? 4),
      mortgageTermYears: toNumber(
        existing?.own?.mortgageTermYears ??
          (existing?.own?.mortgageTermMonths
            ? existing?.own?.mortgageTermMonths / 12
            : 30)
      ),
      mortgagePayment: toNumber(existing?.own?.mortgagePayment),
      mortgagePaymentSource: existing?.own?.mortgagePaymentSource ?? "estimated",
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

const buildAssetsDraft = ({
  baseMonth,
  existing,
}: {
  baseMonth: string;
  existing?: Partial<OnboardingV2DraftAssets>;
}): OnboardingV2DraftAssets => {
  const toNumber = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const toOptional = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const defaultBreakdown = [
    { type: "stock" },
    { type: "etf" },
    { type: "fund" },
    { type: "crypto" },
    { type: "other" },
  ] as const;

  const existingBreakdown = new Map(
    Array.isArray(existing?.investment?.breakdown)
      ? existing.investment.breakdown.map((entry) => [entry.type, entry])
      : []
  );
  const breakdown = defaultBreakdown.map((entry) => {
    const existingEntry = existingBreakdown.get(entry.type);
    return {
      id: existingEntry?.id || nanoid(6),
      type: entry.type,
      value: toNumber(existingEntry?.value),
      followGlobalReturn: existingEntry?.followGlobalReturn !== false,
      customReturnPct: toOptional(existingEntry?.customReturnPct),
    };
  });

  return {
    cash: {
      amount: toNumber(existing?.cash?.amount),
      startMonth: existing?.cash?.startMonth ?? baseMonth,
    },
    investment: {
      totalAmount: toNumber(existing?.investment?.totalAmount),
      startMonth: existing?.investment?.startMonth ?? baseMonth,
      breakdownEnabled: existing?.investment?.breakdownEnabled ?? true,
      breakdown,
    },
    contributions: Array.isArray(existing?.contributions)
      ? existing.contributions.map((entry) => ({
          id: entry.id || nanoid(6),
          amount: toNumber(entry.amount),
          startMonth: entry.startMonth ?? baseMonth,
          endMonth: entry.endMonth ?? "",
          memberId: entry.memberId ?? "",
        }))
      : [],
    car: {
      enabled: existing?.car?.enabled ?? false,
      value: toNumber(existing?.car?.value),
      startMonth: existing?.car?.startMonth ?? baseMonth,
      depreciationPct: toOptional(existing?.car?.depreciationPct),
    },
    insurances: Array.isArray(existing?.insurances)
      ? existing.insurances.map((entry) => ({
          id: entry.id || nanoid(6),
          cashValue: toNumber(entry.cashValue),
          startMonth: entry.startMonth ?? baseMonth,
          memberId: entry.memberId ?? "",
          returnPct: toOptional(entry.returnPct),
        }))
      : [],
  };
};

const buildInsuranceDraft = ({
  baseMonth,
  existing,
  legacyInsurances,
}: {
  baseMonth: string;
  existing?: Partial<OnboardingV2DraftInsurance>;
  legacyInsurances?: OnboardingV2DraftAssets["insurances"];
}): OnboardingV2DraftInsurance => {
  const toNumber = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const toOptional = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const normalizePolicies = (
    policies: NonNullable<OnboardingV2DraftInsurance["policies"]>
  ): OnboardingV2DraftInsurance["policies"] => {
    const used = new Set<number>();
    return policies.map((policy, index) => {
      const match = /policy-(\d+)/.exec(policy.id ?? "");
      let nextIndex = match ? Number(match[1]) : null;
      if (!nextIndex || used.has(nextIndex)) {
        nextIndex = index + 1;
        while (used.has(nextIndex)) {
          nextIndex += 1;
        }
      }
      used.add(nextIndex);
      const cashValue = toOptional(policy.cashValue);
      return {
        id: `policy-${nextIndex}`,
        name: policy.name ?? "",
        type: policy.type === "savings" ? "savings" : "protection",
        premiumPerMonth: toNumber(policy.premiumPerMonth),
        startMonth: policy.startMonth ?? baseMonth,
        endMonth: policy.endMonth ?? "",
        memberId: policy.memberId ?? "",
        cashValue,
        cashValueKnown:
          typeof policy.cashValueKnown === "boolean"
            ? policy.cashValueKnown
            : cashValue !== null,
        returnPct: toOptional(policy.returnPct),
      };
    });
  };

  const existingPolicies = Array.isArray(existing?.policies) ? existing.policies : [];
  const fallbackPolicies: OnboardingV2DraftInsurance["policies"] =
    existingPolicies.length > 0
      ? normalizePolicies(existingPolicies)
      : Array.isArray(legacyInsurances)
        ? legacyInsurances.map((entry, index) => ({
            id: `policy-${index + 1}`,
            name: "",
            type: "savings" as const,
            premiumPerMonth: 0,
            startMonth: entry.startMonth ?? baseMonth,
            endMonth: "",
            memberId: entry.memberId ?? "",
            cashValue: toOptional(entry.cashValue),
            cashValueKnown: true,
            returnPct: toOptional(entry.returnPct),
          }))
        : [];

  return {
    mode: existing?.mode === "quick" ? "quick" : "detailed",
    quick: {
      amount: toNumber(existing?.quick?.amount),
      startMonth: existing?.quick?.startMonth ?? baseMonth,
      endMonth: existing?.quick?.endMonth ?? "",
    },
    policies: fallbackPolicies,
  };
};

const resolveDebtType = (value?: string): OnboardingV2DraftDebtType => {
  switch (value) {
    case "carLoan":
    case "personalLoan":
    case "creditCard":
    case "other":
      return value;
    default:
      return "personalLoan";
  }
};

const buildDebtDraft = ({
  id,
  startMonth,
  existing,
}: {
  id: string;
  startMonth: string;
  existing?: Partial<OnboardingV2DraftDebt>;
}): OnboardingV2DraftDebt => {
  const toNumber = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const toOptional = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  return {
    id,
    type: resolveDebtType(existing?.type),
    label: existing?.label ?? "",
    principalOutstanding: toNumber(existing?.principalOutstanding),
    interestRatePct: toOptional(existing?.interestRatePct),
    termYears: toOptional(existing?.termYears),
    maturityMonth: existing?.maturityMonth ?? "",
    startMonth: existing?.startMonth ?? startMonth,
    monthlyPayment: toOptional(existing?.monthlyPayment),
    monthlyPaymentSource:
      existing?.monthlyPaymentSource === "manual" ? "manual" : existing?.monthlyPaymentSource,
    purchasePrice: toNumber(existing?.purchasePrice),
    downPaymentMode:
      existing?.downPaymentMode === "amount" ? "amount" : "percent",
    downPaymentPercent: toOptional(existing?.downPaymentPercent),
    downPaymentAmount: toOptional(existing?.downPaymentAmount),
  };
};

const normalizeDraftDebts = ({
  existingDebts,
  fallbackStartMonth,
}: {
  existingDebts?: OnboardingV2DraftDebt[];
  fallbackStartMonth: string;
}) => {
  const debts = Array.isArray(existingDebts) ? existingDebts : [];
  return debts.map((debt) =>
    buildDebtDraft({
      id: debt.id || `debt-${nanoid(6)}`,
      startMonth: fallbackStartMonth,
      existing: debt,
    })
  );
};

const getInitialDraftState = ({
  baseCurrency,
  assumptions,
  scenarioId,
}: {
  baseCurrency: string;
  assumptions?: OnboardingV2DraftAssumptions;
  scenarioId?: string;
}): DraftStorageState => {
  const assumptionsFallback =
    assumptions ?? buildOnboardingAssumptionsDraft(undefined);
  const fallback: DraftStorageState = {
    step: 0,
    profile: {
      baseCurrency,
      startMonth: "",
      horizonYears: DEFAULT_PLANNING_HORIZON_YEARS,
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
    assets: buildAssetsDraft({ baseMonth: getCurrentMonth() }),
    debts: [],
    insurance: buildInsuranceDraft({ baseMonth: getCurrentMonth() }),
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(getDraftStorageKey(scenarioId));
    if (!stored) {
      return fallback;
    }
    const parsed = JSON.parse(stored) as Partial<DraftStorageState>;
    const profile: DraftProfileState = {
      baseCurrency:
        parsed.profile?.baseCurrency?.trim() || fallback.profile.baseCurrency,
      startMonth: parsed.profile?.startMonth ?? fallback.profile.startMonth,
      horizonYears: isPlanningHorizonYears(parsed.profile?.horizonYears)
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
    const assets = buildAssetsDraft({
      baseMonth: profile.startMonth || fallback.profile.startMonth || getCurrentMonth(),
      existing: parsed.assets,
    });
    const debts = normalizeDraftDebts({
      existingDebts: parsed.debts,
      fallbackStartMonth:
        profile.startMonth || fallback.profile.startMonth || getCurrentMonth(),
    });
    const insurance = buildInsuranceDraft({
      baseMonth: profile.startMonth || fallback.profile.startMonth || getCurrentMonth(),
      existing: parsed.insurance,
      legacyInsurances: assets.insurances,
    });

    return {
      step: typeof parsed.step === "number" ? parsed.step : fallback.step,
      profile,
      household,
      assumptions,
      incomes,
      livingSpend,
      housing,
      assets,
      debts,
      insurance,
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
  const validation = useTranslations("validation");
  const router = useRouter();
  const params = useParams<{ scenarioId?: string }>();
  const scenarioContext = useScenarioContext();
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const appSettings = useScenarioStore((state) => state.appSettings);
  const membersStore = useScenarioStore((state) => state.members);
  const updateScenarioAssumptions = useScenarioStore(
    (state) => state.updateScenarioAssumptions
  );
  const updateScenarioClientComputed = useScenarioStore(
    (state) => state.updateScenarioClientComputed
  );
  const updateScenarioMeta = useScenarioStore((state) => state.updateScenarioMeta);
  const updateScenarioBaseCurrency = useScenarioStore(
    (state) => state.updateScenarioBaseCurrency
  );
  const setScenarioEvents = useScenarioStore((state) => state.setScenarioEvents);
  const setScenarioAssets = useScenarioStore((state) => state.setScenarioAssets);
  const setScenarioLiabilities = useScenarioStore(
    (state) => state.setScenarioLiabilities
  );
  const setScenarioMembers = useScenarioStore((state) => state.setScenarioMembers);
  const createMember = useScenarioStore((state) => state.createMember);
  const updateMember = useScenarioStore((state) => state.updateMember);
  const deleteMember = useScenarioStore((state) => state.deleteMember);
  const setActiveScenario = useScenarioStore((state) => state.setActiveScenario);
  const routeScenarioId = params?.scenarioId ?? scenarioContext?.scenarioId ?? "";
  const scenario = useMemo(() => {
    if (routeScenarioId) {
      return getScenarioById(scenarios, routeScenarioId);
    }

    return getScenarioById(scenarios, activeScenarioId);
  }, [activeScenarioId, routeScenarioId, scenarios]);
  const scenarioIsV2 = scenario ? isScenarioV2(scenario) : false;
  const scenarioId = scenario?.id ?? routeScenarioId;
  const initialState = useMemo(
    () =>
      getInitialDraftState({
        baseCurrency: scenario?.baseCurrency ?? defaultCurrency,
        assumptions: buildOnboardingAssumptionsDraft(scenario?.assumptions),
        scenarioId: scenario?.id,
      }),
    [scenario?.assumptions, scenario?.baseCurrency, scenario?.id]
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
  const [assets, setAssets] = useState<OnboardingV2DraftAssets>(
    initialState.assets
  );
  const [debts, setDebts] = useState<OnboardingV2DraftDebt[]>(
    initialState.debts
  );
  const [insurance, setInsurance] = useState<OnboardingV2DraftInsurance>(
    initialState.insurance
  );
  const [stepValidationAttempted, setStepValidationAttempted] = useState<Record<number, boolean>>({});
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [telemetryEvents, setTelemetryEvents] = useState<OnboardingTelemetryEvent[]>(
    []
  );
  const latestStepRef = useRef(step);
  const latestScenarioIdRef = useRef(scenarioId);
  const hasCompletedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const initialStepRef = useRef(step);
  const isMountedRef = useRef(true);
  const hasAutoAddedIncomeRef = useRef(false);

  useEffect(() => {
    if (!isDev) {
      return;
    }
    setTelemetryEvents(loadTelemetryEvents());
  }, []);


  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestStepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);

  useEffect(() => {
    latestScenarioIdRef.current = scenarioId;
  }, [scenarioId]);

  useEffect(() => {
    if (!routeScenarioId || activeScenarioId === routeScenarioId) {
      return;
    }

    const hasRouteScenario = scenarios.some((entry) => entry.id === routeScenarioId);
    if (!hasRouteScenario) {
      return;
    }

    setActiveScenario(routeScenarioId);
  }, [activeScenarioId, routeScenarioId, scenarios, setActiveScenario]);

  const logTelemetryEvent = useCallback((event: OnboardingTelemetryEvent) => {
    if (typeof window === "undefined" || !isDev) {
      return;
    }

    if (isMountedRef.current) {
      setTelemetryEvents((current) => {
        const next = [...current, event].slice(-TELEMETRY_EVENT_LIMIT);
        window.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } else {
      const current = loadTelemetryEvents();
      const next = [...current, event].slice(-TELEMETRY_EVENT_LIMIT);
      window.localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(next));
    }

    console.info("[onboarding telemetry]", event);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !scenarioId) {
      return;
    }

    const scopedKey = getDraftStorageKey(scenarioId);
    const existingScoped = window.localStorage.getItem(scopedKey);
    if (existingScoped) {
      return;
    }

    const legacyDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY_PREFIX);
    if (!legacyDraft) {
      return;
    }

    window.localStorage.setItem(scopedKey, legacyDraft);
    window.localStorage.removeItem(DRAFT_STORAGE_KEY_PREFIX);
  }, [scenarioId]);

  useEffect(() => {
    if (hasStartedRef.current || !scenarioId) {
      return;
    }
    hasStartedRef.current = true;
    logTelemetryEvent({
      name: "onboarding_v2_started",
      ts: new Date().toISOString(),
      stepId: steps[initialStepRef.current],
      stepIndex: initialStepRef.current,
      scenarioId,
    });
  }, [logTelemetryEvent, scenarioId]);

  useEffect(() => {
    logTelemetryEvent({
      name: "onboarding_v2_step_viewed",
      ts: new Date().toISOString(),
      stepId: steps[step],
      stepIndex: step,
      scenarioId,
    });
  }, [logTelemetryEvent, scenarioId, step]);

  useEffect(() => {
    return () => {
      if (hasCompletedRef.current) {
        return;
      }
      logTelemetryEvent({
        name: "onboarding_v2_abandoned",
        ts: new Date().toISOString(),
        stepId: steps[latestStepRef.current],
        stepIndex: latestStepRef.current,
        scenarioId: latestScenarioIdRef.current,
      });
    };
  }, [logTelemetryEvent]);

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
      assets,
      debts,
      insurance,
    };
    window.localStorage.setItem(getDraftStorageKey(scenarioId), JSON.stringify(payload));
    setLastAutoSavedAt(new Date().toISOString());
  }, [
    assumptions,
    assets,
    debts,
    household,
    housing,
    incomes,
    insurance,
    livingSpend,
    profile,
    scenarioId,
    step,
  ]);

  const resolvedBaseMonth = useMemo(() => {
    const raw = appSettings.globalBaseMonth ?? getCurrentMonth();
    const normalized = normalizeMonthStrict(raw);
    return normalized.ok ? normalized.month : getCurrentMonth();
  }, [appSettings.globalBaseMonth]);
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
      ].filter((value): value is string => Boolean(value))
    );

    return Array.from(options).map((value) => ({ value, label: value }));
  }, [profile.baseCurrency, scenario?.baseCurrency]);

  const selfMember = household.members.find((member) => member.id === "self");
  const selfBirthMonth = selfMember?.birthMonth ?? "";

  useEffect(() => {
    if (hasAutoAddedIncomeRef.current) {
      return;
    }
    if (incomes.length > 0) {
      hasAutoAddedIncomeRef.current = true;
      return;
    }
    const startMonth = profile.startMonth || resolvedBaseMonth;
    if (!startMonth) {
      return;
    }
    setIncomes([
      {
        id: `income-self-${nanoid(6)}`,
        label: t("incomeTemplateSelfSalaryName"),
        amount: 30000,
        frequency: "monthly",
        startMonth,
        endMonth: "",
        memberId: selfMember?.id ?? "self",
        followIncomeGrowth: true,
      },
    ]);
    hasAutoAddedIncomeRef.current = true;
  }, [
    incomes.length,
    profile.startMonth,
    resolvedBaseMonth,
    selfMember?.id,
    t,
  ]);

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

  const assumptionValidationResult = scenarioAssumptionSchema.safeParse({
    inflationRate: assumptions.inflationPct ?? undefined,
    salaryGrowthRate: assumptions.incomeGrowthPct ?? undefined,
    rentAnnualGrowthPct: assumptions.rentGrowthPct ?? undefined,
    propertyAppreciationPct: assumptions.propertyAppreciationPct ?? undefined,
    cashYieldPct: assumptions.cashYieldPct ?? undefined,
    carDepreciationRatePct: assumptions.carDepreciationPct ?? undefined,
  });

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

  if (!assumptionValidationResult.success) {
    const issues = new Map(
      assumptionValidationResult.error.issues.map((issue) => [issue.path[0], issue.message])
    );

    const inflationError = issues.get("inflationRate");
    if (typeof inflationError === "string") {
      assumptionsErrors.inflationPct = validation(inflationError);
    }

    const incomeError = issues.get("salaryGrowthRate");
    if (typeof incomeError === "string") {
      assumptionsErrors.incomeGrowthPct = validation(incomeError);
    }

    const rentError = issues.get("rentAnnualGrowthPct");
    if (typeof rentError === "string") {
      assumptionsErrors.rentGrowthPct = validation(rentError);
    }

    const propertyError = issues.get("propertyAppreciationPct");
    if (typeof propertyError === "string") {
      assumptionsErrors.propertyAppreciationPct = validation(propertyError);
    }

    const cashYieldError = issues.get("cashYieldPct");
    if (typeof cashYieldError === "string") {
      assumptionsErrors.cashYieldPct = validation(cashYieldError);
    }

    const carDepError = issues.get("carDepreciationRatePct");
    if (typeof carDepError === "string") {
      assumptionsErrors.carDepreciationPct = validation(carDepError);
    }
  }

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
    if (!housing.rent.noPayment) {
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
  }

  if (housing.mode === "own") {
    if (
      !Number.isFinite(housing.own.propertyMarketValue) ||
      housing.own.propertyMarketValue <= 0
    ) {
      housingErrors.own.propertyMarketValue = t("housingPropertyValueRequired");
    }
    if (!housing.own.startMonth) {
      housingErrors.own.startMonth = t("housingPropertyStartMonthRequired");
    } else if (!isValidMonthKey(housing.own.startMonth)) {
      housingErrors.own.startMonth = t("monthInvalid");
    }

    if (housing.own.mortgageEnabled) {
      const mortgageRatePct = housing.own.mortgageRatePct ?? NaN;
      const mortgageTermYears = housing.own.mortgageTermYears ?? NaN;
      const mortgagePayment = housing.own.mortgagePayment ?? NaN;

      if (!Number.isFinite(mortgageRatePct) || mortgageRatePct < 0) {
        housingErrors.own.mortgageRatePct = t("housingMortgageRateRequired");
      }
      if (!Number.isFinite(mortgageTermYears) || mortgageTermYears <= 0) {
        housingErrors.own.mortgageTermYears = t("housingMortgageTermRequired");
      }
      if (housing.own.mortgagePaymentSource === "manual") {
        if (!Number.isFinite(mortgagePayment) || mortgagePayment <= 0) {
          housingErrors.own.mortgagePayment = t("housingMortgagePaymentRequired");
        }
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

  const assetsErrors: AssetsErrors = {
    cash: {},
    investment: {},
    breakdown: {},
    contributions: {},
    car: {},
  };

  if (!Number.isFinite(assets.cash.amount) || assets.cash.amount < 0) {
    assetsErrors.cash.amount = t("assetsCashAmountRequired");
  }

  if (!assets.cash.startMonth) {
    assetsErrors.cash.startMonth = t("assetsCashStartMonthRequired");
  } else if (!isValidMonthKey(assets.cash.startMonth)) {
    assetsErrors.cash.startMonth = t("monthInvalid");
  }

  const investmentHasAmount =
    (Number.isFinite(assets.investment.totalAmount) &&
      assets.investment.totalAmount > 0) ||
    assets.investment.breakdown.some((entry) => entry.value > 0);

  if (investmentHasAmount) {
    if (!assets.investment.startMonth) {
      assetsErrors.investment.startMonth = t("assetsInvestmentStartMonthRequired");
    } else if (!isValidMonthKey(assets.investment.startMonth)) {
      assetsErrors.investment.startMonth = t("monthInvalid");
    }
  }

  assets.investment.breakdown.forEach((entry) => {
    const entryErrors: Partial<{ value: string; customReturnPct: string }> = {};
    if (
      entry.customReturnPct !== null &&
      entry.customReturnPct !== undefined &&
      (!Number.isFinite(entry.customReturnPct) || entry.customReturnPct < 0)
    ) {
      entryErrors.customReturnPct = t("assetsInvestmentReturnInvalid");
    }
    if (Object.keys(entryErrors).length > 0) {
      assetsErrors.breakdown[entry.id] = entryErrors;
    }
  });

  assets.contributions.forEach((entry) => {
    const entryErrors: Partial<{ amount: string; startMonth: string; endMonth: string }> =
      {};
    const hasAny =
      entry.amount > 0 || entry.startMonth || entry.endMonth || entry.memberId;

    if (!hasAny) {
      return;
    }

    if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
      entryErrors.amount = t("assetsContributionAmountRequired");
    }
    if (!entry.startMonth) {
      entryErrors.startMonth = t("assetsContributionStartMonthRequired");
    } else if (!isValidMonthKey(entry.startMonth)) {
      entryErrors.startMonth = t("monthInvalid");
    }
    if (entry.endMonth) {
      if (!isValidMonthKey(entry.endMonth)) {
        entryErrors.endMonth = t("monthInvalid");
      } else if (
        entry.startMonth &&
        isValidMonthKey(entry.startMonth) &&
        compareMonthKey(entry.startMonth, entry.endMonth) > 0
      ) {
        entryErrors.endMonth = t("assetsContributionEndMonthBeforeStart");
      }
    }
    if (Object.keys(entryErrors).length > 0) {
      assetsErrors.contributions[entry.id] = entryErrors;
    }
  });

  if (assets.car.enabled) {
    if (!Number.isFinite(assets.car.value) || assets.car.value <= 0) {
      assetsErrors.car.value = t("assetsCarValueRequired");
    }
    if (!assets.car.startMonth) {
      assetsErrors.car.startMonth = t("assetsCarStartMonthRequired");
    } else if (!isValidMonthKey(assets.car.startMonth)) {
      assetsErrors.car.startMonth = t("monthInvalid");
    }
    if (
      assets.car.depreciationPct !== null &&
      assets.car.depreciationPct !== undefined &&
      (!Number.isFinite(assets.car.depreciationPct) || assets.car.depreciationPct < 0)
    ) {
      assetsErrors.car.depreciationPct = t("assetsCarDepreciationInvalid");
    }
  }

  const hasAssetsErrors =
    Object.values(assetsErrors.cash).some((value) => value) ||
    Object.values(assetsErrors.investment).some((value) => value) ||
    Object.keys(assetsErrors.breakdown).length > 0 ||
    Object.keys(assetsErrors.contributions).length > 0 ||
    Object.values(assetsErrors.car).some((value) => value);

  const insuranceErrors: InsuranceErrors = {
    quick: {},
    policies: {},
  };

  if (insurance.mode === "quick") {
    if (insurance.quick.startMonth && !isValidMonthKey(insurance.quick.startMonth)) {
      insuranceErrors.quick.startMonth = t("monthInvalid");
    }
    if (insurance.quick.endMonth) {
      if (!isValidMonthKey(insurance.quick.endMonth)) {
        insuranceErrors.quick.endMonth = t("monthInvalid");
      } else if (
        insurance.quick.startMonth &&
        isValidMonthKey(insurance.quick.startMonth) &&
        compareMonthKey(insurance.quick.startMonth, insurance.quick.endMonth) > 0
      ) {
        insuranceErrors.quick.endMonth = t("livingEndMonthBeforeStart");
      }
    }
  }

  if (insurance.mode === "detailed") {
    insurance.policies.forEach((policy) => {
      const entryErrors: NonNullable<InsuranceErrors["policies"][string]> = {};
      if (!Number.isFinite(policy.premiumPerMonth) || policy.premiumPerMonth <= 0) {
        entryErrors.premiumPerMonth = t("insurancePremiumRequired");
      }
      if (!policy.startMonth) {
        entryErrors.startMonth = t("insuranceStartMonthRequired");
      } else if (!isValidMonthKey(policy.startMonth)) {
        entryErrors.startMonth = t("monthInvalid");
      }
      if (policy.endMonth) {
        if (!isValidMonthKey(policy.endMonth)) {
          entryErrors.endMonth = t("monthInvalid");
        } else if (
          policy.startMonth &&
          isValidMonthKey(policy.startMonth) &&
          compareMonthKey(policy.startMonth, policy.endMonth) > 0
        ) {
          entryErrors.endMonth = t("livingEndMonthBeforeStart");
        }
      }
      if (
        policy.type === "savings" &&
        policy.cashValueKnown &&
        (!Number.isFinite(policy.cashValue) || (policy.cashValue ?? 0) <= 0)
      ) {
        entryErrors.cashValue = t("insuranceCashValueRequired");
      }
      if (
        policy.returnPct !== null &&
        policy.returnPct !== undefined &&
        (!Number.isFinite(policy.returnPct) || policy.returnPct < 0)
      ) {
        entryErrors.returnPct = t("insuranceReturnInvalid");
      }
      if (Object.keys(entryErrors).length > 0) {
        insuranceErrors.policies[policy.id] = entryErrors;
      }
    });
  }

  const hasInsuranceErrors =
    Object.values(insuranceErrors.quick).some((value) => value) ||
    Object.keys(insuranceErrors.policies).length > 0;

  const debtsErrors: DebtsErrors = { debts: {} };
  debts.forEach((debt) => {
    const entryErrors: NonNullable<DebtsErrors["debts"][string]> = {};

    if (debt.startMonth && !isValidMonthKey(debt.startMonth)) {
      entryErrors.startMonth = t("monthInvalid");
    }
    if (debt.maturityMonth) {
      if (!isValidMonthKey(debt.maturityMonth)) {
        entryErrors.maturityMonth = t("monthInvalid");
      } else if (
        debt.startMonth &&
        isValidMonthKey(debt.startMonth) &&
        compareMonthKey(debt.startMonth, debt.maturityMonth) > 0
      ) {
        entryErrors.maturityMonth = t("debtsMaturityBeforeStart");
      }
    }
    if (!Number.isFinite(debt.principalOutstanding) || debt.principalOutstanding < 0) {
      entryErrors.principalOutstanding = t("amountInvalid");
    }
    if (
      debt.interestRatePct !== null &&
      debt.interestRatePct !== undefined &&
      (!Number.isFinite(debt.interestRatePct) || debt.interestRatePct < 0)
    ) {
      entryErrors.interestRatePct = t("amountInvalid");
    }
    if (
      debt.termYears !== null &&
      debt.termYears !== undefined &&
      (!Number.isFinite(debt.termYears) || debt.termYears < 0)
    ) {
      entryErrors.termYears = t("amountInvalid");
    }
    if (
      debt.monthlyPayment !== null &&
      debt.monthlyPayment !== undefined &&
      (!Number.isFinite(debt.monthlyPayment) || debt.monthlyPayment < 0)
    ) {
      entryErrors.monthlyPayment = t("amountInvalid");
    }
    if (
      debt.purchasePrice !== undefined &&
      (!Number.isFinite(debt.purchasePrice) || debt.purchasePrice < 0)
    ) {
      entryErrors.purchasePrice = t("amountInvalid");
    }
    if (
      debt.downPaymentPercent !== null &&
      debt.downPaymentPercent !== undefined &&
      (!Number.isFinite(debt.downPaymentPercent) || debt.downPaymentPercent < 0)
    ) {
      entryErrors.downPaymentPercent = t("amountInvalid");
    }
    if (
      debt.downPaymentAmount !== null &&
      debt.downPaymentAmount !== undefined &&
      (!Number.isFinite(debt.downPaymentAmount) || debt.downPaymentAmount < 0)
    ) {
      entryErrors.downPaymentAmount = t("amountInvalid");
    }

    if (Object.keys(entryErrors).length > 0) {
      debtsErrors.debts[debt.id] = entryErrors;
    }
  });

  const hasDebtsErrors = Object.keys(debtsErrors.debts).length > 0;

  const canProceed =
    !hasProfileError &&
    !hasMemberMonthErrors &&
    !hasAssumptionErrors &&
    !hasIncomeErrors &&
    !hasLivingSpendErrors &&
    !hasHousingErrors &&
    !hasAssetsErrors &&
    !hasDebtsErrors &&
    !hasInsuranceErrors;
  const canApply = canProceed && scenarioIsV2;
  const shouldShowStepErrors = stepValidationAttempted[step] === true;

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
      assets,
      debts,
      insurance,
    }),
    [
      assumptions,
      assets,
      debts,
      household.members,
      housing,
      insurance,
      incomes,
      livingSpend,
      profile,
    ]
  );

  const scenarioPreview = useMemo(() => {
    if (!scenario || !scenarioId || !isScenarioV2(scenario)) {
      return null;
    }
    return applyOnboardingV2DraftToScenarioV2(draft, scenario);
  }, [draft, scenario, scenarioId]);

  if (!scenario) {
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Loading scenario…
        </Text>
        <Skeleton height={24} radius="sm" />
        <Skeleton height={48} radius="sm" />
        <Skeleton height={240} radius="md" />
      </Stack>
    );
  }

  const handleNext = () => {
    setStepValidationAttempted((current) => ({ ...current, [step]: true }));
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
    if (step === 6 && hasAssetsErrors) {
      return;
    }
    if (step === 7 && hasDebtsErrors) {
      return;
    }
    if (step === 8 && hasInsuranceErrors) {
      return;
    }
    logTelemetryEvent({
      name: "onboarding_v2_step_completed",
      ts: new Date().toISOString(),
      stepId: steps[step],
      stepIndex: step,
      scenarioId,
    });
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStep((current) => Math.max(current - 1, 0));
  };

  const handleSave = async () => {
    if (!scenarioId || !canApply) {
      return;
    }

    if (!scenarioIsV2 || !scenarioPreview) {
      return;
    }

    const desiredMemberIds = new Set(
      (scenarioPreview.members ?? []).map((member) => member.id)
    );
    membersStore
      .map((member) => member.id)
      .filter((id) => isOnboardingMemberId(id) && !desiredMemberIds.has(id))
      .forEach((memberId) => {
      deleteMember(memberId);
    });

    (scenarioPreview.members ?? []).forEach((member) => {
      const existing = membersStore.find((entry) => entry.id === member.id);
      if (existing) {
        updateMember(member.id, member);
      } else {
        createMember(member);
      }
    });

    if (scenarioPreview.baseCurrency) {
      updateScenarioBaseCurrency(scenarioId, scenarioPreview.baseCurrency);
    }

    updateScenarioAssumptions(scenarioId, scenarioPreview.assumptions);
    setScenarioMembers(scenarioId, scenarioPreview.members ?? []);
    setScenarioAssets(scenarioId, scenarioPreview.assets ?? []);
    setScenarioLiabilities(scenarioId, scenarioPreview.liabilities ?? []);
    setScenarioEvents(scenarioId, scenarioPreview.events ?? []);

    hasCompletedRef.current = true;
    logTelemetryEvent({
      name: "onboarding_v2_step_completed",
      ts: new Date().toISOString(),
      stepId: steps[step],
      stepIndex: step,
      scenarioId,
    });
    logTelemetryEvent({
      name: "onboarding_v2_completed",
      ts: new Date().toISOString(),
      stepId: steps[step],
      stepIndex: step,
      scenarioId,
      action: "save",
    });

    const nowIso = new Date().toISOString();
    updateScenarioMeta(scenarioId, {
      schemaVersion: 2,
      onboarded: true,
      onboardedAt: nowIso,
      onboardingVersion: 2,
      lastSavedAt: nowIso,
    });
    updateScenarioClientComputed(scenarioId, { onboardingCompleted: true });

    if (
      scenarioContext &&
      scenarioContext.scenarioId === scenarioId
    ) {
      const payload = ensureEventSchemaMarker(exportScenarioState() as Record<string, unknown>);
      const payloadScenarios = Array.isArray(payload.scenarios) ? payload.scenarios : [];
      payload.scenarios = payloadScenarios.map((entry) => {
        if (!entry || typeof entry !== "object") {
          return entry;
        }

        const scenarioEntry = entry as Record<string, unknown>;
        return {
          ...scenarioEntry,
          events: Array.isArray(scenarioEntry.events) ? scenarioEntry.events : [],
        };
      });
      const nextMeta = {
        ...(payload.meta && typeof payload.meta === "object" ? payload.meta : {}),
        schemaVersion: 2,
        onboarded: true,
        onboardedAt: nowIso,
        lastSavedAt: nowIso,
      };
      payload.meta = nextMeta;

      try {
        await saveScenarioPayloadAction(
          scenarioContext.caseId,
          scenarioContext.scenarioId,
          payload,
          scenarioContext.revision,
        );
      } catch (error) {
        console.error("Failed to persist onboarding payload", error);
        return;
      }

      window.localStorage.removeItem(getDraftStorageKey(scenarioId));
      router.push(scenarioDashboardPath(scenarioContext.caseId, scenarioId));
      return;
    }

    window.localStorage.removeItem(getDraftStorageKey(scenarioId));
    router.push(scenarioPath(scenarioContext?.caseId, scenarioId, "dashboard"));
  };

  const handleLater = () => {
    if (!scenarioId) {
      return;
    }
    hasCompletedRef.current = true;
    logTelemetryEvent({
      name: "onboarding_v2_step_completed",
      ts: new Date().toISOString(),
      stepId: steps[step],
      stepIndex: step,
      scenarioId,
    });
    logTelemetryEvent({
      name: "onboarding_v2_completed",
      ts: new Date().toISOString(),
      stepId: steps[step],
      stepIndex: step,
      scenarioId,
      action: "later",
    });
    const nowIso = new Date().toISOString();
    updateScenarioMeta(scenarioId, {
      schemaVersion: 2,
      onboarded: true,
      onboardedAt: nowIso,
      onboardingVersion: 2,
      lastSavedAt: nowIso,
    });
    updateScenarioClientComputed(scenarioId, { onboardingCompleted: true });
    window.localStorage.removeItem(getDraftStorageKey(scenarioId));
    router.push(scenarioPath(scenarioContext?.caseId, scenarioId, "dashboard"));
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
          <Group gap="xs">
            <Badge color="orange" variant="light">
              {t("draftBadge")}
            </Badge>
            <Badge color="teal" variant="light">
              {lastAutoSavedAt ? `已自動儲存 · ${formatIsoYmdHms(lastAutoSavedAt)}` : ""}
            </Badge>
          </Group>
        </Group>
      </Stack>

      {isDev ? (
        <Card withBorder padding="sm">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="xs" fw={600}>
                Onboarding debug
              </Text>
              <Badge color="blue" variant="light" size="xs">
                V2
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Current step: {steps[step]}
            </Text>
            <Stack gap={4}>
              {telemetryEvents.slice(-5).map((event, index) => (
                <Text size="xs" key={`${event.ts}-${index}`}>
                  {event.name}
                  {event.stepId ? ` (${event.stepId})` : ""} · {event.ts}
                </Text>
              ))}
              {telemetryEvents.length === 0 ? (
                <Text size="xs" c="dimmed">
                  No telemetry yet.
                </Text>
              ) : null}
            </Stack>
          </Stack>
        </Card>
      ) : null}

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
                    error={shouldShowStepErrors ? profileErrors.birthMonth || undefined : undefined}
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
                    error={shouldShowStepErrors ? profileErrors.baseCurrency || undefined : undefined}
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
                    data={PLANNING_HORIZON_YEARS.map((years) => ({
                      label: t(`horizonYears${years}`),
                      value: String(years),
                    }))}
                  />
                  <Text size="xs" c="dimmed">
                    {t("horizonYearsHint", {
                      years: profile.horizonYears,
                      defaultYears: DEFAULT_PLANNING_HORIZON_YEARS,
                    })}
                  </Text>
                  <MonthField
                    label={t("startMonth")}
                    placeholder={t("monthPlaceholder")}
                    value={profile.startMonth}
                    error={shouldShowStepErrors ? profileErrors.startMonth || undefined : undefined}
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
                            hasPartner: (event.target as HTMLInputElement).checked,
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
                                          name: (event.target as HTMLInputElement).value,
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
                              error={shouldShowStepErrors ? memberMonthErrors[member.id] : undefined}
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
                errors={shouldShowStepErrors ? assumptionsErrors : {}}
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
                incomeGrowthPct={assumptions.incomeGrowthPct}
                errors={shouldShowStepErrors ? incomeErrors : {}}
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
                inflationPct={assumptions.inflationPct}
                errors={shouldShowStepErrors ? livingSpendErrors : { fixed: {}, travel: {}, tax: {}, otherFixed: {} }}
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
            id: "assets",
            title: t("step.assets"),
            content: (
              <AssetsStep
                assets={assets}
                baseMonth={profile.startMonth || resolvedBaseMonth}
                members={household.members}
                errors={assetsErrors}
                onChange={setAssets}
                t={t}
              />
            ),
          },
          {
            id: "debts",
            title: t("step.debts"),
            content: (
              <DebtsStep
                debts={debts}
                baseMonth={profile.startMonth || resolvedBaseMonth}
                errors={debtsErrors}
                onChange={setDebts}
                t={t}
              />
            ),
          },
          {
            id: "insurance",
            title: t("step.insurance"),
            content: (
              <InsuranceStep
                insurance={insurance}
                baseMonth={profile.startMonth || resolvedBaseMonth}
                members={household.members}
                errors={insuranceErrors}
                onChange={setInsurance}
                t={t}
              />
            ),
          },
          {
            id: "review",
            title: t("step.review"),
            content: (
              <ReviewStep
                draft={draft}
                scenario={scenario ?? null}
                baseMonth={profile.startMonth || resolvedBaseMonth}
                horizonYears={profile.horizonYears}
                scenarioPreview={scenarioPreview}
                scenarioIsV2={scenarioIsV2}
                onJumpToStep={setStep}
                onApplyDraft={handleSave}
                onApplyLater={handleLater}
                canApplyDraft={canApply}
                t={t}
              />
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
              disabled={step === steps.length - 1}
            >
              {t("next")}
            </Button>
          </>
        }
      />
    </Stack>
  );
}
