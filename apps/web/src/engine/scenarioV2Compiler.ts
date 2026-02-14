import type { ProjectionInput } from "@north-star/engine";
import { addMonths, monthsBetween } from "../domain/members/age";
import {
  computeDisplaySegments,
  getEventBaseEventId,
  getEventSegmentRole,
} from "../domain/scenarioV2/eventSegments";
import { mapScenarioToEngineInput } from "./adapter";
import { isValidMonthKey, compareMonthKey } from "../utils/monthKey";
import type { EventDefinition } from "../domain/events/types";
import type {
  CashflowEvent,
  HousingEvent,
  InsuranceEvent,
  LoanEvent,
  ScenarioEvent,
} from "../domain/scenarioV2/events";
import { applyAnnualRate, resolveCashflowAmountForMonth } from "../domain/cashflowGrowth";
import { computeMonthlyPayment } from "../domain/positions/calculations";
import type { EventType } from "../features/timeline/schema";
import type {
  Scenario,
  ScenarioAssumptions,
  ScenarioMember,
  ScenarioMeta,
  ScenarioAsset,
  ScenarioLiability,
  HomePositionDraft,
  LoanPositionDraft,
  InsurancePositionDraft,
  CarPositionDraft,
} from "../store/scenarioStore";

export type LedgerRow = {
  month: string;
  amount: number;
  sourceEventId: string;
  label?: string;
  memberId?: string;
  tags?: string[];
  kind?: "income" | "expense";
  linkedLiabilityId?: string;
};

export type ScenarioV2 = {
  id: string;
  name: string;
  baseCurrency: string;
  updatedAt: number;
  assumptions: ScenarioAssumptions;
  members?: ScenarioMember[];
  assets?: ScenarioAsset[];
  liabilities?: ScenarioLiability[];
  events?: ScenarioEvent[];
  meta?: ScenarioMeta;
};

const resolveHorizonEndMonth = (
  assumptions: ScenarioAssumptions
): string | null => {
  const baseMonth = assumptions.baseMonth;
  const horizonMonths = assumptions.horizonMonths;
  if (!baseMonth || !isValidMonthKey(baseMonth) || !Number.isFinite(horizonMonths)) {
    return null;
  }
  return addMonths(baseMonth, Math.max(horizonMonths - 1, 0));
};

const buildCashflowMonths = (
  event: CashflowEvent,
  assumptions: ScenarioAssumptions
): string[] => {
  if (event.cadence === "oneOff") {
    if (event.occurrenceMonth && isValidMonthKey(event.occurrenceMonth)) {
      return [event.occurrenceMonth];
    }
    return [];
  }

  if (!event.startMonth || !isValidMonthKey(event.startMonth)) {
    return [];
  }

  const horizonEndMonth = resolveHorizonEndMonth(assumptions);
  const endMonth =
    event.endMonth && isValidMonthKey(event.endMonth)
      ? event.endMonth
      : horizonEndMonth;

  if (!endMonth || compareMonthKey(event.startMonth, endMonth) > 0) {
    return [];
  }

  const stepMonths =
    event.cadence === "monthly"
      ? 1
      : event.cadence === "quarterly"
      ? 3
      : event.cadence === "yearly"
      ? 12
      : event.everyNMonths ?? 1;

  const months: string[] = [];
  let current = event.startMonth;
  while (compareMonthKey(current, endMonth) <= 0) {
    months.push(current);
    current = addMonths(current, stepMonths);
  }

  return months;
};



type NormalizedCashflowLedgerEvent = {
  event: CashflowEvent;
  sourceEventId: string;
};

const normalizeCashflowEventSeries = (events: CashflowEvent[]): NormalizedCashflowLedgerEvent[] => {
  const grouped = new Map<string, CashflowEvent[]>();
  events.forEach((event) => {
    const baseEventId = getEventBaseEventId(event);
    const bucket = grouped.get(baseEventId) ?? [];
    bucket.push(event);
    grouped.set(baseEventId, bucket);
  });

  return Array.from(grouped.values()).flatMap<NormalizedCashflowLedgerEvent>((groupEvents) => {
    const parent =
      groupEvents.find((event) => getEventSegmentRole(event) === "parent") ?? groupEvents[0];
    return computeDisplaySegments(groupEvents).map((segment) => ({
      sourceEventId: segment.sourceEventId,
      event: {
        ...segment.event,
        growthMode: segment.event.growthMode ?? parent.growthMode,
        growthSource: segment.event.growthSource ?? parent.growthSource,
        customGrowthRatePct: segment.event.customGrowthRatePct ?? parent.customGrowthRatePct,
      },
    }));
  });
};

