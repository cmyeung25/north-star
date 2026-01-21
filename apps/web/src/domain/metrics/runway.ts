import type { ProjectionResult } from "@north-star/engine";
import { normalizeMonthStrict } from "../../utils/month";

export type RunwaySimulationRow = {
  month: string;
  startingResources: number;
  netCashflow: number;
  endingResources: number;
  note?: string;
};

export type RunwaySimulation = {
  months: number | null;
  horizonMonths: number;
  isCapped: boolean;
  startingResources: number;
  endingResources: number | null;
  trace: RunwaySimulationRow[];
  netCashflowSeries: Array<{ month: string; value: number }>;
  reason?: string;
};

const isInternalTransferKey = (key: string) =>
  key.startsWith("investment:") && /:(contribution|withdrawal)$/.test(key);

const isFiniteNumber = (value: number) => Number.isFinite(value) && !Number.isNaN(value);

export const buildRunwayNetCashflowSeries = (
  projection: ProjectionResult
): Array<{ month: string; value: number }> => {
  const breakdown = projection.breakdown?.cashflow;
  if (breakdown) {
    return projection.months.map((month, index) => {
      const value = Object.entries(breakdown.byKey).reduce((sum, [key, series]) => {
        if (isInternalTransferKey(key)) {
          return sum;
        }
        return sum + (series[index] ?? 0);
      }, 0);
      return { month, value };
    });
  }

  if (projection.netCashflow.length > 0) {
    return projection.months.map((month, index) => ({
      month,
      value: projection.netCashflow[index] ?? 0,
    }));
  }

  return projection.months.map((month, index) => {
    const current = projection.cashBalance[index] ?? 0;
    const previous = index === 0 ? projection.cashBalance[0] ?? 0 : projection.cashBalance[index - 1] ?? 0;
    return { month, value: current - previous };
  });
};

export const computeRunwaySimulation = (params: {
  projection: ProjectionResult;
  baseMonth: string | null | undefined;
  startingCash: number;
  withdrawableAssets: number;
  horizonMonths: number;
  netCashflowSeries?: Array<{ month: string; value: number }>;
  traceMonths?: number;
}): RunwaySimulation => {
  const {
    projection,
    baseMonth,
    startingCash,
    withdrawableAssets,
    horizonMonths,
    netCashflowSeries,
    traceMonths = 12,
  } = params;
  const normalizedBaseMonth = baseMonth ? normalizeMonthStrict(baseMonth) : null;
  if (!normalizedBaseMonth?.ok) {
    return {
      months: null,
      horizonMonths,
      isCapped: false,
      startingResources: 0,
      endingResources: null,
      trace: [],
      netCashflowSeries: [],
      reason: "invalid-base-month",
    };
  }

  const series = netCashflowSeries ?? buildRunwayNetCashflowSeries(projection);
  if (series.length === 0 || series.some((entry) => !isFiniteNumber(entry.value))) {
    return {
      months: null,
      horizonMonths,
      isCapped: false,
      startingResources: 0,
      endingResources: null,
      trace: [],
      netCashflowSeries: series,
      reason: "missing-cashflow",
    };
  }

  const startingResources = startingCash + withdrawableAssets;
  if (!isFiniteNumber(startingResources)) {
    return {
      months: null,
      horizonMonths,
      isCapped: false,
      startingResources: 0,
      endingResources: null,
      trace: [],
      netCashflowSeries: series,
      reason: "invalid-resources",
    };
  }

  let resources = startingResources;
  const trace: RunwaySimulationRow[] = [];
  let runwayMonths: number | null = null;
  let endingResources: number | null = null;
  let depleted = false;

  for (let index = 0; index < series.length && index < horizonMonths; index += 1) {
    const entry = series[index];
    if (!entry) {
      runwayMonths = null;
      break;
    }
    const starting = resources;
    const net = entry.value ?? 0;
    const ending = starting + net;
    if (index < traceMonths) {
      trace.push({
        month: entry.month,
        startingResources: starting,
        netCashflow: net,
        endingResources: ending,
        note: net >= 0 ? "surplus" : "burn",
      });
    }
    if (ending < 0) {
      runwayMonths = index;
      endingResources = ending;
      depleted = true;
      break;
    }
    resources = ending;
    endingResources = ending;
  }

  if (!depleted) {
    const resolvedMonths = Math.min(horizonMonths, series.length);
    return {
      months: resolvedMonths,
      horizonMonths,
      isCapped: true,
      startingResources,
      endingResources,
      trace,
      netCashflowSeries: series,
    };
  }

  return {
    months: runwayMonths,
    horizonMonths,
    isCapped: false,
    startingResources,
    endingResources,
    trace,
    netCashflowSeries: series,
  };
};
