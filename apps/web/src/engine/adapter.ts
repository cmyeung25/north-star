// Shape note: Engine HomePosition originally accepted feesOneTime only for extra home costs.
// Added fields mapped here: holdingCostMonthly (number) and holdingCostAnnualGrowth (decimal).
// Back-compat: missing holding cost fields map to 0 in the engine input.
import {
  applyEventAssumptionFallbacks,
  type EventAssumptions,
  type ProjectionInput,
  type ProjectionResult,
} from "@north-star/engine";
import type {
  HomePosition,
  InsurancePosition,
  InvestmentPosition,
  Scenario,
} from "../store/scenarioStore";
import { HomePositionSchema } from "../store/scenarioValidation";
import type { OverviewKpis, TimeSeriesPoint } from "../../features/overview/types";
import { getEventSign } from "../events/eventCatalog";
import type { EventDefinition } from "../domain/events/types";
import { buildScenarioTimelineEvents } from "../domain/events/utils";
import type { TimelineEvent } from "../features/timeline/schema";

type AdapterOptions = {
  baseMonth?: string;
  horizonMonths?: number;
  initialCash?: number;
  strict?: boolean;
  eventsOverride?: TimelineEvent[];
};

type HomePositionWithId = HomePosition & { id?: string };

const formatMonth = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
};

const getEarliestStartMonth = (events: TimelineEvent[]) =>
  events.reduce<string | null>((earliest, event) => {
    if (!event.enabled) {
      return earliest;
    }
    if (!earliest || event.startMonth < earliest) {
      return event.startMonth;
    }
    return earliest;
  }, null);

const monthPattern = /^\d{4}-\d{2}$/;

const isValidMonth = (value: string) => {
  if (!monthPattern.test(value)) {
    return false;
  }
  const [, month] = value.split("-");
  const monthNumber = Number(month);
  return Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12;
};

const getEarliestBuyHomeEvent = (events: TimelineEvent[]) =>
  events.reduce<TimelineEvent | null>((earliest, event) => {
    if (!event.enabled || event.type !== "buy_home") {
      return earliest;
    }
    if (!earliest || event.startMonth < earliest.startMonth) {
      return event;
    }
    return earliest;
  }, null);

const assertBuyHomeEventMonth = (
  event: TimelineEvent,
  options: { strict: boolean }
) => {
  if (!isValidMonth(event.startMonth)) {
    if (options.strict) {
      throw new Error("buy_home event requires a valid startMonth (YYYY-MM).");
    }
  }
};

const mapEventToEngine = (
  event: TimelineEvent,
  assumptions: EventAssumptions
): ProjectionInput["events"][number] => {
  // Fallback rules (MVP): use assumptions when an event doesn't provide growth.
  const withFallbacks = applyEventAssumptionFallbacks(
    {
      type: event.type,
      annualGrowthPct: event.annualGrowthPct,
    },
    assumptions
  );
  const sign = getEventSign(event.type);
  const applySign = (value: number | null | undefined) => {
    const absValue = Math.abs(value ?? 0);
    return absValue === 0 ? 0 : sign * absValue;
  };

  return {
    id: event.id,
    enabled: event.enabled,
    startMonth: event.startMonth,
    endMonth: event.endMonth ?? null,
    monthlyAmount: applySign(event.monthlyAmount),
    oneTimeAmount: applySign(event.oneTimeAmount),
    // Store annualGrowthPct is a whole percent (e.g. 3 for 3%), engine expects decimal.
    annualGrowthPct: (withFallbacks.annualGrowthPct ?? 0) / 100,
  };
};