const normalizeScenarioEventSegments = (events: ScenarioEvent[]): ScenarioEvent[] => {
  const grouped = new Map<string, ScenarioEvent[]>();
  events.forEach((event) => {
    const baseEventId = getEventBaseEventId(event);
    const bucket = grouped.get(baseEventId) ?? [];
    bucket.push(event);
    grouped.set(baseEventId, bucket);
  });

  return Array.from(grouped.values()).flatMap((groupEvents) => {
    if (groupEvents.length <= 1 || groupEvents[0]?.type === "cashflow") {
      return groupEvents.map((event) => ({ ...event, baseEventId: getEventBaseEventId(event) }));
    }

    const sameType = groupEvents.every((event) => event.type === groupEvents[0]?.type);
    if (!sameType) {
      return groupEvents;
    }

    return computeDisplaySegments(groupEvents).map((segment) => segment.event);
  });
};


const resolveBudgetOccurrenceCount = (event: CashflowEvent): number | null => {
  const meta = event.meta as
    | { budgetKind?: string; occurrenceMonths?: unknown; monthOfYear?: unknown }
    | undefined;
  if (!meta?.budgetKind) {
    return null;
  }

  const monthOfYear = Array.isArray(meta.monthOfYear)
    ? meta.monthOfYear.filter(
        (value): value is number => typeof value === "number" && value >= 1 && value <= 12
      )
    : [];
  const directMonths = Array.isArray(meta.occurrenceMonths)
    ? meta.occurrenceMonths.filter((month): month is string => isValidMonthKey(month))
    : [];
  const selectors = new Set<number>([
    ...monthOfYear,
    ...directMonths.map((month) => Number(month.split("-")[1])),
  ]);

  return selectors.size > 0 ? selectors.size : null;
};

const resolveBudgetOccurrenceMonths = (
  event: CashflowEvent,
  assumptions: ScenarioAssumptions
): string[] | null => {
  if (event.cadence !== "yearly") {
    return null;
  }
  const meta = event.meta as
    | { budgetKind?: string; occurrenceMonths?: unknown; monthOfYear?: unknown }
    | undefined;
  if (!meta?.budgetKind) {
    return null;
  }

  const monthOfYear = Array.isArray(meta.monthOfYear)
    ? meta.monthOfYear.filter(
        (value): value is number => typeof value === "number" && value >= 1 && value <= 12
      )
    : [];
  const directMonths = Array.isArray(meta.occurrenceMonths)
    ? meta.occurrenceMonths.filter((month): month is string => isValidMonthKey(month))
    : [];

  const selectors = new Set<number>([
    ...monthOfYear,
    ...directMonths.map((month) => Number(month.split("-")[1])),
  ]);
  if (selectors.size === 0) {
    return null;
  }

  const baseMonths = buildCashflowMonths(event, assumptions);
  if (baseMonths.length === 0) {
    return null;
  }

  const startMonth = event.startMonth;
  if (!startMonth) {
    return null;
  }
  const horizonEndMonth = resolveHorizonEndMonth(assumptions);
  const endMonth =
    event.endMonth && isValidMonthKey(event.endMonth)
      ? event.endMonth
      : horizonEndMonth;
  if (!endMonth || compareMonthKey(startMonth, endMonth) > 0) {
    return null;
  }

  const months: string[] = [];
  let current = startMonth;
  while (compareMonthKey(current, endMonth) <= 0) {
    const monthNumber = Number(current.split("-")[1]);
    if (selectors.has(monthNumber)) {
      months.push(current);
    }
    current = addMonths(current, 1);
  }

  return months;
};

const resolvePropertyMarketValue = (event: {
  propertyMarketValue?: number;
  purchasePrice?: number;
}) => event.propertyMarketValue ?? event.purchasePrice ?? 0;

const resolveMortgageBaseValue = (event: {
  mortgageBaseValue?: number;
  propertyMarketValue?: number;
  purchasePrice?: number;
}) => event.mortgageBaseValue ?? event.purchasePrice ?? event.propertyMarketValue ?? 0;

const resolveDownPaymentAmount = (
  event: {
    purchasePrice?: number;
    propertyMarketValue?: number;
    downPaymentMode?: "percent" | "amount";
    downPaymentPercent?: number;
    downPaymentAmount?: number;
  },
  baseValue?: number
) => {
  const purchasePrice = baseValue ?? event.purchasePrice ?? event.propertyMarketValue ?? 0;
  if (event.downPaymentMode === "amount") {
    return event.downPaymentAmount ?? 0;
  }
  const percent = event.downPaymentPercent ?? 0;
  return purchasePrice * (percent / 100);
};

