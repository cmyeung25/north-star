import {
  DEFAULT_PLANNING_HORIZON_YEARS,
  isPlanningHorizonYears,
  resolvePlanningHorizonMonths,
} from "../../domain/assumptions/planningHorizon";
import { buildOnboardingAssumptionsDraft } from "../../domain/onboarding/v2/assumptions";
import type { ScenarioEventDraft } from "../../domain/scenarioV2/events";
import type {
  OnboardingV2DraftAssets,
  OnboardingV2DraftHousing,
  OnboardingV2DraftIncome,
  OnboardingV2DraftInsurance,
  OnboardingV2DraftLivingSpend,
  OnboardingV2DraftMember,
  OnboardingV2MemberRole,
} from "../../domain/onboarding/v2/draftTypes";
import type { ScenarioSeedPayload } from "../../scenarios/scenarioSeeds";
import type { DraftStorageState } from "./draftStorage";

export const MEMBER_CASE_PRESET_SEED_IDS = [
  "single-renter",
  "dual-income-home",
  "dual-income-rental",
  "high-asset",
] as const;

export type MemberCasePresetSeedId = (typeof MEMBER_CASE_PRESET_SEED_IDS)[number];

type CashflowEventDraft = ScenarioEventDraft & {
  type: "cashflow";
  kind: "income" | "expense";
  cadence: "monthly" | "quarterly" | "yearly" | "oneOff" | "everyNMonths";
  amount: number;
  startMonth?: string;
  endMonth?: string;
  occurrenceMonth?: string;
  memberId?: string;
  label?: string;
  id?: string;
};
type IncomeCashflowEventDraft = CashflowEventDraft & {
  kind: "income";
  cadence: "monthly" | "quarterly" | "yearly" | "oneOff";
};
type ExpenseCashflowEventDraft = CashflowEventDraft & { kind: "expense" };
type HousingMortgageEventDraft = ScenarioEventDraft & {
  type: "housing";
  kind: "mortgage";
  startMonth: string;
  endMonth?: string;
  propertyMarketValue?: number;
  purchasePrice?: number;
  mortgageBaseValue?: number;
  mortgageBaseMode?: "SYNC" | "CUSTOM";
  downPaymentMode?: "percent" | "amount";
  downPaymentPercent?: number;
  downPaymentAmount?: number;
  mortgageRatePct?: number;
  mortgageTermYears?: number;
  mortgagePayment?: number;
  feesOneOff?: { id: string; label?: string; amount: number; month: string }[];
  ongoingCosts?: {
    id: string;
    label?: string;
    amount: number;
    startMonth: string;
    endMonth?: string;
  }[];
  rental?: {
    enabled?: boolean;
    rentMonthly?: number;
    startMonth?: string;
    endMonth?: string;
    discountAmount?: number;
  };
};

const RENT_EVENT_PATTERN = /(?:rent|rental|\u79df)/i;
const LOAN_EVENT_PATTERN =
  /(?:mortgage|loan(?:\s*payment)?|home\s*loan|\u6309\u63ed|\u8cb8\u6b3e)/i;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toNumber = (value: unknown) => (isFiniteNumber(value) ? value : 0);

const mapSeedMemberRole = (id: string): OnboardingV2MemberRole | null => {
  if (id === "self") {
    return "self";
  }
  if (id === "spouse" || id === "partner") {
    return "partner";
  }
  if (id.startsWith("child")) {
    return "child";
  }
  if (id.startsWith("pet")) {
    return "pet";
  }
  return null;
};

