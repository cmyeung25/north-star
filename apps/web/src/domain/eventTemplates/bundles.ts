import { nanoid } from "nanoid";
import { addMonths } from "../members/age";
import { isValidMonthKey } from "../../utils/monthKey";
import type { EventSource, MonthKey, ScenarioEventDraft } from "../scenarioV2/events";

const createBundleEventId = () => `evt_v2_bundle_${nanoid(8)}`;
const createHomeAssetId = () => `asset_home_${nanoid(6)}`;
const createMortgageLiabilityId = () => `liability_mortgage_${nanoid(6)}`;

type BundleFeeItem = {
  id: string;
  label?: string;
  amount: number;
  month: MonthKey;
};

type BundleOngoingCost = {
  id: string;
  label?: string;
  amount: number;
  startMonth: MonthKey;
  endMonth?: MonthKey;
};

type BundleSource = NonNullable<EventSource>;

export type NewBabyPlanInput = {
  birthMonth: MonthKey;
  deliveryCost?: number;
  childcareMonthly: number;
  helperEnabled: boolean;
  helperMonthly?: number;
  agencyFee?: number;
  schoolingEnabled: boolean;
  schoolingAmount?: number;
  schoolingCadence?: "monthly" | "yearly";
  schoolingStartMonth?: MonthKey;
};

export type NewBabyPlanLabels = {
  deliveryCost: string;
  childcare: string;
  helperMonthly: string;
  agencyFee: string;
  schooling: string;
};

export type HomePurchaseBundleInput = {
  eventId?: string;
  bundleId?: string;
  label?: string;
  startMonth: MonthKey;
  propertyMarketValue?: number;
  mortgageBaseValue?: number;
  mortgageBaseMode?: "SYNC" | "CUSTOM";
  purchasePrice: number;
  downPaymentMode: "percent" | "amount";
  downPaymentPercent?: number;
  downPaymentAmount?: number;
  mortgageRatePct: number;
  mortgageTermYears: number;
  mortgagePayment: number;
  mortgagePaymentIsEstimated?: boolean;
  feesOneOff?: BundleFeeItem[];
  ongoingCosts?: BundleOngoingCost[];
  rental?: {
    enabled: boolean;
    rentMonthly: number;
    startMonth?: MonthKey;
    endMonth?: MonthKey;
    discountMonthly?: number;
    startMonthStrategy?: StartMonthStrategy;
  };
  propertyAssetId?: string;
  mortgageLiabilityId?: string;
};

export type StartMonthStrategy = "purchase" | "plus1" | "custom";

export const deriveStartMonth = (
  purchaseMonth: MonthKey,
  strategy: StartMonthStrategy | undefined,
  customMonth?: MonthKey
): MonthKey => {
  if (strategy === "custom") {
    return isValidMonthKey(customMonth ?? "") ? customMonth ?? purchaseMonth : purchaseMonth;
  }
  if (strategy === "plus1") {
    return addMonths(purchaseMonth, 1);
  }
  return purchaseMonth;
};

export type BundleWizardInput =
  | {
      templateId: "life_new_baby_plan";
      input: NewBabyPlanInput;
    }
  | {
      templateId: "life_home_purchase";
      input: HomePurchaseBundleInput;
    }
  | {
      templateId: "life_marriage_plan";
      input: MarriagePlanInput;
    };

export type WeddingStyle =
  | "simple_register"
  | "small_banquet"
  | "hotel_banquet"
  | "luxury_wedding"
  | "destination_wedding"
  | "custom";

export type TravelMonthMode = "same" | "plus1" | "custom";

export type TravelBudgetMode = "total" | "perPerson";

export type WeddingBreakdownItem = {
  id: string;
  label: string;
  amount: number;
  ratio: number;
};