const buildRangeMonths = (params: {
  startMonth?: string;
  endMonth?: string | null;
  assumptions: ScenarioAssumptions;
}) => {
  const { startMonth, endMonth, assumptions } = params;
  if (!startMonth || !isValidMonthKey(startMonth)) {
    return [];
  }
  const horizonEndMonth = resolveHorizonEndMonth(assumptions);
  const resolvedEnd =
    endMonth && isValidMonthKey(endMonth) ? endMonth : horizonEndMonth;
  if (!resolvedEnd || compareMonthKey(startMonth, resolvedEnd) > 0) {
    return [];
  }
  const months: string[] = [];
  let current = startMonth;
  while (compareMonthKey(current, resolvedEnd) <= 0) {
    months.push(current);
    current = addMonths(current, 1);
  }
  return months;
};


const resolveRentAnnualGrowthPct = (
  growthMode: "none" | "assumption" | "custom" | undefined,
  customGrowthPct: number | undefined,
  assumptions: ScenarioAssumptions
): number => {
  if (growthMode === "assumption") {
    return assumptions.rentAnnualGrowthPct ?? 0;
  }
  if (growthMode === "custom") {
    return customGrowthPct ?? 0;
  }
  return 0;
};

const resolvePropertyAnnualGrowthPct = (
  growthMode: "none" | "assumption" | "custom" | undefined,
  customGrowthPct: number | undefined,
  assumptions: ScenarioAssumptions
): number => {
  if (growthMode === "assumption") {
    return assumptions.propertyAppreciationPct ?? 0;
  }
  if (growthMode === "custom") {
    return customGrowthPct ?? 0;
  }
  return 0;
};

const buildGrowthSchedule = (
  amount: number,
  months: string[],
  startMonth: string,
  annualGrowthPct: number
): Array<{ month: string; amount: number }> =>
  months.map((month) => ({
    month,
    amount: Math.abs(
      applyAnnualRate(amount, Math.max(0, monthsBetween(startMonth, month)), annualGrowthPct)
    ),
  }));

const buildTermEndMonth = (startMonth: string, termMonths: number) => {
  if (!isValidMonthKey(startMonth) || termMonths <= 0) {
    return null;
  }
  return addMonths(startMonth, termMonths - 1);
};