const mapSeedMembers = (
  members: ScenarioSeedPayload["members"]
): DraftStorageState["household"] => {
  const nextMembers: OnboardingV2DraftMember[] = [];
  let childIndex = 0;
  let petIndex = 0;

  members.forEach((member) => {
    const role = mapSeedMemberRole(member.id);
    if (!role) {
      return;
    }

    if (role === "self") {
      nextMembers.push({
        id: "self",
        role,
        name: member.name ?? "",
        birthMonth: member.birthMonth ?? "",
      });
      return;
    }

    if (role === "partner") {
      nextMembers.push({
        id: "partner",
        role,
        name: member.name ?? "",
        birthMonth: member.birthMonth ?? "",
      });
      return;
    }

    if (role === "child") {
      childIndex += 1;
      nextMembers.push({
        id: `child-${childIndex}`,
        role,
        name: member.name ?? "",
        birthMonth: member.birthMonth ?? "",
      });
      return;
    }

    petIndex += 1;
    nextMembers.push({
      id: `pet-${petIndex}`,
      role,
      name: member.name ?? "",
      birthMonth: member.birthMonth ?? "",
    });
  });

  const selfMember = nextMembers.find((member) => member.id === "self");
  const normalizedMembers =
    selfMember === undefined
      ? [{ id: "self", role: "self" as const, name: "", birthMonth: "" }, ...nextMembers]
      : nextMembers;

  return {
    hasPartner: normalizedMembers.some((member) => member.id === "partner"),
    childCount: normalizedMembers.filter((member) => member.role === "child").length,
    petCount: normalizedMembers.filter((member) => member.role === "pet").length,
    members: normalizedMembers,
  };
};

const mapSeedMemberId = (
  memberId: string | undefined,
  household: DraftStorageState["household"]
) => {
  if (!memberId) {
    return "";
  }
  if (memberId === "self") {
    return "self";
  }
  if (memberId === "spouse" || memberId === "partner") {
    return household.hasPartner ? "partner" : "";
  }
  if (memberId.startsWith("child")) {
    const index = Number(memberId.replace(/[^\d]/g, "")) || 1;
    return household.members.some((member) => member.id === `child-${index}`)
      ? `child-${index}`
      : "";
  }
  if (memberId.startsWith("pet")) {
    const index = Number(memberId.replace(/[^\d]/g, "")) || 1;
    return household.members.some((member) => member.id === `pet-${index}`)
      ? `pet-${index}`
      : "";
  }
  return "";
};

const isCashflowEvent = (
  event: ScenarioEventDraft
): event is CashflowEventDraft => event.type === "cashflow";

const isHousingMortgageEvent = (
  event: ScenarioEventDraft
): event is HousingMortgageEventDraft =>
  event.type === "housing" && event.kind === "mortgage";

const isRentExpenseEvent = (
  event: ScenarioEventDraft
): event is ExpenseCashflowEventDraft =>
  isCashflowEvent(event) &&
  event.kind === "expense" &&
  event.cadence === "monthly" &&
  RENT_EVENT_PATTERN.test(`${event.id} ${event.label ?? ""}`);

const buildIncomeDrafts = (
  payload: ScenarioSeedPayload,
  household: DraftStorageState["household"]
): OnboardingV2DraftIncome[] =>
  payload.events
    .filter(
      (event): event is IncomeCashflowEventDraft =>
        isCashflowEvent(event) &&
        event.kind === "income" &&
        (event.cadence === "monthly" ||
          event.cadence === "quarterly" ||
          event.cadence === "yearly" ||
          event.cadence === "oneOff")
    )
    .map((event, index) => ({
      id: `income-${index + 1}`,
      label: event.label ?? "",
      amount: toNumber(event.amount),
      frequency: event.cadence,
      startMonth: event.startMonth ?? payload.baseMonth,
      endMonth: event.endMonth ?? "",
      memberId: mapSeedMemberId(event.memberId, household),
      followIncomeGrowth: true,
    }));

