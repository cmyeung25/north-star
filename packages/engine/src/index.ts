// Shape note: HomePosition originally included purchasePrice/downPayment/purchaseMonth/annualAppreciation/mortgage (+feesOneTime).
// Added fields: holdingCostMonthly, holdingCostAnnualGrowth (decimal, optional).
// Back-compat: missing holdingCostMonthly/holdingCostAnnualGrowth should be treated as 0.
import type { Event } from "@north-star/types";

import { computeMortgageSchedule } from "./mortgage";

export type EngineEvent = Event & {
  id?: string;
  type?: string;
  meta?: {
    category?: "cashflow" | "asset" | "liability";
  };
};

export type HomePosition = {
  id?: string;
  name?: string;
  usage?: "primary" | "investment";
  mode?: "new_purchase" | "existing";
  purchasePrice?: number;
  annualAppreciation: number;
  purchaseMonth?: string;
  downPayment?: number;
  mortgage?: {
    principal: number;
    annualRate: number;
    termMonths: number;
  };
  feesOneTime?: number;
  holdingCostMonthly?: number;
  holdingCostAnnualGrowth?: number;
  existing?: {
    asOfMonth: string;
    marketValue: number;
    mortgageBalance: number;
    remainingTermMonths: number;
    annualRate: number;
  };
  rental?: {
    rentMonthly: number;
    rentStartMonth: string;
    rentEndMonth?: string;
    rentAnnualGrowth?: number;
    vacancyRate?: number;
  };
};

export type InvestmentAssetClass = "equity" | "bond" | "fund" | "crypto";

export type InvestmentPosition = {
  id?: string;
  assetClass: InvestmentAssetClass;
  marketValue: number;
  expectedAnnualReturn?: number;
  monthlyContribution?: number;
};

export type InsuranceType = "life" | "savings" | "accident" | "medical";

export type InsurancePosition = {
  id?: string;
  insuranceType: InsuranceType;
  premiumMonthly: number;
  hasCashValue?: boolean;
  cashValue?: number;
  cashValueAnnualGrowth?: number;
  coverageMeta?: Record<string, unknown>;
};

export type PositionsInput = {
  home?: HomePosition;
  homes?: HomePosition[];
  investments?: InvestmentPosition[];
  insurances?: InsurancePosition[];
};

export type ProjectionInput = {
  baseMonth: string;
  horizonMonths: number;
  initialCash?: number;
  events: EngineEvent[];
  positions?: PositionsInput;
};