const buildHousingLedgerRows = (
  event: HousingEvent,
  assumptions: ScenarioAssumptions
): LedgerRow[] => {
  const rows: LedgerRow[] = [];
  if (!isValidMonthKey(event.startMonth)) {
    return rows;
  }

  if (event.kind === "rent") {
    const rentMonthly = event.rentMonthly ?? 0;
    if (rentMonthly > 0) {
      const annualGrowthPct = resolveRentAnnualGrowthPct(
        event.rentGrowthMode,
        event.rentAnnualGrowthPct,
        assumptions
      );
      const months = buildRangeMonths({
        startMonth: event.startMonth,
        endMonth: event.endMonth ?? null,
        assumptions,
      });
      months.forEach((month) => {
        const monthsFromStart = Math.max(0, monthsBetween(event.startMonth, month));
        rows.push({
          month,
          amount: -Math.abs(applyAnnualRate(rentMonthly, monthsFromStart, annualGrowthPct)),
          sourceEventId: event.id,
          label: event.label,
          memberId: event.memberId,
          tags: event.tags ? [...event.tags] : undefined,
          kind: "expense",
        });
      });
    }
    return rows;
  }

  const mortgageBaseValue = resolveMortgageBaseValue(event);
  const downPayment = resolveDownPaymentAmount(event, mortgageBaseValue);
  const principal = Math.max(0, mortgageBaseValue - downPayment);
  const termMonths = Math.max(0, Math.round((event.mortgageTermYears ?? 0) * 12));
  const payment =
    event.mortgagePayment ??
    computeMonthlyPayment(principal, (event.mortgageRatePct ?? 0) / 100, termMonths);
  const termEndMonth = buildTermEndMonth(event.startMonth, termMonths);
  const paymentMonths = buildRangeMonths({
    startMonth: event.startMonth,
    endMonth: termEndMonth ?? event.endMonth ?? null,
    assumptions,
  });

  paymentMonths.forEach((month) => {
    if (!payment) {
      return;
    }
    rows.push({
      month,
      amount: -Math.abs(payment),
      sourceEventId: event.id,
      label: event.label,
      memberId: event.memberId,
      tags: event.tags ? [...event.tags] : undefined,
      kind: "expense",
      linkedLiabilityId: event.mortgageLiabilityId ?? event.id,
    });
  });

  (event.feesOneOff ?? []).forEach((fee) => {
    if (!isValidMonthKey(fee.month)) {
      return;
    }
    if (!fee.amount) {
      return;
    }
    rows.push({
      month: fee.month,
      amount: -Math.abs(fee.amount),
      sourceEventId: event.id,
      label: fee.label ?? event.label,
      memberId: event.memberId,
      tags: event.tags ? [...event.tags] : undefined,
      kind: "expense",
    });
  });

  (event.ongoingCosts ?? []).forEach((cost) => {
    if (!isValidMonthKey(cost.startMonth)) {
      return;
    }
    const months = buildRangeMonths({
      startMonth: cost.startMonth,
      endMonth: cost.endMonth ?? event.endMonth ?? null,
      assumptions,
    });
    months.forEach((month) => {
      rows.push({
        month,
        amount: -Math.abs(cost.amount ?? 0),
        sourceEventId: event.id,
        label: cost.label ?? event.label,
        memberId: event.memberId,
        tags: event.tags ? [...event.tags] : undefined,
        kind: "expense",
      });
    });
  });

  if (event.rental?.enabled && event.rental.rentMonthly) {
    const rentalStartMonth = event.rental.startMonth ?? event.startMonth;
    const vacancyRate = event.rental.vacancyRatePct ?? 0;
    const rentNet = Math.max(0, event.rental.rentMonthly * (1 - vacancyRate / 100));
    const annualGrowthPct = resolveRentAnnualGrowthPct(
      event.rental.rentGrowthMode,
      event.rental.rentAnnualGrowthPct,
      assumptions
    );
    const months = buildRangeMonths({
      startMonth: rentalStartMonth,
      endMonth: event.rental.endMonth ?? event.endMonth ?? null,
      assumptions,
    });
    months.forEach((month) => {
      const monthsFromStart = Math.max(0, monthsBetween(rentalStartMonth, month));
      rows.push({
        month,
        amount: Math.abs(applyAnnualRate(rentNet, monthsFromStart, annualGrowthPct)),
        sourceEventId: event.id,
        label: event.label,
        memberId: event.memberId,
        tags: event.tags ? [...event.tags] : undefined,
        kind: "income",
      });
    });
  }

  return rows;
};

const buildLoanLedgerRows = (
  event: LoanEvent,
  assumptions: ScenarioAssumptions
): LedgerRow[] => {
  if (!isValidMonthKey(event.startMonth)) {
    return [];
  }
  const termMonths = Math.max(0, Math.round((event.termYears ?? 0) * 12));
  const payment =
    event.monthlyPayment ??
    computeMonthlyPayment(
      event.principal,
      (event.annualInterestRatePct ?? 0) / 100,
      termMonths
    );
  const termEndMonth = buildTermEndMonth(event.startMonth, termMonths);
  const months = buildRangeMonths({
    startMonth: event.startMonth,
    endMonth: termEndMonth,
    assumptions,
  });
  return months.map((month) => ({
    month,
    amount: -Math.abs(payment),
    sourceEventId: event.id,
    label: event.label,
    memberId: event.memberId,
    tags: event.tags ? [...event.tags] : undefined,
    kind: "expense",
    linkedLiabilityId: event.liabilityId ?? event.id,
  }));
};

const buildInsuranceLedgerRows = (
  event: InsuranceEvent,
  assumptions: ScenarioAssumptions
): LedgerRow[] => {
  const rows: LedgerRow[] = [];
  if (event.mode === "quick") {
    if (!event.startMonth || !isValidMonthKey(event.startMonth)) {
      return rows;
    }
    const months = buildRangeMonths({
      startMonth: event.startMonth,
      endMonth: event.endMonth ?? null,
      assumptions,
    });
    const premium = event.premiumMonthly ?? 0;
    months.forEach((month) => {
      rows.push({
        month,
        amount: -Math.abs(premium),
        sourceEventId: event.id,
        label: event.label,
        memberId: event.memberId,
        tags: event.tags ? [...event.tags] : undefined,
        kind: "expense",
      });
    });
    return rows;
  }

  (event.policies ?? []).forEach((policy) => {
    if (!isValidMonthKey(policy.startMonth)) {
      return;
    }
    const months = buildRangeMonths({
      startMonth: policy.startMonth,
      endMonth: policy.endMonth ?? null,
      assumptions,
    });
    const premium = policy.premiumMonthly ?? 0;
    months.forEach((month) => {
      rows.push({
        month,
        amount: -Math.abs(premium),
        sourceEventId: event.id,
        label: policy.name ?? event.label,
        memberId: event.memberId,
        tags: event.tags ? [...event.tags] : undefined,
        kind: "expense",
      });
    });
  });

  return rows;
};