export type MarriagePlanInput = {
  weddingMonth: MonthKey;
  title?: string;
  weddingStyle: WeddingStyle;
  totalWeddingBudget: number;
  breakdownEnabled: boolean;
  breakdownItems: WeddingBreakdownItem[];
  includeTravel: boolean;
  travelLabel?: string;
  travelMonthMode?: TravelMonthMode;
  travelCustomMonth?: MonthKey;
  travelBudgetMode?: TravelBudgetMode;
  travelTotal?: number;
  travellersCount?: number;
  perPersonBudget?: number;
  extraHoneymoonEnabled?: boolean;
  extraTravelLabel?: string;
  extraTravelMonthMode?: TravelMonthMode;
  extraTravelCustomMonth?: MonthKey;
  extraTravelBudgetMode?: TravelBudgetMode;
  extraTravelTotal?: number;
  extraTravellersCount?: number;
  extraPerPersonBudget?: number;
};

export type MarriagePlanLabels = {
  weddingMain: string;
  travel: string;
};

export const computeTravelTotal = ({
  mode,
  total,
  count,
  perPerson,
}: {
  mode: TravelBudgetMode;
  total?: number;
  count?: number;
  perPerson?: number;
}) => {
  if (mode === "total") {
    return Math.max(0, Math.round(total ?? 0));
  }
  return Math.max(0, Math.round((count ?? 0) * (perPerson ?? 0)));
};

export const normalizeWeddingBreakdown = (
  totalWeddingBudget: number,
  items: WeddingBreakdownItem[]
) => {
  const total = Math.max(0, Math.round(totalWeddingBudget));
  if (items.length === 0) {
    return [];
  }
  const normalized = items.map((item) => ({
    ...item,
    amount: Math.max(0, Math.round((total * item.ratio) / 100)),
  }));
  const allocated = normalized.reduce((sum, item) => sum + item.amount, 0);
  const diff = total - allocated;
  const lastIndex = normalized.length - 1;
  normalized[lastIndex] = {
    ...normalized[lastIndex],
    amount: Math.max(0, normalized[lastIndex].amount + diff),
  };
  return normalized;
};

const resolveTravelMonth = (
  weddingMonth: MonthKey,
  mode: TravelMonthMode | undefined,
  customMonth?: MonthKey
) => {
  if (mode === "custom") {
    return isValidMonthKey(customMonth ?? "") ? customMonth ?? weddingMonth : weddingMonth;
  }
  if (mode === "plus1") {
    return addMonths(weddingMonth, 1);
  }
  return weddingMonth;
};

export const buildMarriageBundleEvents = (
  input: MarriagePlanInput,
  labels: MarriagePlanLabels,
  source: {
    bundleInstanceId: string;
    templateId: string;
    bundleTitle?: string;
  },
  createId: () => string = createBundleEventId
): ScenarioEventDraft[] => {
  const events: ScenarioEventDraft[] = [];
  if (!isValidMonthKey(input.weddingMonth)) {
    return events;
  }

  if (input.breakdownEnabled) {
    const breakdown = input.breakdownItems.filter((item) => item.amount > 0);
    breakdown.forEach((item) => {
      events.push(
        buildCashflowEvent({
          id: createId(),
          label: item.label,
          cadence: "oneOff",
          amount: item.amount,
          occurrenceMonth: input.weddingMonth,
          tags: ["wedding"],
          source: {
            ...source,
            componentKey: `weddingBreakdown:${item.id}`,
          },
        })
      );
    });
  } else {
    events.push(
      buildCashflowEvent({
        id: createId(),
        label: input.title || labels.weddingMain,
        cadence: "oneOff",
        amount: Math.max(0, Math.round(input.totalWeddingBudget)),
        occurrenceMonth: input.weddingMonth,
        tags: ["wedding"],
        source: {
          ...source,
          componentKey: "weddingMain",
        },
      })
    );
  }

  if (input.includeTravel) {
    const amount = computeTravelTotal({
      mode: input.travelBudgetMode ?? "total",
      total: input.travelTotal,
      count: input.travellersCount,
      perPerson: input.perPersonBudget,
    });
    if (amount > 0) {
      events.push(
        buildCashflowEvent({
          id: createId(),
          label: input.travelLabel || labels.travel,
          cadence: "oneOff",
          amount,
          occurrenceMonth: resolveTravelMonth(
            input.weddingMonth,
            input.travelMonthMode,
            input.travelCustomMonth
          ),
          tags: ["wedding", "travel"],
          source: {
            ...source,
            componentKey: "weddingTravel",
          },
        })
      );
    }
  }

  if (input.extraHoneymoonEnabled) {
    const amount = computeTravelTotal({
      mode: input.extraTravelBudgetMode ?? "total",
      total: input.extraTravelTotal,
      count: input.extraTravellersCount,
      perPerson: input.extraPerPersonBudget,
    });
    if (amount > 0) {
      events.push(
        buildCashflowEvent({
          id: createId(),
          label: input.extraTravelLabel || labels.travel,
          cadence: "oneOff",
          amount,
          occurrenceMonth: resolveTravelMonth(
            input.weddingMonth,
            input.extraTravelMonthMode,
            input.extraTravelCustomMonth
          ),
          tags: ["wedding", "travel"],
          source: {
            ...source,
            componentKey: "weddingTravelExtra",
          },
        })
      );
    }
  }

  return events;
};

