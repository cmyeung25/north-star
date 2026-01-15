import type { ProjectionInput, ProjectionResult } from "@north-star/engine";
import type { Scenario, TimelineEvent } from "../store/scenarioStore";
import { HomePositionSchema } from "../store/scenarioValidation";
import type { OverviewKpis, TimeSeriesPoint } from "../../features/overview/types";

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
  event: TimelineEvent
): ProjectionInput["events"][number] => ({
  enabled: event.enabled,
  startMonth: event.startMonth,
  endMonth: event.endMonth ?? null,
  monthlyAmount: event.monthlyAmount ?? 0,
  oneTimeAmount: event.oneTimeAmount ?? 0,
  // Store annualGrowthPct is a whole percent (e.g. 3 for 3%), engine expects decimal.
  annualGrowthPct: (event.annualGrowthPct ?? 0) / 100,
});

export const mapScenarioToEngineInput = (
  scenario: Scenario,
  options: AdapterOptions = {}
): ProjectionInput => {
  const strict = options.strict ?? true;
  const enabledEvents = (scenario.events ?? []).filter((event) => event.enabled);
  const earliestStartMonth = getEarliestStartMonth(enabledEvents);
  const buyHomeEvent = getEarliestBuyHomeEvent(enabledEvents);
  const homePosition = scenario.positions?.home ?? null;
  if (buyHomeEvent) {
    assertBuyHomeEventMonth(buyHomeEvent, { strict });
  }
  if (!homePosition && buyHomeEvent && strict) {
    throw new Error("buy_home event requires home details in scenario.positions.home.");
  }
  const validatedHome = homePosition
    ? HomePositionSchema.safeParse(homePosition)
    : null;
  const resolvedHome =
    validatedHome && !validatedHome.success
      ? strict
        ? (() => {
            throw new Error("scenario.positions.home is invalid.");
          })()
        : null
      : validatedHome?.success
        ? validatedHome.data
        : homePosition;
  const homePurchaseMonth = resolvedHome?.purchaseMonth ?? null;
  const baseMonth =
    options.baseMonth ??
    scenario.assumptions.baseMonth ??
    earliestStartMonth ??
    homePurchaseMonth ??
    formatMonth(new Date());
  const horizonMonths =
    options.horizonMonths ?? scenario.assumptions.horizonMonths ?? 240;
  const initialCash = options.initialCash ?? scenario.assumptions.initialCash ?? 0;
  const events = enabledEvents
    // Strategy A: remove buy_home cashflow events to avoid double counting with positions.home.
    // Only the earliest buy_home event is mapped into positions; any additional buy_home events are ignored.
    .filter((event) => event.type !== "buy_home")
    .map(mapEventToEngine);
  const positions = resolvedHome
    ? {
        home: {
          purchasePrice: resolvedHome.purchasePrice,
          downPayment: resolvedHome.downPayment,
          purchaseMonth: resolvedHome.purchaseMonth,
          annualAppreciation: resolvedHome.annualAppreciationPct / 100,
          feesOneTime: resolvedHome.feesOneTime,
          mortgage: {
            principal: resolvedHome.purchasePrice - resolvedHome.downPayment,
            annualRate: resolvedHome.mortgageRatePct / 100,
            termMonths: resolvedHome.mortgageTermYears * 12,
          },
        },
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
