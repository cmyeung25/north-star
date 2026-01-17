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
      homeSeries,
      mortgageSchedule,
    };
  });

  const investments = input.positions?.investments ?? [];
  const investmentStates = investments.map((investment, investmentIndex) => {
    const monthlyContribution = investment.monthlyContribution ?? 0;
    const monthlyWithdrawal = investment.monthlyWithdrawal ?? 0;
    const growthFactor = Math.pow(1 + investment.annualReturnRate, 1 / 12);
    const feeFactor =
      typeof investment.feeAnnualRate === "number"
        ? Math.pow(1 - investment.feeAnnualRate, 1 / 12)
        : 1;
    const monthlyFactor = growthFactor * feeFactor;
    const startIndex = monthIndex(input.baseMonth, investment.startMonth);
    const investmentId = investment.id ?? `investment-${investmentIndex + 1}`;
    let currentValue = investment.initialValue ?? 0;

    if (startIndex < 0 && horizonMonths > 0) {
      for (let i = 0; i < -startIndex; i += 1) {
        const withdrawal = Math.min(currentValue, monthlyWithdrawal);
        currentValue = currentValue + monthlyContribution - withdrawal;
        currentValue *= monthlyFactor;
      }
    }

    return {
      investment,
      investmentId,
      startIndex,
      monthlyContribution,
      monthlyWithdrawal,
      monthlyFactor,
      currentValue,
    };
  });

  const insurances = input.positions?.insurances ?? [];
  const insuranceStates = insurances.map((insurance, insuranceIndex) => {
    const premiumMonthly = insurance.premiumMonthly ?? 0;
    const cashValue = insurance.hasCashValue ? insurance.cashValue ?? 0 : 0;
    const annualGrowth = insurance.cashValueAnnualGrowth ?? 0;
    const monthlyGrowth = Math.pow(1 + annualGrowth, 1 / 12) - 1;
    const insuranceId = insurance.id ?? `insurance-${insuranceIndex + 1}`;
    return {
      insuranceId,
      hasCashValue: Boolean(insurance.hasCashValue),
      premiumMonthly,
      currentValue: cashValue,
      monthlyGrowth,
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
    const monthlyDepreciation = Math.pow(1 + car.annualDepreciationRate, 1 / 12);
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
      const { home, homeId, mode, startIndex, purchaseIndex, homeSeries } = homeData;
      const assetValue = homeSeries[i] ?? 0;
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
        if (i >= holdingStartIndex) {
          const monthsSincePurchase = i - startIndex;
          const cost =
            holdingCostMonthly *
            Math.pow(1 + holdingCostAnnualGrowth, monthsSincePurchase / 12);
          netCashflow[i] -= cost;
          addCashflow(`home:${homeId}:holding_cost`, i, -cost);
        }
      }

      if (homeData.mortgageSchedule) {
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

      if (home.rental && home.rental.rentMonthly > 0) {
        const rentStartIndex = monthIndex(input.baseMonth, home.rental.rentStartMonth);
        const rentEndIndex = home.rental.rentEndMonth
          ? monthIndex(input.baseMonth, home.rental.rentEndMonth)
          : horizonMonths - 1;
        if (i >= rentStartIndex && i <= rentEndIndex) {
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
      const { car, carId, startIndex } = carState;
      if (i < startIndex) {
        continue;
      }

      if (i === startIndex && car.downPayment) {
        netCashflow[i] -= car.downPayment;
        addCashflow(`car:${carId}:down_payment`, i, -car.downPayment);
      }

      carState.currentValue *= carState.monthlyDepreciation;
      assetsCars[i] += carState.currentValue;
      addAsset(`car:${carId}`, i, carState.currentValue);

      if (carState.holdingCostMonthly > 0) {
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
        carState.loanState.monthsElapsed < carState.loanState.termMonths
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
      }
    }

    for (const investment of investmentStates) {
      const {
        investmentId,
        startIndex,
        monthlyContribution,
        monthlyWithdrawal,
        monthlyFactor,
      } = investment;
      if (i < startIndex) {
        continue;
      }
      const withdrawal = Math.min(investment.currentValue, monthlyWithdrawal);
      investment.currentValue =
        investment.currentValue + monthlyContribution - withdrawal;
      if (monthlyContribution) {
        netCashflow[i] -= monthlyContribution;
        addCashflow(
          `investment:${investmentId}:contribution`,
          i,
          -monthlyContribution
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
      const { insuranceId, premiumMonthly, monthlyGrowth } = insurance;
      netCashflow[i] -= premiumMonthly;
      if (premiumMonthly) {
        addCashflow(`insurance:${insuranceId}:premium`, i, -premiumMonthly);
      }

      if (insurance.hasCashValue) {
        if (i !== 0) {
          insurance.currentValue = insurance.currentValue * (1 + monthlyGrowth);
        }
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