const buildCashflowEvent = ({
  id,
  label,
  cadence,
  amount,
  startMonth,
  occurrenceMonth,
  tags,
  source,
}: {
  id?: string;
  label: string;
  cadence: "monthly" | "yearly" | "oneOff";
  amount: number;
  startMonth?: MonthKey;
  occurrenceMonth?: MonthKey;
  tags: string[];
  source?: BundleSource;
}): ScenarioEventDraft => ({
  id: id ?? createBundleEventId(),
  type: "cashflow",
  kind: "expense",
  cadence,
  amount,
  growthMode: cadence === "oneOff" ? "none" : "assumption",
  growthSource: cadence === "oneOff" ? undefined : "inflation",
  startMonth: cadence === "oneOff" ? undefined : startMonth,
  occurrenceMonth: cadence === "oneOff" ? occurrenceMonth : undefined,
  tags,
  label,
  source,
});

export const buildNewBabyBundleEvents = (
  input: NewBabyPlanInput,
  labels: NewBabyPlanLabels,
  source: {
    bundleInstanceId: string;
    templateId: string;
    bundleTitle?: string;
  },
  createId: () => string = createBundleEventId
): ScenarioEventDraft[] => {
  const events: ScenarioEventDraft[] = [];
  const birthMonth = input.birthMonth;
  if (!isValidMonthKey(birthMonth)) {
    return events;
  }
  const childcareAmount = input.childcareMonthly;

  if (input.deliveryCost && input.deliveryCost > 0) {
    events.push(
      buildCashflowEvent({
        id: createId(),
        label: labels.deliveryCost,
        cadence: "oneOff",
        amount: input.deliveryCost,
        occurrenceMonth: birthMonth,
        tags: ["baby"],
        source: {
          ...source,
          componentKey: "deliveryCost",
        },
      })
    );
  }

  if (childcareAmount > 0) {
    events.push(
      buildCashflowEvent({
        id: createId(),
        label: labels.childcare,
        cadence: "monthly",
        amount: childcareAmount,
        startMonth: birthMonth,
        tags: ["baby"],
        source: {
          ...source,
          componentKey: "childcare",
        },
      })
    );
  }

  if (input.helperEnabled) {
    if (input.helperMonthly && input.helperMonthly > 0) {
      events.push(
        buildCashflowEvent({
          id: createId(),
          label: labels.helperMonthly,
          cadence: "monthly",
          amount: input.helperMonthly,
          startMonth: birthMonth,
          tags: ["helper"],
          source: {
            ...source,
            componentKey: "helperMonthly",
          },
        })
      );
    }
    if (input.agencyFee && input.agencyFee > 0) {
      events.push(
        buildCashflowEvent({
          id: createId(),
          label: labels.agencyFee,
          cadence: "oneOff",
          amount: input.agencyFee,
          occurrenceMonth: birthMonth,
          tags: ["helper"],
          source: {
            ...source,
            componentKey: "helperAgency",
          },
        })
      );
    }
  }

  if (input.schoolingEnabled) {
    const amount = input.schoolingAmount ?? 0;
    const cadence = input.schoolingCadence ?? "monthly";
    const startMonth = input.schoolingStartMonth ?? birthMonth;
    if (amount > 0 && isValidMonthKey(startMonth)) {
      events.push(
        buildCashflowEvent({
          id: createId(),
          label: labels.schooling,
          cadence,
          amount,
          startMonth,
          tags: ["schooling"],
          source: {
            ...source,
            componentKey: "schooling",
          },
        })
      );
    }
  }

  return events;
};

