import type { ProjectionInput, ProjectionResult } from "@north-star/engine";
import type { Scenario, TimelineEvent } from "../store/scenarioStore";
import type { OverviewKpis, TimeSeriesPoint } from "../../features/overview/types";

type AdapterOptions = {
  baseMonth?: string;
  horizonMonths?: number;
  initialCash?: number;
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
  const assumptions = scenario.assumptions;
  const enabledEvents = (scenario.events ?? []).filter((event) => event.enabled);
  const earliestStartMonth = getEarliestStartMonth(enabledEvents);
  const baseMonth =
    options.baseMonth ??
    assumptions.baseMonth ??
    earliestStartMonth ??
    formatMonth(new Date());
  const horizonMonths = options.horizonMonths ?? assumptions.horizonMonths ?? 240;
  const initialCash = options.initialCash ?? assumptions.initialCash ?? 0;
  const events = enabledEvents.map(mapEventToEngine);

  return {
    baseMonth,
    horizonMonths,
    initialCash,
    events,
    positions: scenario.positions,
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
  netWorthSeries: projection.months.map((month, index) => ({
    month,
    value: projection.netWorth[index] ?? 0,
  })),
});