export const compileScenarioV2ToLedger = (
  scenario: ScenarioV2
): LedgerRow[] => {
  const events = scenario.events ?? [];
  const normalizedEvents = normalizeScenarioEventSegments(events);
  const assumptions = scenario.assumptions;
  const normalizedCashflowEvents = normalizeCashflowEventSeries(
    normalizedEvents.filter((event): event is CashflowEvent => event.type === "cashflow")
  );

  const cashflowRows = normalizedCashflowEvents.flatMap<LedgerRow>(({ event, sourceEventId }) => {
    const months = resolveBudgetOccurrenceMonths(event, assumptions) ?? buildCashflowMonths(event, assumptions);
    if (months.length === 0) {
      return [];
    }
    const rawAmount = Number(event.amount);
    if (!Number.isFinite(rawAmount) || rawAmount === 0) {
      return [];
    }

    const amountDivisor = resolveBudgetOccurrenceCount(event) ?? 1;

    return months.map((month) => ({
      month,
      amount: resolveCashflowAmountForMonth({ event, month, assumptions }) / amountDivisor,
      sourceEventId,
      label: event.label,
      memberId: event.memberId,
      tags: event.tags ? [...event.tags] : undefined,
      kind: event.kind,
    }));
  });

  const nonCashflowRows = normalizedEvents.flatMap<LedgerRow>((event) => {
    if (event.type !== "cashflow") {
      if (event.type !== "adjustment") {
        if (event.type === "housing") {
          return buildHousingLedgerRows(event, assumptions);
        }
        if (event.type === "loan") {
          return buildLoanLedgerRows(event, assumptions);
        }
        if (event.type === "insurance") {
          return buildInsuranceLedgerRows(event, assumptions);
        }
        return [];
      }
      if (!isValidMonthKey(event.month)) {
        return [];
      }
      const rawAmount = Number(event.amount);
      if (!Number.isFinite(rawAmount) || rawAmount === 0) {
        return [];
      }
      return [
        {
          month: event.month,
          amount: rawAmount,
          sourceEventId: event.id,
          label: event.label,
          memberId: event.memberId,
          tags: event.tags ? [...event.tags] : undefined,
          kind: rawAmount < 0 ? "expense" : "income",
        },
      ];
    }
    return [];
  });

  return [...cashflowRows, ...nonCashflowRows];
};

const buildLegacyScenarioShell = (
  scenario: ScenarioV2
): Scenario => ({
  id: scenario.id,
  name: scenario.name,
  baseCurrency: scenario.baseCurrency,
  updatedAt: scenario.updatedAt,
  version: 2,
  kpis: {
    lowestMonthlyBalance: 0,
    runwayMonths: 0,
    netWorthYear5: 0,
    riskLevel: "Medium",
  },
  assumptions: scenario.assumptions,
  eventRefs: [],
  milestoneEvents: [],
  snapshots: [],
  plans: [],
  meta: scenario.meta,
});

const buildEventTypeForKind = (kind: CashflowEvent["kind"]): EventType =>
  kind === "income" ? "salary" : "custom";

