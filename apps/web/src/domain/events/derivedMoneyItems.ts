import { nanoid } from "nanoid";
import type {
  AssetOngoingCost,
  AssetPurchaseFee,
  CarPosition,
  HomePosition,
  LoanPosition,
} from "../../store/scenarioStore";
import { normalizeMonthStrict } from "../../utils/month";
import { addMonths } from "../members/age";
import { computeMonthlyPayment } from "../positions/calculations";
import type { EventDefinition, EventGeneratedBy, ScenarioEventRef } from "./types";

const toPositiveNumber = (value: number | null | undefined) =>
  Math.max(0, Number(value ?? 0));

const buildDerivedId = () => `derived_${nanoid(10)}`;

const normalizeMonth = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const normalized = normalizeMonthStrict(value);
  return normalized.ok ? normalized.month : null;
};

const buildDerivedDefinition = (params: {
  title: string;
  type: EventDefinition["type"];
  currency?: string;
  startMonth: string;
  endMonth?: string | null;
  monthlyAmount?: number;
  oneTimeAmount?: number;
  annualGrowthPct?: number;
  incomeSubtype?: EventDefinition["incomeSubtype"];
  generatedBy: EventGeneratedBy;
  linkedAssetId?: string;
  linkedLiabilityId?: string;
}): EventDefinition => ({
  id: buildDerivedId(),
  title: params.title,
  type: params.type,
  kind: "cashflow",
  rule: {
    mode: "params",
    startMonth: params.startMonth,
    endMonth: params.endMonth ?? null,
    monthlyAmount: params.monthlyAmount ?? 0,
    oneTimeAmount: params.oneTimeAmount ?? 0,
    annualGrowthPct: params.annualGrowthPct ?? 0,
  },
  currency: params.currency,
  incomeSubtype: params.incomeSubtype,
  source: "derived",
  generatedBy: params.generatedBy,
  linkedAssetId: params.linkedAssetId,
  linkedLiabilityId: params.linkedLiabilityId,
});

const buildPurchaseFeeEvents = (params: {
  fees?: AssetPurchaseFee[];
  assetId: string;
  assetLabel?: string;
  currency?: string;
}): EventDefinition[] => {
  if (!params.fees || params.fees.length === 0) {
    return [];
  }
  return params.fees.flatMap((fee) => {
    const amount = toPositiveNumber(fee.amount);
    const month = normalizeMonth(fee.month);
    if (!month || amount <= 0) {
      return [];
    }
    const label = fee.label?.trim() || "Purchase fee";
    const title = params.assetLabel ? `${params.assetLabel} · ${label}` : label;
    return [
      buildDerivedDefinition({
        title,
        type: "custom",
        currency: params.currency,
        startMonth: month,
        endMonth: month,
        oneTimeAmount: amount,
        generatedBy: {
          type: "assetCost",
          assetId: params.assetId,
          subType: "purchaseFee",
          key: fee.id,
        },
        linkedAssetId: params.assetId,
      }),
    ];
  });
};

const buildOngoingCostEvents = (params: {
  costs?: AssetOngoingCost[];
  assetId: string;
  assetLabel?: string;
  currency?: string;
}): EventDefinition[] => {
  if (!params.costs || params.costs.length === 0) {
    return [];
  }
  return params.costs.flatMap((cost) => {
    if (!cost.enabled) {
      return [];
    }
    const amount = toPositiveNumber(cost.amount);
    const month = normalizeMonth(cost.startMonth);
    if (!month || amount <= 0) {
      return [];
    }
    const label = cost.key;
    const title = params.assetLabel ? `${params.assetLabel} · ${label}` : label;
    return [
      buildDerivedDefinition({
        title,
        type: "custom",
        currency: params.currency,
        startMonth: month,
        monthlyAmount: amount,
        generatedBy: {
          type: "assetCost",
          assetId: params.assetId,
          subType: "ongoing",
          key: cost.key,
        },
        linkedAssetId: params.assetId,
      }),
    ];
  });
};

