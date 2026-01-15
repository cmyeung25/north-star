// Shape note: Projection outputs may arrive as months+netWorth arrays or as {month,value} series.
// Added normalization to support rent-vs-own comparisons across shapes, plus home holding cost summaries.
// Back-compat: missing cash series is handled by omitting cash deltas.
import { computeProjection, type ProjectionResult } from "@north-star/engine";
import { useMemo } from "react";
import type { Scenario, TimelineEvent } from "../store/scenarioStore";
import { mapScenarioToEngineInput } from "./adapter";
import { toRentComparisonScenario } from "./scenarioTransforms";

export type NormalizedProjectionPoint = {
  month: string;
  netWorth: number;
  cash?: number;
};

type ProjectionSeriesShape = {
  netWorthSeries?: Array<{ month: string; value: number }>;
  cashSeries?: Array<{ month: string; value: number }>;
};

type RentVsOwnAssumptions = {
  rentAnnualGrowthPct: number | null;
  ownFeesOneTime: number;
  ownHoldingCostMonthly: number;
  holdingCostAnnualGrowthPct: number;
};

export type RentVsOwnComparison = {
  status: "ready" | "rent-missing" | "insufficient-data";
  netWorthDeltaAtHorizon?: number;
  cashDeltaAtHorizon?: number;
  breakevenMonth?: string | null;
  breakevenLabel?: string | null;
  assumptions: RentVsOwnAssumptions;
};

const monthPattern = /^\d{4}-\d{2}$/;

const getRentEvent = (scenario: Scenario): TimelineEvent | null => {
  const rentEvents = (scenario.events ?? []).filter(
    (event) => event.type === "rent" && event.enabled
  );
  if (!rentEvents.length) {
    return null;
  }

  return rentEvents.sort((a, b) => a.startMonth.localeCompare(b.startMonth))[0] ?? null;
};

const getHomePositions = (scenario: Scenario) =>
  scenario.positions?.homes ?? (scenario.positions?.home ? [scenario.positions.home] : []);

const getAssumptionsSummary = (scenario: Scenario, rentEvent: TimelineEvent | null): RentVsOwnAssumptions => {
  const homes = getHomePositions(scenario);
  const ownFeesOneTime = homes.reduce((total, home) => total + (home.feesOneTime ?? 0), 0);
  const ownHoldingCostMonthly = homes.reduce(
    (total, home) => total + (home.holdingCostMonthly ?? 0),
    0
  );
  const holdingCostAnnualGrowthPct = ownHoldingCostMonthly
    ? homes.reduce(
        (total, home) =>
          total + (home.holdingCostMonthly ?? 0) * (home.holdingCostAnnualGrowthPct ?? 0),
        0
      ) / ownHoldingCostMonthly
    : 0;

  return {
    rentAnnualGrowthPct: rentEvent?.annualGrowthPct ?? null,
    ownFeesOneTime,
    ownHoldingCostMonthly,
    holdingCostAnnualGrowthPct,
  };
};

export const normalizeProjection = (
  projection: ProjectionResult | ProjectionSeriesShape
): NormalizedProjectionPoint[] => {
  if ("netWorthSeries" in projection && projection.netWorthSeries) {
    return projection.netWorthSeries.map((point, index) => ({
      month: point.month,
      netWorth: point.value,
      cash: projection.cashSeries?.[index]?.value,
    }));
  }

  if ("months" in projection && "netWorth" in projection) {
    return projection.months.map((month, index) => ({
      month,
      netWorth: projection.netWorth[index] ?? 0,
      cash: projection.cashBalance?.[index],
    }));
  }

  return [];
};

export const computeComparisonMetrics = (
  ownSeries: NormalizedProjectionPoint[],
  rentSeries: NormalizedProjectionPoint[]
): {
  netWorthDeltaAtHorizon: number;
  cashDeltaAtHorizon?: number;
  breakevenMonth?: string | null;
  breakevenLabel?: string | null;
} | null => {
  const length = Math.min(ownSeries.length, rentSeries.length);
  if (length === 0) {
    return null;
  }

  const lastIndex = length - 1;
  const netWorthDeltaAtHorizon =
    (ownSeries[lastIndex]?.netWorth ?? 0) - (rentSeries[lastIndex]?.netWorth ?? 0);
  const ownCash = ownSeries[lastIndex]?.cash;
  const rentCash = rentSeries[lastIndex]?.cash;
  const cashDeltaAtHorizon =
    ownCash != null && rentCash != null ? ownCash - rentCash : undefined;

  let breakevenIndex = -1;
  for (let index = 0; index < length; index += 1) {
    if ((ownSeries[index]?.netWorth ?? 0) >= (rentSeries[index]?.netWorth ?? 0)) {
      breakevenIndex = index;
      break;
    }
  }

  if (breakevenIndex === -1) {
    return { netWorthDeltaAtHorizon, cashDeltaAtHorizon };
  }

  const breakevenMonth = ownSeries[breakevenIndex]?.month ?? null;
  const breakevenLabel = monthPattern.test(breakevenMonth ?? "")
    ? breakevenMonth
    : `Year ${Math.floor(breakevenIndex / 12) + 1}`;

  return {
    netWorthDeltaAtHorizon,
    cashDeltaAtHorizon,
    breakevenMonth,
    breakevenLabel,
  };
};

export const useRentVsOwnComparison = (
  scenario: Scenario | null
): RentVsOwnComparison | null =>
  useMemo(() => {
    if (!scenario) {
      return null;
    }

    const rentEvent = getRentEvent(scenario);
    const assumptions = getAssumptionsSummary(scenario, rentEvent);

    if (!rentEvent) {
      return {
        status: "rent-missing",
        assumptions,
      };
    }

    const ownProjection = computeProjection(mapScenarioToEngineInput(scenario));
    const rentScenario = toRentComparisonScenario(scenario);
    const rentProjection = computeProjection(mapScenarioToEngineInput(rentScenario));

    const ownSeries = normalizeProjection(ownProjection);
    const rentSeries = normalizeProjection(rentProjection);
    const metrics = computeComparisonMetrics(ownSeries, rentSeries);

    if (!metrics) {
      return {
        status: "insufficient-data",
        assumptions,
      };
    }

    return {
      status: "ready",
      assumptions,
      ...metrics,
    };
  }, [scenario]);
