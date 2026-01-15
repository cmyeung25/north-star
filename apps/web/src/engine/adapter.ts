// Shape note: Engine HomePosition originally accepted feesOneTime only for extra home costs.
// Added fields mapped here: holdingCostMonthly (number) and holdingCostAnnualGrowth (decimal).
// Back-compat: missing holding cost fields map to 0 in the engine input.
import {
  applyEventAssumptionFallbacks,
  type EventAssumptions,
  type ProjectionInput,
  type ProjectionResult,
} from "@north-star/engine";
import type { HomePosition, Scenario, TimelineEvent } from "../store/scenarioStore";
import { HomePositionSchema } from "../store/scenarioValidation";
import type { OverviewKpis, TimeSeriesPoint } from "../../features/overview/types";
import { getEventSign } from "../events/eventCatalog";

type AdapterOptions = {
  baseMonth?: string;
  horizonMonths?: number;
  initialCash?: number;
  strict?: boolean;
};

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
  options: AdapterOptions = {}
): ProjectionInput => {
  const strict = options.strict ?? true;
  const enabledEvents = (scenario.events ?? []).filter((event) => event.enabled);
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
  const validatedHomes = resolvedHomePositions.reduce<HomePosition[]>(
    (result, homePosition) => {
      const parsed = HomePositionSchema.safeParse(homePosition);
      if (!parsed.success) {
        if (strict) {
          throw new Error("scenario.positions.homes is invalid.");
        }
        return result;
      }
      result.push(parsed.data);
      return result;
    },
    []
  );
  const homePurchaseMonth = validatedHomes.reduce<string | null>(
    (earliest, home) => {
      if (!earliest || home.purchaseMonth < earliest) {
        return home.purchaseMonth;
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
  const initialCash = options.initialCash ?? scenario.assumptions.initialCash ?? 0;
  const assumptions: EventAssumptions = {
    inflationRate: scenario.assumptions.inflationRate,
    rentAnnualGrowthPct: scenario.assumptions.rentAnnualGrowthPct,
    salaryGrowthRate: scenario.assumptions.salaryGrowthRate,
  };
  const events = enabledEvents
    // Strategy A: remove buy_home cashflow events to avoid double counting with positions.homes.
    // Only the earliest buy_home event is mapped into positions; any additional buy_home events are ignored.
    .filter((event) => event.type !== "buy_home")
    .map((event) => mapEventToEngine(event, assumptions));
  const positions =
    validatedHomes.length > 0
      ? {
          homes: validatedHomes.map((home) => ({
            purchasePrice: home.purchasePrice,
            downPayment: home.downPayment,
            purchaseMonth: home.purchaseMonth,
            annualAppreciation: home.annualAppreciationPct / 100,
            feesOneTime: home.feesOneTime,
            holdingCostMonthly: home.holdingCostMonthly ?? 0,
            holdingCostAnnualGrowth:
              (home.holdingCostAnnualGrowthPct ?? 0) / 100,
            mortgage: {
              principal: home.purchasePrice - home.downPayment,
              annualRate: home.mortgageRatePct / 100,
              termMonths: home.mortgageTermYears * 12,
            },
          })),
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