export type ProjectionResult = {
  baseMonth: string;
  months: string[];
  netCashflow: number[];
  cashBalance: number[];
  assets: {
    housing: number[];
    investments: number[];
    insurance: number[];
    total: number[];
  };
  liabilities: {
    mortgage: number[];
    total: number[];
  };
  netWorth: number[];
  lowestMonthlyBalance: { value: number; index: number; month: string };
  lowestNetWorth?: { value: number; index: number; month: string };
  runwayMonths: number;
  netWorthYear5: number;
  riskLevel: "Low" | "Medium" | "High";
  breakdown?: {
    cashflow: {
      months: string[];
      byKey: Record<string, number[]>;
      totals: number[];
    };
    assets: {
      months: string[];
      assetsByKey: Record<string, number[]>;
      liabilitiesByKey: Record<string, number[]>;
    };
  };
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
  event: EngineEvent,
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

const computeHomeSeriesFromValue = ({
  initialValue,
  annualAppreciation,
  startIndex,
  horizonMonths,
}: {
  initialValue: number;
  annualAppreciation: number;
  startIndex: number;
  horizonMonths: number;
}): number[] => {
  const series = Array.from({ length: horizonMonths }, () => 0);
  if (initialValue <= 0 || horizonMonths <= 0) {
    return series;
  }

  const monthlyGrowth = Math.pow(1 + annualAppreciation, 1 / 12) - 1;
  if (startIndex >= horizonMonths) {
    return series;
  }

  const start = Math.max(0, startIndex);
  const valueAtStart =
    startIndex < 0
      ? initialValue * Math.pow(1 + monthlyGrowth, -startIndex)
      : initialValue;

  series[start] = valueAtStart;
  for (let i = start + 1; i < horizonMonths; i += 1) {
    series[i] = series[i - 1] * (1 + monthlyGrowth);
  }

  return series;
};

const computeMortgageScheduleWithOffset = ({
  principal,
  annualRate,
  termMonths,
  startIndex,
  horizonMonths,
}: {
  principal: number;
  annualRate: number;
  termMonths: number;
  startIndex: number;
  horizonMonths: number;
}) => {
  if (startIndex >= 0) {
    return computeMortgageSchedule({
      principal,
      annualRate,
      termMonths,
      startIndex,
      horizonMonths,
    });
  }

  const offset = Math.max(0, -startIndex);
  const expanded = computeMortgageSchedule({
    principal,
    annualRate,
    termMonths,
    startIndex: 0,
    horizonMonths: horizonMonths + offset,
  });

  return {
    paymentMonthly: expanded.paymentMonthly,
    interestSeries: expanded.interestSeries.slice(offset, offset + horizonMonths),
    principalSeries: expanded.principalSeries.slice(offset, offset + horizonMonths),
    balanceSeries: expanded.balanceSeries.slice(offset, offset + horizonMonths),
  };
};

export function computeProjection(input: ProjectionInput): ProjectionResult {
  const horizonMonths = input.horizonMonths;
  const months = buildMonthRange(input.baseMonth, horizonMonths);
  const netCashflow = Array.from({ length: horizonMonths }, () => 0);
  const initialCash = input.initialCash ?? 0;
  const assetsHousing = Array.from({ length: horizonMonths }, () => 0);
  const assetsInvestments = Array.from({ length: horizonMonths }, () => 0);
  const assetsInsurance = Array.from({ length: horizonMonths }, () => 0);
  const liabilitiesMortgage = Array.from({ length: horizonMonths }, () => 0);
  const cashflowLedger = {
    months,
    byKey: {} as Record<string, number[]>,
    totals: Array.from({ length: horizonMonths }, () => 0),
  };
  const assetsLedger = {
    months,
    assetsByKey: {} as Record<string, number[]>,
    liabilitiesByKey: {} as Record<string, number[]>,
  };

  const ensureLedgerSeries = (ledger: Record<string, number[]>, key: string) => {
    if (!ledger[key]) {
      ledger[key] = Array.from({ length: horizonMonths }, () => 0);
    }
    return ledger[key];
  };

  const addCashflow = (key: string, index: number, amount: number) => {
    if (!amount) {
      return;
    }
    const series = ensureLedgerSeries(cashflowLedger.byKey, key);
    series[index] += amount;
    cashflowLedger.totals[index] += amount;
  };

  const addAsset = (key: string, index: number, amount: number) => {
    if (!amount && amount !== 0) {
      return;
    }
    const series = ensureLedgerSeries(assetsLedger.assetsByKey, key);
    series[index] += amount;
  };

  const addLiability = (key: string, index: number, amount: number) => {
    if (!amount && amount !== 0) {
      return;
    }
    const series = ensureLedgerSeries(assetsLedger.liabilitiesByKey, key);
    series[index] += amount;
  };

  for (const [eventIndex, event] of input.events.entries()) {
    const series = expandEventToSeries(event, input.baseMonth, horizonMonths);
    const eventKey = `event:${event.id ?? event.type ?? `event-${eventIndex + 1}`}`;
    for (let i = 0; i < horizonMonths; i += 1) {
      netCashflow[i] += series[i];
      if (series[i] !== 0) {
        addCashflow(eventKey, i, series[i]);
      }
    }
  }

  const homes = input.positions?.homes ?? (input.positions?.home ? [input.positions.home] : []);
  homes.forEach((home, homeIndex) => {
    const mode = home.mode ?? "new_purchase";
    const purchaseMonth =
      mode === "existing" && home.existing ? home.existing.asOfMonth : home.purchaseMonth;
    const startIndex = purchaseMonth
      ? monthIndex(input.baseMonth, purchaseMonth)
      : horizonMonths;
    const purchaseIndex = startIndex;
    const homeId = home.id ?? `home-${homeIndex + 1}`;

    if (mode === "new_purchase" && purchaseIndex >= 0 && purchaseIndex < horizonMonths) {
      const downPayment = home.downPayment ?? 0;
      if (downPayment) {
        netCashflow[purchaseIndex] -= downPayment;
        addCashflow(`home:${homeId}:down_payment`, purchaseIndex, -downPayment);
      }
      if (home.feesOneTime) {
        netCashflow[purchaseIndex] -= home.feesOneTime;
        addCashflow(`home:${homeId}:fees_one_time`, purchaseIndex, -home.feesOneTime);
      }
    }

    const holdingCostMonthly = home.holdingCostMonthly ?? 0;
    const holdingCostAnnualGrowth = home.holdingCostAnnualGrowth ?? 0;
    if (holdingCostMonthly > 0 && horizonMonths > 0) {
      const holdingStartIndex = Math.max(0, startIndex);
      for (let i = holdingStartIndex; i < horizonMonths; i += 1) {
        const monthsSincePurchase = i - startIndex;
        const cost =
          holdingCostMonthly *
          Math.pow(1 + holdingCostAnnualGrowth, monthsSincePurchase / 12);
        netCashflow[i] -= cost;
        addCashflow(`home:${homeId}:holding_cost`, i, -cost);
      }
    }

    const assetValue =
      mode === "existing" && home.existing ? home.existing.marketValue : home.purchasePrice ?? 0;
    const homeSeries = computeHomeSeriesFromValue({
      initialValue: assetValue,
      annualAppreciation: home.annualAppreciation,
      startIndex,
      horizonMonths,
    });

    for (let i = 0; i < horizonMonths; i += 1) {
      assetsHousing[i] += homeSeries[i];
      addAsset(`home:${homeId}`, i, homeSeries[i]);
    }

    const mortgageDetails =
      mode === "existing" && home.existing
        ? {
            principal: home.existing.mortgageBalance,
            annualRate: home.existing.annualRate,
            termMonths: home.existing.remainingTermMonths,
          }
        : home.mortgage;

    if (mortgageDetails) {
      const schedule = computeMortgageScheduleWithOffset({
        principal: mortgageDetails.principal,
        annualRate: mortgageDetails.annualRate,
        termMonths: mortgageDetails.termMonths,
        startIndex,
        horizonMonths,
      });

      for (let i = 0; i < horizonMonths; i += 1) {
        const payment = schedule.interestSeries[i] + schedule.principalSeries[i];
        if (payment !== 0) {
          netCashflow[i] -= payment;
        }
        if (schedule.interestSeries[i]) {
          addCashflow(
            `home:${homeId}:mortgage_interest`,
            i,
            -schedule.interestSeries[i]
          );
        }
        if (schedule.principalSeries[i]) {
          addCashflow(
            `home:${homeId}:mortgage_principal`,
            i,
            -schedule.principalSeries[i]
          );
        }
        liabilitiesMortgage[i] += schedule.balanceSeries[i];
        addLiability(`home:${homeId}:mortgage`, i, schedule.balanceSeries[i]);
      }
    }

    if (home.rental && home.rental.rentMonthly > 0) {
      const rentStartIndex = monthIndex(input.baseMonth, home.rental.rentStartMonth);
      const rentEndIndex = home.rental.rentEndMonth
        ? monthIndex(input.baseMonth, home.rental.rentEndMonth)
        : horizonMonths - 1;
      const rentAnnualGrowth = home.rental.rentAnnualGrowth ?? 0;
      const vacancyRate = home.rental.vacancyRate ?? 0;

      for (let i = 0; i < horizonMonths; i += 1) {
        if (i < rentStartIndex || i > rentEndIndex) {
          continue;
        }
        const yearsSinceStart = Math.floor((i - rentStartIndex) / 12);
        const multiplier = Math.pow(1 + rentAnnualGrowth, yearsSinceStart);
        const income = home.rental.rentMonthly * multiplier * (1 - vacancyRate);
        netCashflow[i] += income;
        addCashflow(`home:${homeId}:rental_income`, i, income);
      }
    }
  });

  const investments = input.positions?.investments ?? [];
  investments.forEach((investment, investmentIndex) => {
    const marketValue = investment.marketValue ?? 0;
    const annualReturn = investment.expectedAnnualReturn ?? 0;
    const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1;
    const monthlyContribution = investment.monthlyContribution ?? 0;
    const series = Array.from({ length: horizonMonths }, () => 0);
    const investmentId = investment.id ?? `investment-${investmentIndex + 1}`;

    if (horizonMonths > 0) {
      series[0] = marketValue + monthlyContribution;
      netCashflow[0] -= monthlyContribution;
      if (monthlyContribution) {
        addCashflow(`investment:${investmentId}:contribution`, 0, -monthlyContribution);
      }
    }

    for (let i = 1; i < horizonMonths; i += 1) {
      series[i] = series[i - 1] * (1 + monthlyReturn) + monthlyContribution;
      netCashflow[i] -= monthlyContribution;
      if (monthlyContribution) {
        addCashflow(`investment:${investmentId}:contribution`, i, -monthlyContribution);
      }
    }

    for (let i = 0; i < horizonMonths; i += 1) {
      assetsInvestments[i] += series[i];
      addAsset(`investment:${investmentId}`, i, series[i]);
    }
  });

  const insurances = input.positions?.insurances ?? [];
  insurances.forEach((insurance, insuranceIndex) => {
    const premiumMonthly = insurance.premiumMonthly ?? 0;
    const cashValue = insurance.hasCashValue ? insurance.cashValue ?? 0 : 0;
    const annualGrowth = insurance.cashValueAnnualGrowth ?? 0;
    const monthlyGrowth = Math.pow(1 + annualGrowth, 1 / 12) - 1;
    const series = Array.from({ length: horizonMonths }, () => 0);
    const insuranceId = insurance.id ?? `insurance-${insuranceIndex + 1}`;

    for (let i = 0; i < horizonMonths; i += 1) {
      netCashflow[i] -= premiumMonthly;
      if (premiumMonthly) {
        addCashflow(`insurance:${insuranceId}:premium`, i, -premiumMonthly);
      }
    }

    if (insurance.hasCashValue && horizonMonths > 0) {
      series[0] = cashValue;
      for (let i = 1; i < horizonMonths; i += 1) {
        series[i] = series[i - 1] * (1 + monthlyGrowth);
      }
    }

    for (let i = 0; i < horizonMonths; i += 1) {
      assetsInsurance[i] += series[i];
      addAsset(`insurance:${insuranceId}`, i, series[i]);
    }
  });

  const cashBalance: number[] = [];
  for (let i = 0; i < horizonMonths; i += 1) {
    const prior = i === 0 ? initialCash : cashBalance[i - 1];
    cashBalance[i] = prior + netCashflow[i];
    addAsset("cash", i, cashBalance[i]);
  }

  const assetsTotal = assetsHousing.map(
    (value, index) => value + assetsInvestments[index] + assetsInsurance[index]
  );
  const liabilitiesTotal = liabilitiesMortgage.map((value) => value);
  const netWorth = cashBalance.map(
    (cash, index) => cash + assetsTotal[index] - liabilitiesTotal[index]
  );

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

  const lowestNetWorthValue = netWorth.reduce(
    (current, value, index) => {
      if (value < current.value) {
        return { value, index };
      }
      return current;
    },
    { value: netWorth[0] ?? initialCash, index: 0 }
  );

  const lowestNetWorth = {
    value: lowestNetWorthValue.value,
    index: lowestNetWorthValue.index,
    month: months[lowestNetWorthValue.index] ?? input.baseMonth,
  };

  const monthZeroCash = cashBalance[0] ?? initialCash;
  const burn = Math.max(0, -(netCashflow[0] ?? 0));
  let runwayMonths = 999;
  if (burn > 0) {
    runwayMonths = monthZeroCash <= 0 ? 0 : Math.floor(monthZeroCash / burn);
  }

  const year5Index = Math.min(60, Math.max(0, horizonMonths - 1));
  const netWorthYear5 = netWorth[year5Index] ?? initialCash;

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
    assets: {
      housing: assetsHousing,
      investments: assetsInvestments,
      insurance: assetsInsurance,
      total: assetsTotal,
    },
    liabilities: {
      mortgage: liabilitiesMortgage,
      total: liabilitiesTotal,
    },
    netWorth,
    lowestMonthlyBalance,
    lowestNetWorth,
    runwayMonths,
    netWorthYear5,
    riskLevel,
    breakdown: {
      cashflow: cashflowLedger,
      assets: assetsLedger,
    },
  };
}

export { computeHomeValueSeries } from "./home";
export { computeMortgageSchedule } from "./mortgage";
export * from "./eventCatalog";
export * from "./eventFallbacks";
export * from "./eventCatalog";
export * from "./eventFallbacks";
