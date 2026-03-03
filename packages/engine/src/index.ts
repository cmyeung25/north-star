// Shape note: HomePosition originally included purchasePrice/downPayment/purchaseMonth/annualAppreciation/mortgage (+feesOneTime).
// Added fields: holdingCostMonthly, holdingCostAnnualGrowth (decimal, optional).
// Back-compat: missing holdingCostMonthly/holdingCostAnnualGrowth should be treated as 0.
import type { Event } from "@north-star/types";

import { applyAmortizationMonth, calcFixedMonthlyPayment } from "./amortization";
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
  sellMonth?: string;
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

export type EngineInvestment = {
  id?: string;
  startMonth: string;
  initialValue: number;
  annualReturnRate: number;
  monthlyContribution?: number;
  monthlyWithdrawal?: number;
  contributionSchedule?: { month: string; amount: number }[];
  withdrawalSchedule?: { month: string; amount: number }[];
  feeAnnualRate?: number;
};

export type EngineLoan = {
  id?: string;
  startMonth: string;
  principal: number;
  annualInterestRate: number;
  termMonths: number;
  monthlyPayment?: number;
  feesOneTime?: number;
};

export type InsuranceKind = "protection" | "savings";

export type InsurancePosition = {
  id?: string;
  kind: InsuranceKind;
  startMonth: string;
  endMonth?: string;
  premiumMonthly: number;
  premiumAnnualGrowth?: number;
  initialCashValue?: number;
  annualReturnRate?: number;
};

export type EngineCar = {
  id?: string;
  purchaseMonth: string;
  purchasePrice: number;
  downPayment: number;
  annualDepreciationRate: number;
  holdingCostMonthly: number;
  holdingCostAnnualGrowth: number;
  loan?: {
    principal: number;
    annualInterestRate: number;
    termMonths: number;
    monthlyPayment?: number;
  };
  sellMonth?: string;
};

export type EngineCashBucket = {
  id?: string;
  name?: string;
  balance?: number;
  asOfMonth?: string;
};

export type PositionsInput = {
  home?: HomePosition;
  homes?: HomePosition[];
  investments?: EngineInvestment[];
  insurances?: InsurancePosition[];
  loans?: EngineLoan[];
  cars?: EngineCar[];
  cashBuckets?: EngineCashBucket[];
};