export const buildDerivedEventsForHome = (params: {
  home: HomePosition;
  homeId: string;
  currency?: string;
}): EventDefinition[] => {
  const { home, homeId, currency } = params;
  const assetLabel = home.name?.trim();
  const events: EventDefinition[] = [];

  events.push(
    ...buildPurchaseFeeEvents({
      fees: home.purchaseFees,
      assetId: homeId,
      assetLabel,
      currency,
    })
  );
  events.push(
    ...buildOngoingCostEvents({
      costs: home.ongoingCosts,
      assetId: homeId,
      assetLabel,
      currency,
    })
  );

  if (home.rental && home.rental.rentMonthly > 0) {
    const startMonth = normalizeMonth(home.rental.rentStartMonth);
    const endMonth = normalizeMonth(home.rental.rentEndMonth ?? null);
    if (startMonth) {
      events.push(
        buildDerivedDefinition({
          title: assetLabel ? `${assetLabel} · rental income` : "rental income",
          type: "salary",
          incomeSubtype: "rental",
          currency,
          startMonth,
          endMonth: endMonth ?? null,
          monthlyAmount: toPositiveNumber(home.rental.rentMonthly),
          annualGrowthPct: toPositiveNumber(home.rental.rentAnnualGrowthPct),
          generatedBy: { type: "assetRental", assetId: homeId },
          linkedAssetId: homeId,
        })
      );
    }
  }

  return events;
};

export const buildDerivedEventsForCar = (params: {
  car: CarPosition;
  carId: string;
  currency?: string;
}): EventDefinition[] => {
  const { car, carId, currency } = params;
  const assetLabel = "car";
  return [
    ...buildPurchaseFeeEvents({
      fees: car.purchaseFees,
      assetId: carId,
      assetLabel,
      currency,
    }),
    ...buildOngoingCostEvents({
      costs: car.ongoingCosts,
      assetId: carId,
      assetLabel,
      currency,
    }),
  ];
};

export const buildDerivedEventsForLoan = (params: {
  loan: LoanPosition;
  loanId: string;
  currency?: string;
}): EventDefinition[] => {
  const { loan, loanId, currency } = params;
  if (!loan.generatePaymentExpense) {
    return [];
  }
  const startMonth = normalizeMonth(loan.startMonth);
  if (!startMonth) {
    return [];
  }
  const termMonths = Math.max(0, Math.round(toPositiveNumber(loan.termYears) * 12));
  const annualRateDecimal = toPositiveNumber(loan.annualInterestRatePct) / 100;
  const payment =
    loan.paymentMethod === "manual"
      ? toPositiveNumber(loan.monthlyPayment)
      : computeMonthlyPayment(toPositiveNumber(loan.principal), annualRateDecimal, termMonths);
  const endMonth =
    termMonths > 0 ? addMonths(startMonth, termMonths - 1) : startMonth;

  if (payment <= 0) {
    return [];
  }

  return [
    buildDerivedDefinition({
      title: "loan payment",
      type: "custom",
      currency,
      startMonth,
      endMonth,
      monthlyAmount: payment,
      generatedBy: { type: "loanPayment", liabilityId: loanId, assetId: loan.linkedAssetId },
      linkedLiabilityId: loanId,
      linkedAssetId: loan.linkedAssetId,
    }),
  ];
};

export const cleanupDerivedEvents = (
  eventLibrary: EventDefinition[],
  eventRefs: ScenarioEventRef[],
  predicate: (definition: EventDefinition) => boolean
): { eventLibrary: EventDefinition[]; eventRefs: ScenarioEventRef[] } => {
  const removedIds = new Set(
    eventLibrary.filter((definition) => predicate(definition)).map((definition) => definition.id)
  );

  if (removedIds.size === 0) {
    return { eventLibrary, eventRefs };
  }

  return {
    eventLibrary: eventLibrary.filter((definition) => !removedIds.has(definition.id)),
    eventRefs: eventRefs.filter((ref) => !removedIds.has(ref.refId)),
  };
};

export const appendDerivedEvents = (
  eventLibrary: EventDefinition[],
  eventRefs: ScenarioEventRef[],
  definitions: EventDefinition[]
): { eventLibrary: EventDefinition[]; eventRefs: ScenarioEventRef[] } => {
  if (definitions.length === 0) {
    return { eventLibrary, eventRefs };
  }
  const refs = definitions.map<ScenarioEventRef>((definition) => ({
    refId: definition.id,
    enabled: true,
    highlighted: false,
  }));
  return {
    eventLibrary: [...eventLibrary, ...definitions],
    eventRefs: [...eventRefs, ...refs],
  };
};