const buildLegacyEventLibrary = (
  scenario: ScenarioV2
): EventDefinition[] => {
  const assumptions = scenario.assumptions;
  const events = normalizeScenarioEventSegments(scenario.events ?? []);
  const horizonEndMonth = resolveHorizonEndMonth(assumptions);
  const normalizedCashflowEvents = normalizeCashflowEventSeries(
    events.filter((event): event is CashflowEvent => event.type === "cashflow")
  );

  const cashflowDefinitions = normalizedCashflowEvents.flatMap<EventDefinition>(({ event, sourceEventId }) => {
      const budgetMonths = resolveBudgetOccurrenceMonths(event, assumptions);
      const months = budgetMonths ?? buildCashflowMonths(event, assumptions);
      if (months.length === 0) {
        return [];
      }

      const type = buildEventTypeForKind(event.kind) as EventType;
      const amountDivisor = resolveBudgetOccurrenceCount(event) ?? 1;
      const schedule = months.map((month) => ({
        month,
        amount: Math.abs(resolveCashflowAmountForMonth({ event, month, assumptions }) / amountDivisor),
      }));
      const definition: EventDefinition = {
        id: sourceEventId,
        title: event.label ?? "Cashflow",
        type,
        kind: "cashflow",
        rule: {
          mode: "schedule",
          startMonth: event.startMonth ?? event.occurrenceMonth ?? horizonEndMonth ?? "",
          endMonth: event.endMonth ?? null,
          schedule,
        },
        currency: scenario.baseCurrency,
        memberId: event.memberId,
        ...(event.kind === "income" ? { incomeSubtype: "other" } : {}),
      };

      return [definition];
    });

  const nonCashflowDefinitions = events.flatMap<EventDefinition>((event) => {
    if (event.type === "cashflow") {
      return [];
    }

    if (event.type === "housing") {
      if (event.kind === "rent") {
        const rentMonthly = event.rentMonthly ?? 0;
        if (!rentMonthly) {
          return [];
        }
        const months = buildRangeMonths({
          startMonth: event.startMonth,
          endMonth: event.endMonth ?? null,
          assumptions,
        });
        const annualGrowthPct = resolveRentAnnualGrowthPct(
          event.rentGrowthMode,
          event.rentAnnualGrowthPct,
          assumptions
        );
        const schedule = buildGrowthSchedule(
          rentMonthly,
          months,
          event.startMonth,
          annualGrowthPct
        );
        const definition: EventDefinition = {
          id: event.id,
          title: event.label ?? "Rent",
          type: "rent",
          kind: "cashflow",
          rule: {
            mode: "schedule",
            startMonth: event.startMonth,
            endMonth: event.endMonth ?? null,
            schedule,
          },
          currency: scenario.baseCurrency,
          memberId: event.memberId,
        };
        return [definition];
      }

      const feeDefinitions = (event.feesOneOff ?? []).flatMap<EventDefinition>(
        (fee, index) => {
        if (!isValidMonthKey(fee.month) || !fee.amount) {
          return [];
        }
        const definition: EventDefinition = {
          id: `${event.id}-fee-${index}`,
          title: fee.label ?? event.label ?? "Housing fee",
          type: "custom",
          kind: "cashflow",
          rule: {
            mode: "schedule",
            startMonth: fee.month,
            endMonth: fee.month,
            schedule: [{ month: fee.month, amount: Math.abs(fee.amount) }],
          },
          currency: scenario.baseCurrency,
          memberId: event.memberId,
        };
        return [definition];
      }
      );

      const ongoingDefinitions = (event.ongoingCosts ?? []).flatMap<EventDefinition>(
        (cost, index) => {
        if (!isValidMonthKey(cost.startMonth) || !cost.amount) {
          return [];
        }
        const months = buildRangeMonths({
          startMonth: cost.startMonth,
          endMonth: cost.endMonth ?? event.endMonth ?? null,
          assumptions,
        });
        const schedule = months.map((month) => ({
          month,
          amount: Math.abs(cost.amount ?? 0),
        }));
        const definition: EventDefinition = {
          id: `${event.id}-ongoing-${index}`,
          title: cost.label ?? event.label ?? "Housing cost",
          type: "custom",
          kind: "cashflow",
          rule: {
            mode: "schedule",
            startMonth: cost.startMonth,
            endMonth: cost.endMonth ?? null,
            schedule,
          },
          currency: scenario.baseCurrency,
          memberId: event.memberId,
        };
        return [definition];
      }
      );

      const rentalDefinitions =
        event.rental?.enabled && event.rental.rentMonthly
          ? (() => {
              const rentalStartMonth = event.rental.startMonth ?? event.startMonth;
              const months = buildRangeMonths({
                startMonth: rentalStartMonth,
                endMonth: event.rental.endMonth ?? event.endMonth ?? null,
                assumptions,
              });
              const annualGrowthPct = resolveRentAnnualGrowthPct(
                event.rental.rentGrowthMode,
                event.rental.rentAnnualGrowthPct,
                assumptions
              );
              const schedule = buildGrowthSchedule(
                Math.max(
                  0,
                  (event.rental.rentMonthly ?? 0) *
                    (1 - (event.rental.vacancyRatePct ?? 0) / 100)
                ),
                months,
                rentalStartMonth,
                annualGrowthPct
              );
              if (schedule.length === 0) {
                return [] as EventDefinition[];
              }
              return [
                {
                  id: `${event.id}-rental`,
                  title: event.label ?? "Rental income",
                  type: "rent" as const,
                  kind: "cashflow" as const,
                  rule: {
                    mode: "schedule" as const,
                    startMonth: rentalStartMonth,
                    endMonth: event.rental.endMonth ?? event.endMonth ?? null,
                    schedule,
                  },
                  currency: scenario.baseCurrency,
                  memberId: event.memberId,
                },
              ];
            })()
          : [];

      return [...feeDefinitions, ...ongoingDefinitions, ...rentalDefinitions];
    }

    if (event.type === "loan") {
      return [];
    }

    if (event.type === "insurance") {
      if (event.mode === "quick") {
        if (!event.startMonth || !event.premiumMonthly) {
          return [];
        }
        const months = buildRangeMonths({
          startMonth: event.startMonth,
          endMonth: event.endMonth ?? null,
          assumptions,
        });
        const schedule = months.map((month) => ({
          month,
          amount: Math.abs(event.premiumMonthly ?? 0),
        }));
        const definition: EventDefinition = {
          id: event.id,
          title: event.label ?? "Insurance premium",
          type: "custom",
          kind: "cashflow",
          rule: {
            mode: "schedule",
            startMonth: event.startMonth,
            endMonth: event.endMonth ?? null,
            schedule,
          },
          currency: scenario.baseCurrency,
          memberId: event.memberId,
        };
        return [definition];
      }

      return (event.policies ?? []).flatMap<EventDefinition>((policy, index) => {
        if (!isValidMonthKey(policy.startMonth) || !policy.premiumMonthly) {
          return [];
        }
        const months = buildRangeMonths({
          startMonth: policy.startMonth,
          endMonth: policy.endMonth ?? null,
          assumptions,
        });
        const schedule = months.map((month) => ({
          month,
          amount: Math.abs(policy.premiumMonthly ?? 0),
        }));
        const definition: EventDefinition = {
          id: `${event.id}-policy-${index}`,
          title: policy.name ?? event.label ?? "Insurance premium",
          type: "custom",
          kind: "cashflow",
          rule: {
            mode: "schedule",
            startMonth: policy.startMonth,
            endMonth: policy.endMonth ?? null,
            schedule,
          },
          currency: scenario.baseCurrency,
          memberId: event.memberId,
        };
        return [definition];
      });
    }

    return [];
  });

  return [...cashflowDefinitions, ...nonCashflowDefinitions];
};

