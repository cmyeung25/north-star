import { nanoid } from "nanoid";
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
  };
  propertyAssetId?: string;
  mortgageLiabilityId?: string;
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
          startMonth: input.rental.startMonth && isValidMonthKey(input.rental.startMonth)
            ? input.rental.startMonth
            : undefined,
          endMonth: input.rental.endMonth && isValidMonthKey(input.rental.endMonth)
            ? input.rental.endMonth
            : undefined,
        }
      : undefined;
  const propertyAssetId = input.propertyAssetId ?? createHomeAssetId();
  const mortgageLiabilityId =
    input.mortgageLiabilityId ?? createMortgageLiabilityId();

  return {
    id: input.eventId ?? createId(),
    type: "housing",
    kind: "mortgage",
    startMonth: input.startMonth,
    purchasePrice: input.purchasePrice,
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