export type ProjectionInput = {
  baseMonth: string;
  horizonMonths: number;
  initialCash?: number;
  cashYieldPct?: number;
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
    cars: number[];
    investments: number[];
    insurance: number[];
    total: number[];
  };
  liabilities: {
    mortgage: number[];
    loans: number[];
    auto: number[];
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
  const cashYieldPct = input.cashYieldPct ?? 0;
  const cashMonthlyYieldRate =
    cashYieldPct === 0 ? 0 : Math.pow(1 + cashYieldPct / 100, 1 / 12) - 1;
  const assetsHousing = Array.from({ length: horizonMonths }, () => 0);
  const assetsCars = Array.from({ length: horizonMonths }, () => 0);
  const assetsInvestments = Array.from({ length: horizonMonths }, () => 0);
  const assetsInsurance = Array.from({ length: horizonMonths }, () => 0);
  const liabilitiesMortgage = Array.from({ length: horizonMonths }, () => 0);
  const liabilitiesLoans = Array.from({ length: horizonMonths }, () => 0);
  const liabilitiesAuto = Array.from({ length: horizonMonths }, () => 0);
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

  const eventSeries = input.events.map((event, eventIndex) => ({
    eventKey: `event:${event.id ?? event.type ?? `event-${eventIndex + 1}`}`,
    series: expandEventToSeries(event, input.baseMonth, horizonMonths),
  }));

  const homes = input.positions?.homes ?? (input.positions?.home ? [input.positions.home] : []);
  const homeSeriesData = homes.map((home, homeIndex) => {
    const mode = home.mode ?? "new_purchase";
    const purchaseMonth =
      mode === "existing" && home.existing ? home.existing.asOfMonth : home.purchaseMonth;
    const startIndex = purchaseMonth
      ? monthIndex(input.baseMonth, purchaseMonth)
      : horizonMonths;
    const sellIndex = home.sellMonth ? monthIndex(input.baseMonth, home.sellMonth) : null;
    const homeId = home.id ?? `home-${homeIndex + 1}`;
    const assetValue =
      mode === "existing" && home.existing ? home.existing.marketValue : home.purchasePrice ?? 0;
    const homeSeries = computeHomeSeriesFromValue({
      initialValue: assetValue,
      annualAppreciation: home.annualAppreciation,
      startIndex,
      horizonMonths,
    });

    const mortgageDetails =
      mode === "existing" && home.existing
        ? {
            principal: home.existing.mortgageBalance,
            annualRate: home.existing.annualRate,
            termMonths: home.existing.remainingTermMonths,
          }
        : home.mortgage;

    const mortgageSchedule = mortgageDetails
      ? computeMortgageScheduleWithOffset({
          principal: mortgageDetails.principal,
          annualRate: mortgageDetails.annualRate,
          termMonths: mortgageDetails.termMonths,
          startIndex,
          horizonMonths,
        })
      : null;

    return {
      home,
      homeId,
      mode,
      startIndex,
      purchaseIndex: startIndex,
      sellIndex,
      homeSeries,
      mortgageSchedule,
    };
  });

  const investments = input.positions?.investments ?? [];
  const investmentStates = investments.map((investment, investmentIndex) => {
    const monthlyContribution = investment.monthlyContribution ?? 0;
    const monthlyWithdrawal = investment.monthlyWithdrawal ?? 0;
    const contributionSchedule = investment.contributionSchedule ?? [];
    const withdrawalSchedule = investment.withdrawalSchedule ?? [];
    const hasContributionSchedule = contributionSchedule.length > 0;
    const hasWithdrawalSchedule = withdrawalSchedule.length > 0;
    const scheduleEntries = [...contributionSchedule, ...withdrawalSchedule];
    const scheduleStartIndex =
      scheduleEntries.length > 0
        ? scheduleEntries.reduce((minIndex, entry) => {
            const index = monthIndex(input.baseMonth, entry.month);
            return Math.min(minIndex, index);
          }, Number.POSITIVE_INFINITY)
        : null;
    const growthFactor = Math.pow(1 + investment.annualReturnRate, 1 / 12);
    const feeFactor =
      typeof investment.feeAnnualRate === "number"
        ? Math.pow(1 - investment.feeAnnualRate, 1 / 12)
        : 1;
    const monthlyFactor = growthFactor * feeFactor;
    const declaredStartIndex = monthIndex(input.baseMonth, investment.startMonth);
    const startIndex =
      scheduleStartIndex !== null && Number.isFinite(scheduleStartIndex)
        ? Math.min(declaredStartIndex, scheduleStartIndex)
        : declaredStartIndex;
    const investmentId = investment.id ?? `investment-${investmentIndex + 1}`;
    let currentValue = investment.initialValue ?? 0;
    const contributionByIndex = new Map<number, number>();
    const withdrawalByIndex = new Map<number, number>();

    contributionSchedule.forEach((entry) => {
      const index = monthIndex(input.baseMonth, entry.month);
      contributionByIndex.set(index, (contributionByIndex.get(index) ?? 0) + entry.amount);
    });
    withdrawalSchedule.forEach((entry) => {
      const index = monthIndex(input.baseMonth, entry.month);
      withdrawalByIndex.set(index, (withdrawalByIndex.get(index) ?? 0) + entry.amount);
    });

    if (startIndex < 0 && horizonMonths > 0) {
      for (let i = startIndex; i < 0; i += 1) {
        const contribution = hasContributionSchedule
          ? contributionByIndex.get(i) ?? 0
          : monthlyContribution;
        const withdrawalTarget = hasWithdrawalSchedule
          ? withdrawalByIndex.get(i) ?? 0
          : monthlyWithdrawal;
        const withdrawal = Math.min(currentValue, withdrawalTarget);
        currentValue = currentValue + contribution - withdrawal;
        currentValue *= monthlyFactor;
      }
    }

    return {
      investment,
      investmentId,
      startIndex,
      monthlyContribution: hasContributionSchedule ? 0 : monthlyContribution,
      monthlyWithdrawal: hasWithdrawalSchedule ? 0 : monthlyWithdrawal,
      contributionByIndex,
      withdrawalByIndex,
      hasContributionSchedule,
      hasWithdrawalSchedule,
      monthlyFactor,
      currentValue,
    };
  });

  const insurances = input.positions?.insurances ?? [];
  const insuranceStates = insurances.map((insurance, insuranceIndex) => {
    const premiumMonthly = insurance.premiumMonthly ?? 0;
    const annualPremiumGrowth = insurance.premiumAnnualGrowth ?? 0;
    const monthlyPremiumGrowth =
      annualPremiumGrowth === 0 ? 0 : Math.pow(1 + annualPremiumGrowth, 1 / 12) - 1;
    const annualReturn = insurance.annualReturnRate ?? 0;
    const monthlyReturn =
      annualReturn === 0 ? 0 : Math.pow(1 + annualReturn, 1 / 12) - 1;
    const startIndex = monthIndex(input.baseMonth, insurance.startMonth);
    const endIndex = insurance.endMonth
      ? monthIndex(input.baseMonth, insurance.endMonth)
      : horizonMonths - 1;
    const insuranceId = insurance.id ?? `insurance-${insuranceIndex + 1}`;
    let currentValue = insurance.initialCashValue ?? 0;

    if (insurance.kind === "savings" && startIndex < 0) {
      const lastIndex = Math.min(-1, endIndex);
      const advanceMonths = Math.max(0, lastIndex - startIndex + 1);
      for (let offset = 0; offset < advanceMonths; offset += 1) {
        const premium =
          endIndex >= startIndex + offset
            ? premiumMonthly * Math.pow(1 + monthlyPremiumGrowth, offset)
            : 0;
        currentValue = (currentValue + premium) * (1 + monthlyReturn);
      }
    }
    return {
      insuranceId,
      kind: insurance.kind,
      premiumMonthly,
      monthlyPremiumGrowth,
      monthlyReturn,
      startIndex,
      endIndex,
      currentValue,
    };
  });

  const loans = input.positions?.loans ?? [];
  const loanStates = loans.map((loan, loanIndex) => {
    const startIndex = monthIndex(input.baseMonth, loan.startMonth);
    const monthlyRate = (loan.annualInterestRate ?? 0) / 12;
    const payment =
      loan.monthlyPayment ??
      calcFixedMonthlyPayment(loan.principal ?? 0, loan.annualInterestRate ?? 0, loan.termMonths);
    const loanId = loan.id ?? `loan-${loanIndex + 1}`;
    let outstanding = loan.principal ?? 0;
    let monthsElapsed = 0;

    if (startIndex < 0 && outstanding > 0 && loan.termMonths > 0) {
      const advanceMonths = Math.min(loan.termMonths, -startIndex);
      for (let i = 0; i < advanceMonths; i += 1) {
        const { nextOutstanding } = applyAmortizationMonth(
          outstanding,
          monthlyRate,
          payment
        );
        outstanding = nextOutstanding;
        monthsElapsed += 1;
        if (outstanding <= 0) {
          break;
        }
      }
    }

    return {
      loan,
      loanId,
      startIndex,
      monthlyRate,
      payment,
      outstanding,
      monthsElapsed,
    };
  });

  const cars = input.positions?.cars ?? [];
  const carStates = cars.map((car, carIndex) => {
    const startIndex = monthIndex(input.baseMonth, car.purchaseMonth);
    const sellIndex = car.sellMonth ? monthIndex(input.baseMonth, car.sellMonth) : null;
    const monthlyDepreciation = Math.pow(1 - car.annualDepreciationRate, 1 / 12);
    const holdingCostMonthly = car.holdingCostMonthly ?? 0;
    const holdingCostAnnualGrowth = car.holdingCostAnnualGrowth ?? 0;
    const carId = car.id ?? `car-${carIndex + 1}`;

    let currentValue = car.purchasePrice ?? 0;
    if (startIndex < 0) {
      currentValue = currentValue * Math.pow(monthlyDepreciation, -startIndex);
    }

    const loan = car.loan;
    let loanState: {
      outstanding: number;
      monthlyRate: number;
      payment: number;
      monthsElapsed: number;
      termMonths: number;
    } | null = null;

    if (loan && loan.principal > 0 && loan.termMonths > 0) {
      const monthlyRate = loan.annualInterestRate / 12;
      const payment =
        loan.monthlyPayment ??
        calcFixedMonthlyPayment(loan.principal, loan.annualInterestRate, loan.termMonths);
      let outstanding = loan.principal;
      let monthsElapsed = 0;

      if (startIndex < 0) {
        const advanceMonths = Math.min(loan.termMonths, -startIndex);
        for (let i = 0; i < advanceMonths; i += 1) {
          const { nextOutstanding } = applyAmortizationMonth(
            outstanding,
            monthlyRate,
            payment
          );
          outstanding = nextOutstanding;
          monthsElapsed += 1;
          if (outstanding <= 0) {
            break;
          }
        }
      }

      loanState = {
        outstanding,
        monthlyRate,
        payment,
        monthsElapsed,
        termMonths: loan.termMonths,
      };
    }

    return {
      car,
      carId,
      startIndex,
      sellIndex,
      monthlyDepreciation,
      holdingCostMonthly,
      holdingCostAnnualGrowth,
      currentValue,
      loanState,
    };
  });

  for (let i = 0; i < horizonMonths; i += 1) {
    for (const { eventKey, series } of eventSeries) {
      const amount = series[i] ?? 0;
      if (amount !== 0) {
        netCashflow[i] += amount;
        addCashflow(eventKey, i, amount);
      }
    }

    for (const homeData of homeSeriesData) {
      const {
        home,
        homeId,
        mode,
        startIndex,
        purchaseIndex,
        sellIndex,
        homeSeries,
      } = homeData;
      const assetValue =
        sellIndex !== null && i > sellIndex ? 0 : (homeSeries[i] ?? 0);
      assetsHousing[i] += assetValue;
      addAsset(`home:${homeId}`, i, assetValue);

      if (mode === "new_purchase" && i === purchaseIndex) {
        const downPayment = home.downPayment ?? 0;
        if (downPayment) {
          netCashflow[i] -= downPayment;
          addCashflow(`home:${homeId}:down_payment`, i, -downPayment);
        }
        if (home.feesOneTime) {
          netCashflow[i] -= home.feesOneTime;
          addCashflow(`home:${homeId}:fees_one_time`, i, -home.feesOneTime);
        }
      }

      const holdingCostMonthly = home.holdingCostMonthly ?? 0;
      const holdingCostAnnualGrowth = home.holdingCostAnnualGrowth ?? 0;
      if (holdingCostMonthly > 0) {
        const holdingStartIndex = Math.max(0, startIndex);
        if (i >= holdingStartIndex && (sellIndex === null || i < sellIndex)) {
          const monthsSincePurchase = i - startIndex;
          const cost =
            holdingCostMonthly *
            Math.pow(1 + holdingCostAnnualGrowth, monthsSincePurchase / 12);
          netCashflow[i] -= cost;
          addCashflow(`home:${homeId}:holding_cost`, i, -cost);
        }
      }

      if (homeData.mortgageSchedule) {
        if (sellIndex !== null && i >= sellIndex) {
          addLiability(`home:${homeId}:mortgage`, i, 0);
        } else {
        const schedule = homeData.mortgageSchedule;
        const interest = schedule.interestSeries[i] ?? 0;
        const principal = schedule.principalSeries[i] ?? 0;
        const payment = interest + principal;
        if (payment !== 0) {
          netCashflow[i] -= payment;
        }
        if (interest) {
          addCashflow(`home:${homeId}:mortgage_interest`, i, -interest);
        }
        if (principal) {
          addCashflow(`home:${homeId}:mortgage_principal`, i, -principal);
        }
        const balance = schedule.balanceSeries[i] ?? 0;
        liabilitiesMortgage[i] += balance;
        addLiability(`home:${homeId}:mortgage`, i, balance);
        }
      }

      if (home.rental && home.rental.rentMonthly > 0) {
        const rentStartIndex = monthIndex(input.baseMonth, home.rental.rentStartMonth);
        const rentEndIndex = home.rental.rentEndMonth
          ? monthIndex(input.baseMonth, home.rental.rentEndMonth)
          : horizonMonths - 1;
        if (
          i >= rentStartIndex &&
          i <= rentEndIndex &&
          (sellIndex === null || i < sellIndex)
        ) {
          const yearsSinceStart = Math.floor((i - rentStartIndex) / 12);
          const rentAnnualGrowth = home.rental.rentAnnualGrowth ?? 0;
          const vacancyRate = home.rental.vacancyRate ?? 0;
          const multiplier = Math.pow(1 + rentAnnualGrowth, yearsSinceStart);
          const income = home.rental.rentMonthly * multiplier * (1 - vacancyRate);
          netCashflow[i] += income;
          addCashflow(`home:${homeId}:rental_income`, i, income);
        }
      }
    }

    for (const loanState of loanStates) {
      const { loan, loanId } = loanState;
      if (i < loanState.startIndex) {
        continue;
      }
      if (loanState.outstanding <= 0 || loanState.monthsElapsed >= loan.termMonths) {
        continue;
      }

      if (i === loanState.startIndex && loan.feesOneTime) {
        netCashflow[i] -= loan.feesOneTime;
        addCashflow(`loan:${loanId}:fees_one_time`, i, -loan.feesOneTime);
      }

      const { interest, nextOutstanding } = applyAmortizationMonth(
        loanState.outstanding,
        loanState.monthlyRate,
        loanState.payment
      );
      const payment = loanState.payment;
      const interestPaid = Math.min(payment, interest);
      const principalPaid = Math.max(0, payment - interestPaid);

      if (payment !== 0) {
        netCashflow[i] -= payment;
      }
      if (interestPaid) {
        addCashflow(`loan:${loanId}:interest`, i, -interestPaid);
      }
      if (principalPaid) {
        addCashflow(`loan:${loanId}:principal`, i, -principalPaid);
      }

      loanState.outstanding = nextOutstanding;
      loanState.monthsElapsed += 1;
      liabilitiesLoans[i] += loanState.outstanding;
      addLiability(`loan:${loanId}`, i, loanState.outstanding);
    }

    for (const carState of carStates) {
      const { car, carId, startIndex, sellIndex } = carState;
      if (i < startIndex) {
        continue;
      }
      const isSold = sellIndex !== null && i >= sellIndex;

      if (i === startIndex && car.downPayment) {
        netCashflow[i] -= car.downPayment;
        addCashflow(`car:${carId}:down_payment`, i, -car.downPayment);
      }

      if (!isSold) {
        carState.currentValue *= carState.monthlyDepreciation;
        assetsCars[i] += carState.currentValue;
        addAsset(`car:${carId}`, i, carState.currentValue);
      } else {
        addAsset(`car:${carId}`, i, 0);
      }

      if (carState.holdingCostMonthly > 0 && !isSold) {
        const monthsSincePurchase = i - startIndex;
        const cost =
          carState.holdingCostMonthly *
          Math.pow(1 + carState.holdingCostAnnualGrowth, monthsSincePurchase / 12);
        netCashflow[i] -= cost;
        addCashflow(`car:${carId}:holding_cost`, i, -cost);
      }

      if (
        carState.loanState &&
        carState.loanState.outstanding > 0 &&
        carState.loanState.monthsElapsed < carState.loanState.termMonths &&
        !isSold
      ) {
        const { interest, nextOutstanding } = applyAmortizationMonth(
          carState.loanState.outstanding,
          carState.loanState.monthlyRate,
          carState.loanState.payment
        );
        const payment = carState.loanState.payment;
        const interestPaid = Math.min(payment, interest);
        const principalPaid = Math.max(0, payment - interestPaid);

        if (payment !== 0) {
          netCashflow[i] -= payment;
        }
        if (interestPaid) {
          addCashflow(`car:${carId}:loan_interest`, i, -interestPaid);
        }
        if (principalPaid) {
          addCashflow(`car:${carId}:loan_principal`, i, -principalPaid);
        }

        carState.loanState.outstanding = nextOutstanding;
        carState.loanState.monthsElapsed += 1;
        liabilitiesAuto[i] += carState.loanState.outstanding;
        addLiability(`car:${carId}:loan`, i, carState.loanState.outstanding);
      } else if (carState.loanState && isSold) {
        addLiability(`car:${carId}:loan`, i, 0);
      }
    }

    for (const investment of investmentStates) {
      const {
        investmentId,
        startIndex,
        monthlyContribution,
        monthlyWithdrawal,
        contributionByIndex,
        withdrawalByIndex,
        hasContributionSchedule,
        hasWithdrawalSchedule,
        monthlyFactor,
      } = investment;
      if (i < startIndex) {
        continue;
      }
      const contribution = hasContributionSchedule
        ? contributionByIndex.get(i) ?? 0
        : monthlyContribution;
      const withdrawalTarget = hasWithdrawalSchedule
        ? withdrawalByIndex.get(i) ?? 0
        : monthlyWithdrawal;
      const withdrawal = Math.min(investment.currentValue, withdrawalTarget);
      investment.currentValue =
        investment.currentValue + contribution - withdrawal;
      if (contribution) {
        netCashflow[i] -= contribution;
        addCashflow(
          `investment:${investmentId}:contribution`,
          i,
          -contribution
        );
      }
      if (withdrawal) {
        netCashflow[i] += withdrawal;
        addCashflow(`investment:${investmentId}:withdrawal`, i, withdrawal);
      }
      investment.currentValue *= monthlyFactor;
      assetsInvestments[i] += investment.currentValue;
      addAsset(`investment:${investmentId}`, i, investment.currentValue);
    }

    for (const insurance of insuranceStates) {
      const {
        insuranceId,
        premiumMonthly,
        monthlyPremiumGrowth,
        monthlyReturn,
        startIndex,
        endIndex,
        kind,
      } = insurance;

      if (i < startIndex) {
        continue;
      }

      const monthsSinceStart = i - startIndex;
      const isPremiumActive = i <= endIndex;
      const premium = isPremiumActive
        ? premiumMonthly * Math.pow(1 + monthlyPremiumGrowth, monthsSinceStart)
        : 0;

      if (premium) {
        netCashflow[i] -= premium;
        addCashflow(`insurance:${insuranceId}:premium`, i, -premium);
      }

      if (kind === "savings") {
        insurance.currentValue = (insurance.currentValue + premium) * (1 + monthlyReturn);
      } else {
        insurance.currentValue = 0;
      }

      assetsInsurance[i] += insurance.currentValue;
      addAsset(`insurance:${insuranceId}`, i, insurance.currentValue);
    }
  }

  const cashBalance: number[] = [];
  for (let i = 0; i < horizonMonths; i += 1) {
    const prior = i === 0 ? initialCash : cashBalance[i - 1];
    const cashYield = prior > 0 && cashMonthlyYieldRate > 0 ? prior * cashMonthlyYieldRate : 0;
    if (cashYield !== 0) {
      netCashflow[i] += cashYield;
      addCashflow("cash:yield", i, cashYield);
    }
    cashBalance[i] = prior + netCashflow[i];
    addAsset("cash", i, cashBalance[i]);
  }

  const assetsTotal = assetsHousing.map(
    (value, index) =>
      value + assetsCars[index] + assetsInvestments[index] + assetsInsurance[index]
  );
  const liabilitiesTotal = liabilitiesMortgage.map(
    (value, index) => value + liabilitiesLoans[index] + liabilitiesAuto[index]
  );
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
      cars: assetsCars,
      investments: assetsInvestments,
      insurance: assetsInsurance,
      total: assetsTotal,
    },
    liabilities: {
      mortgage: liabilitiesMortgage,
      loans: liabilitiesLoans,
      auto: liabilitiesAuto,
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