const buildLivingSpendDraft = (payload: ScenarioSeedPayload): OnboardingV2DraftLivingSpend => {
  const fixedAmount = payload.events.reduce((sum, event) => {
    if (!isCashflowEvent(event) || event.kind !== "expense" || event.cadence !== "monthly") {
      return sum;
    }
    if (
      isRentExpenseEvent(event) ||
      LOAN_EVENT_PATTERN.test(`${event.id} ${event.label ?? ""}`)
    ) {
      return sum;
    }
    return sum + toNumber(event.amount);
  }, 0);

  return {
    fixed: {
      amount: fixedAmount,
      startMonth: payload.baseMonth,
      endMonth: "",
    },
    variable: {
      amount: 0,
    },
    categoryBreakdown: {
      enabled: false,
      categories: {
        food: 0,
        transport: 0,
        entertainment: 0,
        medical: 0,
        education: 0,
        misc: 0,
      },
    },
    travel: {
      mode: "monthly",
      monthlyAmount: 0,
      annualAmount: 0,
      months: [],
      growthMode: "follow_env",
      growthRate: null,
    },
    tax: {
      mode: "monthly",
      monthlyAmount: 0,
      annualAmount: 0,
      months: [],
      growthMode: "follow_env",
      growthRate: null,
    },
    otherFixed: [],
  };
};

const buildHousingDraft = (payload: ScenarioSeedPayload): OnboardingV2DraftHousing => {
  const housingEvent = payload.events.find(isHousingMortgageEvent);
  if (housingEvent) {
    return {
      mode: "own",
      rent: {
        amount: 0,
        noPayment: true,
        startMonth: payload.baseMonth,
        endMonth: "",
        rentGrowthPct: null,
      },
      own: {
        propertyMarketValue: toNumber(
          housingEvent.propertyMarketValue ?? housingEvent.purchasePrice
        ),
        mortgageBaseValue: toNumber(
          housingEvent.mortgageBaseValue ??
            housingEvent.propertyMarketValue ??
            housingEvent.purchasePrice
        ),
        mortgageBaseMode: housingEvent.mortgageBaseMode ?? "SYNC",
        startMonth: housingEvent.startMonth ?? payload.baseMonth,
        downPaymentMode: housingEvent.downPaymentMode ?? "percent",
        downPaymentPercent: toNumber(housingEvent.downPaymentPercent),
        downPaymentAmount: toNumber(housingEvent.downPaymentAmount),
        mortgageEnabled: true,
        mortgageRatePct: toNumber(housingEvent.mortgageRatePct),
        mortgageTermYears: toNumber(housingEvent.mortgageTermYears ?? 30),
        mortgagePayment: toNumber(housingEvent.mortgagePayment),
        mortgagePaymentSource: housingEvent.mortgagePayment ? "manual" : "estimated",
        fees: (housingEvent.feesOneOff ?? []).map((fee, index) => ({
          id: fee.id || `fee-${index + 1}`,
          label: fee.label ?? "",
          amount: toNumber(fee.amount),
          month: fee.month ?? housingEvent.startMonth ?? payload.baseMonth,
        })),
        ongoingCosts: (housingEvent.ongoingCosts ?? []).map((cost, index) => ({
          id: cost.id || `cost-${index + 1}`,
          label: cost.label ?? "",
          amount: toNumber(cost.amount),
          startMonth: cost.startMonth ?? housingEvent.startMonth ?? payload.baseMonth,
          endMonth: cost.endMonth ?? "",
        })),
        rental: {
          enabled: housingEvent.rental?.enabled ?? false,
          amount: toNumber(housingEvent.rental?.rentMonthly),
          startMonth:
            housingEvent.rental?.startMonth ??
            housingEvent.startMonth ??
            payload.baseMonth,
          endMonth: housingEvent.rental?.endMonth ?? "",
          discountAmount: toNumber(housingEvent.rental?.discountAmount),
        },
      },
    };
  }

  const rentEvent = payload.events.find(isRentExpenseEvent);
  return {
    mode: "rent",
    rent: {
      amount: toNumber(rentEvent?.amount),
      noPayment: !rentEvent,
      startMonth: rentEvent?.startMonth ?? payload.baseMonth,
      endMonth: rentEvent?.endMonth ?? "",
      rentGrowthPct: isFiniteNumber(payload.assumptions?.rentAnnualGrowthPct)
        ? payload.assumptions.rentAnnualGrowthPct
        : null,
    },
    own: {
      propertyMarketValue: 0,
      mortgageBaseValue: 0,
      mortgageBaseMode: "SYNC",
      startMonth: payload.baseMonth,
      downPaymentMode: "percent",
      downPaymentPercent: 0,
      downPaymentAmount: 0,
      mortgageEnabled: false,
      mortgageRatePct: isFiniteNumber(payload.assumptions?.mortgageRatePct)
        ? payload.assumptions.mortgageRatePct
        : 4,
      mortgageTermYears: 30,
      mortgagePayment: 0,
      mortgagePaymentSource: "estimated",
      fees: [],
      ongoingCosts: [],
      rental: {
        enabled: false,
        amount: 0,
        startMonth: payload.baseMonth,
        endMonth: "",
        discountAmount: 0,
      },
    },
  };
};