export const compileScenarioV2ToProjectionInput = (
  scenario: ScenarioV2
): ProjectionInput => {
  const shellScenario = buildLegacyScenarioShell(scenario);
  const eventLibrary = buildLegacyEventLibrary(scenario);
  const events = scenario.events ?? [];

  const housingPositions = events.flatMap<HomePositionDraft>((event) => {
    if (event.type !== "housing" || event.kind !== "mortgage") {
      return [];
    }
    const propertyMarketValue = resolvePropertyMarketValue(event);
    const mortgageBaseValue = resolveMortgageBaseValue(event);
    const downPayment = resolveDownPaymentAmount(event, propertyMarketValue);
    return [
      {
        id: event.propertyAssetId ?? event.id,
        usage: "primary" as const,
        mode: "new_purchase" as const,
        purchasePrice: propertyMarketValue,
        downPayment,
        purchaseMonth: event.startMonth,
        annualAppreciationPct: resolvePropertyAnnualGrowthPct(
          event.propertyGrowthMode,
          event.propertyAnnualGrowthPct,
          scenario.assumptions
        ),
        appreciationMode: event.propertyGrowthMode === "assumption" ? "GLOBAL" : "CUSTOM",
        mortgageRatePct: event.mortgageRatePct ?? 0,
        mortgageTermYears: event.mortgageTermYears ?? 0,
        mortgageBaseValue,
        feesOneTime: 0,
        holdingCostMonthly: 0,
        holdingCostAnnualGrowthPct: 0,
        rental: event.rental?.enabled
          ? {
              isRented: true,
              rentMonthly: event.rental.rentMonthly ?? 0,
              rentStartMonth: event.rental.startMonth ?? event.startMonth,
              rentEndMonth: event.rental.endMonth ?? null,
              rentAnnualGrowthPct: 0,
              vacancyRatePct: event.rental.vacancyRatePct ?? 0,
            }
          : undefined,
      },
    ];
  });

  const loanPositions = events.flatMap<LoanPositionDraft>((event) => {
    if (event.type !== "loan") {
      return [];
    }
    return [
      {
        id: event.liabilityId,
        name: event.label,
        loanType:
          event.loanKind === "car"
            ? "carLoan"
            : event.loanKind === "personal" || event.loanKind === "credit"
            ? "loan"
            : "other",
        startMonth: event.startMonth,
        principal: event.principal,
        annualInterestRatePct: event.annualInterestRatePct,
        termYears: event.termYears,
        monthlyPayment: event.monthlyPayment,
        paymentMethod: event.paymentMethod,
      },
    ];
  });

  const insurancePositions = events.flatMap<InsurancePositionDraft>((event) => {
    if (event.type !== "insurance") {
      return [];
    }
    if (event.mode === "quick") {
      if (!event.startMonth || !event.premiumMonthly) {
        return [];
      }
      return [
        {
          id: event.id,
          name: event.label ?? "Insurance",
          enabled: true,
          kind: "protection" as const,
          startMonth: event.startMonth,
          endMonth: event.endMonth ?? undefined,
          premiumMonthly: event.premiumMonthly ?? 0,
          premiumAnnualGrowthPct: event.premiumAnnualGrowthPct ?? 0,
        },
      ];
    }
    return (event.policies ?? []).map((policy) => ({
      id: policy.policyId ?? policy.id,
      name: policy.name ?? "Insurance",
      enabled: true,
      kind: policy.kind,
      startMonth: policy.startMonth,
      endMonth: policy.endMonth ?? undefined,
      premiumMonthly: policy.premiumMonthly ?? 0,
      premiumAnnualGrowthPct: policy.premiumAnnualGrowthPct ?? 0,
      initialCashValue: policy.cashValue,
      expectedAnnualReturnPct: policy.expectedAnnualReturnPct,
    }));
  });

  const carPositionsFromAssets = (scenario.assets ?? []).flatMap<CarPositionDraft>((asset) => {
    if (asset.kind !== "car" || asset.depreciationSource !== "carDepreciation") {
      return [];
    }
    const purchaseMonth =
      asset.startMonth && isValidMonthKey(asset.startMonth)
        ? asset.startMonth
        : scenario.assumptions.baseMonth;
    if (!purchaseMonth || !isValidMonthKey(purchaseMonth)) {
      return [];
    }
    const purchasePrice = Math.max(0, asset.currentValue ?? 0);
    if (purchasePrice <= 0) {
      return [];
    }

    return [
      {
        id: asset.id,
        name: asset.label,
        purchaseMonth,
        purchasePrice,
        downPayment: purchasePrice,
        annualDepreciationRatePct: Math.max(0, scenario.assumptions.carDepreciationRatePct ?? 0),
        depreciationMode: "GLOBAL",
        holdingCostMonthly: 0,
        holdingCostAnnualGrowthPct: 0,
        source: "eventGenerated",
      },
    ];
  });

  const assets = events.flatMap<ScenarioAsset>((event) => {
    if (event.type === "housing" && event.kind === "mortgage") {
      return [
        {
          id: event.propertyAssetId ?? event.id,
          kind: "home" as const,
          label: event.label,
        },
      ];
    }
    if (event.type === "insurance" && event.mode === "detailed") {
      return (event.policies ?? []).flatMap((policy) =>
        policy.kind === "savings"
          ? [
              {
                id: policy.policyAssetId ?? policy.id,
                kind: "other" as const,
                label: policy.name ?? event.label,
              },
            ]
          : []
      );
    }
    return [];
  });

  const liabilities = events.flatMap<ScenarioLiability>((event) => {
    if (event.type === "housing" && event.kind === "mortgage") {
      return [
        {
          id: event.mortgageLiabilityId ?? event.id,
          kind: "mortgage" as const,
          label: event.label,
        },
      ];
    }
    if (event.type === "loan") {
      return [
        {
          id: event.liabilityId ?? event.id,
          kind:
            event.loanKind === "car"
              ? "carLoan"
              : event.loanKind === "credit"
              ? "credit"
              : event.loanKind === "personal"
              ? "loan"
              : "other",
          label: event.label,
        },
      ];
    }
    return [];
  });

  const scenarioWithEvents = {
    ...shellScenario,
    eventRefs: eventLibrary.map((definition) => ({
      refId: definition.id,
      enabled: true,
    })),
    assets,
    liabilities,
    positions: {
      homes: housingPositions,
      loans: loanPositions,
      insurances: insurancePositions,
      cars: carPositionsFromAssets,
    },
  };
  const { input } = mapScenarioToEngineInput(scenarioWithEvents, eventLibrary);
  return input;
};