export const mapScenarioToEngineInput = (
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  options: AdapterOptions = {}
): ProjectionInput => {
  const strict = options.strict ?? true;
  const resolvedEvents =
    options.eventsOverride ?? buildScenarioTimelineEvents(scenario, eventLibrary);
  const enabledEvents = resolvedEvents.filter((event) => event.enabled);
  const earliestStartMonth = getEarliestStartMonth(enabledEvents);
  const buyHomeEvent = getEarliestBuyHomeEvent(enabledEvents);
  const homePositions = scenario.positions?.homes;
  const legacyHome = scenario.positions?.home ?? null;
  const resolvedHomePositions =
    homePositions ?? (legacyHome ? [legacyHome] : []);
  if (buyHomeEvent) {
    assertBuyHomeEventMonth(buyHomeEvent, { strict });
  }
  if (!resolvedHomePositions.length && buyHomeEvent && strict) {
    throw new Error("buy_home event requires home details in scenario.positions.homes.");
  }
  const validatedHomes = resolvedHomePositions.reduce<HomePositionWithId[]>(
    (result, homePosition) => {
      const parsed = HomePositionSchema.safeParse(homePosition);
      if (!parsed.success) {
        if (strict) {
          throw new Error("scenario.positions.homes is invalid.");
        }
        return result;
      }
      const homeId = (homePosition as { id?: string }).id;
      result.push({
        ...parsed.data,
        id: homeId,
      });
      return result;
    },
    []
  );
  const homePurchaseMonth = validatedHomes.reduce<string | null>(
    (earliest, home) => {
      const candidate =
        (home.mode ?? "new_purchase") === "existing"
          ? home.existing?.asOfMonth
          : home.purchaseMonth;
      if (!candidate) {
        return earliest;
      }
      if (!earliest || candidate < earliest) {
        return candidate;
      }
      return earliest;
    },
    null
  );
  const baseMonth =
    options.baseMonth ??
    scenario.assumptions.baseMonth ??
    earliestStartMonth ??
    homePurchaseMonth ??
    formatMonth(new Date());
  const horizonMonths =
    options.horizonMonths ?? scenario.assumptions.horizonMonths ?? 240;
  const initialCash =
    options.initialCash ?? scenario.assumptions.initialCash ?? 0;
  const assumptions: EventAssumptions = {
    inflationRate: scenario.assumptions.inflationRate,
    rentAnnualGrowthPct: scenario.assumptions.rentAnnualGrowthPct,
    salaryGrowthRate: scenario.assumptions.salaryGrowthRate,
  };
  const investmentReturnAssumptions =
    scenario.assumptions.investmentReturnAssumptions ?? {};
  const events = enabledEvents
    // Strategy A: remove buy_home cashflow events to avoid double counting with positions.homes.
    // Only the earliest buy_home event is mapped into positions; any additional buy_home events are ignored.
    .filter(
      (event) => event.type !== "buy_home" && event.type !== "insurance_product"
    )
    .map((event) => mapEventToEngine(event, assumptions));
  const mappedHomes =
    validatedHomes.length > 0
      ? validatedHomes.map((home) => {
          const mode = home.mode ?? "new_purchase";
          const usage = home.usage ?? "primary";
          const rental = home.rental
            ? {
                rentMonthly: home.rental.rentMonthly,
                rentStartMonth: home.rental.rentStartMonth,
                rentEndMonth: home.rental.rentEndMonth ?? undefined,
                rentAnnualGrowth: (home.rental.rentAnnualGrowthPct ?? 0) / 100,
                vacancyRate: (home.rental.vacancyRatePct ?? 0) / 100,
              }
            : undefined;

          if (mode === "existing" && home.existing) {
            return {
              id: home.id,
              usage,
              mode,
              purchasePrice: home.purchasePrice ?? home.existing.marketValue,
              annualAppreciation: home.annualAppreciationPct / 100,
              feesOneTime: home.feesOneTime,
              holdingCostMonthly: home.holdingCostMonthly ?? 0,
              holdingCostAnnualGrowth: (home.holdingCostAnnualGrowthPct ?? 0) / 100,
              existing: {
                asOfMonth: home.existing.asOfMonth,
                marketValue: home.existing.marketValue,
                mortgageBalance: home.existing.mortgageBalance,
                remainingTermMonths: home.existing.remainingTermMonths,
                annualRate: (home.existing.annualRatePct ?? 0) / 100,
              },
              rental,
            };
          }

          return {
            id: home.id,
            usage,
            mode,
            purchasePrice: home.purchasePrice ?? 0,
            downPayment: home.downPayment ?? 0,
            purchaseMonth: home.purchaseMonth ?? baseMonth,
            annualAppreciation: home.annualAppreciationPct / 100,
            feesOneTime: home.feesOneTime,
            holdingCostMonthly: home.holdingCostMonthly ?? 0,
            holdingCostAnnualGrowth: (home.holdingCostAnnualGrowthPct ?? 0) / 100,
            mortgage: {
              principal: (home.purchasePrice ?? 0) - (home.downPayment ?? 0),
              annualRate: (home.mortgageRatePct ?? 0) / 100,
              termMonths: (home.mortgageTermYears ?? 0) * 12,
            },
            rental,
          };
        })
      : undefined;

  const mappedInvestments = scenario.positions?.investments
    ? scenario.positions.investments.map((investment: InvestmentPosition) => {
        const assumedReturn =
          investment.expectedAnnualReturnPct ??
          investmentReturnAssumptions[investment.assetClass] ??
          0;

        return {
          assetClass: investment.assetClass,
          marketValue: investment.marketValue ?? 0,
          expectedAnnualReturn: assumedReturn / 100,
          monthlyContribution: investment.monthlyContribution ?? 0,
        };
      })
    : undefined;

  const mappedInsurances = scenario.positions?.insurances
    ? scenario.positions.insurances.map((insurance: InsurancePosition) => {
        const premiumMonthly =
          insurance.premiumMode === "annual"
            ? insurance.premiumAmount / 12
            : insurance.premiumAmount;

        return {
          insuranceType: insurance.insuranceType,
          premiumMonthly,
          hasCashValue: insurance.hasCashValue,
          cashValue: insurance.cashValueAsOf ?? 0,
          cashValueAnnualGrowth: (insurance.cashValueAnnualGrowthPct ?? 0) / 100,
          coverageMeta: insurance.coverageMeta,
        };
      })
    : undefined;

  const positions =
    mappedHomes || mappedInvestments || mappedInsurances
      ? {
          homes: mappedHomes,
          investments: mappedInvestments,
          insurances: mappedInsurances,
        }
      : undefined;

  return {
    baseMonth,
    horizonMonths,
    initialCash,
    events,
    positions,
  };
};

export const projectionToOverviewViewModel = (projection: ProjectionResult): {
  kpis: OverviewKpis;
  cashSeries: TimeSeriesPoint[];
  netWorthSeries: TimeSeriesPoint[];
} => ({
  kpis: {
    lowestMonthlyBalance: projection.lowestMonthlyBalance.value,
    runwayMonths: projection.runwayMonths,
    netWorthYear5: projection.netWorthYear5,
    riskLevel: projection.riskLevel,
  },
  cashSeries: projection.months.map((month, index) => ({
    month,
    value: projection.cashBalance[index] ?? 0,
  })),
  netWorthSeries: mapNetWorthSeries(projection),
});

export const mapNetWorthSeries = (
  projection: ProjectionResult
): TimeSeriesPoint[] => {
  if (!projection.months.length || !projection.netWorth.length) {
    return [];
  }

  const seriesLength = Math.min(projection.months.length, projection.netWorth.length);

  return projection.months.slice(0, seriesLength).map((month, index) => ({
    month,
    value: projection.netWorth[index] ?? 0,
  }));
};