const buildAssetsDraft = (payload: ScenarioSeedPayload): OnboardingV2DraftAssets => {
  const cashAssets = payload.assets.filter((asset) => asset.kind === "cash");
  const investmentAssets = payload.assets.filter((asset) => asset.kind === "investment");
  const carAsset = payload.assets.find((asset) => asset.kind === "car");

  return {
    cash: {
      amount: cashAssets.reduce((sum, asset) => sum + toNumber(asset.currentValue), 0),
      startMonth: cashAssets[0]?.startMonth ?? payload.baseMonth,
    },
    investment: {
      totalAmount: investmentAssets.reduce(
        (sum, asset) => sum + toNumber(asset.currentValue),
        0
      ),
      startMonth: investmentAssets[0]?.startMonth ?? payload.baseMonth,
      breakdownEnabled: false,
      breakdown: [
        { id: "stock", type: "stock", value: 0, followGlobalReturn: true, customReturnPct: null },
        { id: "etf", type: "etf", value: 0, followGlobalReturn: true, customReturnPct: null },
        { id: "fund", type: "fund", value: 0, followGlobalReturn: true, customReturnPct: null },
        { id: "crypto", type: "crypto", value: 0, followGlobalReturn: true, customReturnPct: null },
        { id: "other", type: "other", value: 0, followGlobalReturn: true, customReturnPct: null },
      ],
    },
    contributions: [],
    car: {
      enabled: Boolean(carAsset),
      value: toNumber(carAsset?.currentValue),
      startMonth: carAsset?.startMonth ?? payload.baseMonth,
      depreciationPct: isFiniteNumber(payload.assumptions?.carDepreciationRatePct)
        ? payload.assumptions.carDepreciationRatePct
        : null,
    },
    insurances: [],
  };
};

const buildInsuranceDraft = (payload: ScenarioSeedPayload): OnboardingV2DraftInsurance => ({
  mode: "quick",
  quick: {
    amount: 0,
    startMonth: payload.baseMonth,
    endMonth: "",
  },
  policies: [],
});

export const buildOnboardingDraftStateFromSeed = (
  payload: ScenarioSeedPayload
): DraftStorageState => {
  const household = mapSeedMembers(payload.members);
  const rawHorizonYears = Math.round(toNumber(payload.assumptions?.horizonMonths) / 12);
  const horizonYears = isPlanningHorizonYears(rawHorizonYears)
    ? rawHorizonYears
    : DEFAULT_PLANNING_HORIZON_YEARS;

  return {
    step: 0,
    profile: {
      baseCurrency: payload.baseCurrency ?? "HKD",
      startMonth: payload.baseMonth,
      horizonYears,
    },
    household,
    assumptions: buildOnboardingAssumptionsDraft({
      ...payload.assumptions,
      baseMonth: payload.baseMonth,
      horizonMonths:
        isFiniteNumber(payload.assumptions?.horizonMonths)
          ? payload.assumptions.horizonMonths
          : resolvePlanningHorizonMonths(horizonYears),
      initialCash: toNumber(payload.initialCash),
    }),
    incomes: buildIncomeDrafts(payload, household),
    livingSpend: buildLivingSpendDraft(payload),
    housing: buildHousingDraft(payload),
    assets: buildAssetsDraft(payload),
    debts: [],
    insurance: buildInsuranceDraft(payload),
  };
};
