import type { Event } from "@north-star/types";

export type ProjectionInput = {
  baseMonth: string;
  horizonMonths: number;
  initialCash?: number;
  events: Event[];
};

export type ProjectionResult = {
  baseMonth: string;
  months: string[];
  netCashflow: number[];
  cashBalance: number[];
  lowestMonthlyBalance: { value: number; index: number; month: string };
  runwayMonths: number;
  netWorthYear5: number;
  riskLevel: "Low" | "Medium" | "High";
};

export function parseMonth(value: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid month format: ${value}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month value: ${value}`);
  }
  return { year, month };
}

export function monthIndex(baseMonth: string, targetMonth: string): number {
  const base = parseMonth(baseMonth);
  const target = parseMonth(targetMonth);
  return (target.year - base.year) * 12 + (target.month - base.month);
}

export function addMonths(baseMonth: string, offset: number): string {
  const base = parseMonth(baseMonth);
  const totalMonths = base.year * 12 + (base.month - 1) + offset;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const monthValue = String(month + 1).padStart(2, "0");
  return `${year}-${monthValue}`;
}

export function buildMonthRange(baseMonth: string, horizonMonths: number): string[] {
  const months: string[] = [];
  for (let i = 0; i < horizonMonths; i += 1) {
    months.push(addMonths(baseMonth, i));
  }
  return months;
}

export function expandEventToSeries(
  event: Event,
  baseMonth: string,
  horizonMonths: number
): number[] {
  const series = Array.from({ length: horizonMonths }, () => 0);
  if (!event.enabled || horizonMonths <= 0) {
    return series;
  }

  const startIndex = monthIndex(baseMonth, event.startMonth);
  const endIndex = event.endMonth ? monthIndex(baseMonth, event.endMonth) : horizonMonths - 1;
  const recurringAmount = event.monthlyAmount ?? 0;
  const oneTimeAmount = event.oneTimeAmount ?? 0;
  const annualGrowthPct = event.annualGrowthPct ?? 0;

  for (let i = 0; i < horizonMonths; i += 1) {
    if (i < startIndex || i > endIndex) {
      continue;
    }
    const yearsSinceStart = Math.floor((i - startIndex) / 12);
    const multiplier = Math.pow(1 + annualGrowthPct, yearsSinceStart);
    series[i] += recurringAmount * multiplier;
  }

  if (startIndex >= 0 && startIndex < horizonMonths) {
    series[startIndex] += oneTimeAmount;
  }

  return series;
}

export function computeProjection(input: ProjectionInput): ProjectionResult {
  const horizonMonths = input.horizonMonths;
  const months = buildMonthRange(input.baseMonth, horizonMonths);
  const netCashflow = Array.from({ length: horizonMonths }, () => 0);
  const initialCash = input.initialCash ?? 0;

  for (const event of input.events) {
    const series = expandEventToSeries(event, input.baseMonth, horizonMonths);
    for (let i = 0; i < horizonMonths; i += 1) {
      netCashflow[i] += series[i];
    }
  }

  const cashBalance: number[] = [];
  for (let i = 0; i < horizonMonths; i += 1) {
    const prior = i === 0 ? initialCash : cashBalance[i - 1];
    cashBalance[i] = prior + netCashflow[i];
  }

  const lowest = cashBalance.reduce(
    (current, value, index) => {
      if (value < current.value) {
        return { value, index };
      }
      return current;
    },
    { value: cashBalance[0] ?? initialCash, index: 0 }
  );

  const lowestMonthlyBalance = {
    value: lowest.value,
    index: lowest.index,
    month: months[lowest.index] ?? input.baseMonth,
  };

  const monthZeroCash = cashBalance[0] ?? initialCash;
  const burn = Math.max(0, -(netCashflow[0] ?? 0));
  let runwayMonths = 999;
  if (burn > 0) {
    runwayMonths = monthZeroCash <= 0 ? 0 : Math.floor(monthZeroCash / burn);
  }

  const year5Index = Math.min(60, Math.max(0, horizonMonths - 1));
  const netWorthYear5 =
    cashBalance.length === 0 ? initialCash : cashBalance[year5Index] ?? initialCash;

  let riskLevel: ProjectionResult["riskLevel"] = "Low";
  if (lowestMonthlyBalance.value < 0 || runwayMonths < 3) {
    riskLevel = "High";
  } else if (runwayMonths < 6) {
    riskLevel = "Medium";
  }

  return {
    baseMonth: input.baseMonth,
    months,
    netCashflow,
    cashBalance,
    lowestMonthlyBalance,
    runwayMonths,
    netWorthYear5,
    riskLevel,
  };
}