export const buildHomePurchaseBundleEvent = (
  input: HomePurchaseBundleInput,
  source: {
    bundleInstanceId: string;
    templateId: string;
    bundleTitle?: string;
  },
  createId: () => string = createBundleEventId
): ScenarioEventDraft => {
  const feesOneOff =
    input.feesOneOff?.filter(
      (fee) => fee.amount > 0 && isValidMonthKey(fee.month)
    ) ?? [];
  const ongoingCosts =
    input.ongoingCosts?.filter(
      (cost) => cost.amount > 0 && isValidMonthKey(cost.startMonth)
    ) ?? [];
  const rental =
    input.rental?.enabled && input.rental.rentMonthly > 0
      ? {
          enabled: true,
          rentMonthly: Math.max(
            0,
            input.rental.rentMonthly - (input.rental.discountMonthly ?? 0)
          ),
          startMonth: deriveStartMonth(
            input.startMonth,
            input.rental.startMonthStrategy ??
              (input.rental.startMonth ? "custom" : "purchase"),
            input.rental.startMonth
          ),
          endMonth: input.rental.endMonth && isValidMonthKey(input.rental.endMonth)
            ? input.rental.endMonth
            : undefined,
        }
      : undefined;
  const propertyAssetId = input.propertyAssetId ?? createHomeAssetId();
  const mortgageLiabilityId =
    input.mortgageLiabilityId ?? createMortgageLiabilityId();
  const propertyMarketValue = input.propertyMarketValue ?? input.purchasePrice;
  const mortgageBaseValue = input.mortgageBaseValue ?? propertyMarketValue;
  const mortgageBaseMode =
    input.mortgageBaseMode ??
    (mortgageBaseValue !== propertyMarketValue ? "CUSTOM" : "SYNC");

  return {
    id: input.eventId ?? createId(),
    type: "housing",
    kind: "mortgage",
    startMonth: input.startMonth,
    purchasePrice: propertyMarketValue,
    propertyMarketValue,
    mortgageBaseValue,
    mortgageBaseMode,
    downPaymentMode: input.downPaymentMode,
    downPaymentPercent:
      input.downPaymentMode === "percent" ? input.downPaymentPercent : undefined,
    downPaymentAmount:
      input.downPaymentMode === "amount" ? input.downPaymentAmount : undefined,
    mortgageRatePct: input.mortgageRatePct,
    mortgageTermYears: input.mortgageTermYears,
    mortgagePayment: input.mortgagePayment,
    mortgagePaymentIsEstimated: input.mortgagePaymentIsEstimated,
    feesOneOff: feesOneOff.length > 0 ? feesOneOff : undefined,
    ongoingCosts: ongoingCosts.length > 0 ? ongoingCosts : undefined,
    rental,
    propertyAssetId,
    mortgageLiabilityId,
    label: input.label,
    source: {
      ...source,
      bundleInstanceId: input.bundleId ?? source.bundleInstanceId,
      componentKey: "homePurchase",
    },
  };
};
