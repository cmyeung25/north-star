import { addMonths } from "../members/age";

export type AmortizationRow = {
  month: string;
  openingBalance: number;
  payment: number;
  interest: number;
  principal: number;
  closingBalance: number;
};

export type ValueRow = {
  month: string;
  value: number;
  delta: number;
};

export type ContributionRow = {
  month: string;
  contribution: number;
  cumulative: number;
};

export const computeMonthlyPayment = (
  principal: number,
  annualRateDecimal: number,
  termMonths: number
) => {
  if (principal <= 0 || termMonths <= 0) {
    return 0;
  }
  const monthlyRate = annualRateDecimal / 12;
  if (monthlyRate === 0) {
    return principal / termMonths;
  }
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
};

export const calcAmortizedPaymentMonthly = (
  principal: number,
  annualRatePct: number,
  termMonths: number
): number | null => {
  if (!Number.isFinite(principal) || principal <= 0) {
    return null;
  }
  if (!Number.isFinite(annualRatePct) || annualRatePct < 0) {
    return null;
  }
  if (!Number.isFinite(termMonths) || termMonths <= 0) {
    return null;
  }
  const payment = computeMonthlyPayment(principal, annualRatePct / 100, termMonths);
  return Number.isFinite(payment) && payment > 0 ? payment : null;
};

export const buildAmortizationSchedule = (params: {
  principal: number;
  annualRateDecimal: number;
  termMonths: number;
  startMonth: string;
}): AmortizationRow[] => {
  const { principal, annualRateDecimal, termMonths, startMonth } = params;
  if (principal <= 0 || termMonths <= 0) {
    return [];
  }

  const payment = computeMonthlyPayment(principal, annualRateDecimal, termMonths);
  const monthlyRate = annualRateDecimal / 12;
  let balance = principal;

  return Array.from({ length: termMonths }, (_, index) => {
    const interest = balance * monthlyRate;
    const principalPayment = Math.min(balance, payment - interest);
    const closingBalance = Math.max(0, balance - principalPayment);
    const row: AmortizationRow = {
      month: addMonths(startMonth, index),
      openingBalance: balance,
      payment,
      interest,
      principal: principalPayment,
      closingBalance,
    };
    balance = closingBalance;
    return row;
  });
};

export const buildValueSchedule = (params: {
  baseValue: number;
  annualAppreciationDecimal: number;
  startMonth: string;
  months: number;
}): ValueRow[] => {
  const { baseValue, annualAppreciationDecimal, startMonth, months } = params;
  if (months <= 0) {
    return [];
  }
  const monthlyFactor = Math.pow(1 + annualAppreciationDecimal, 1 / 12);

  return Array.from({ length: months }, (_, index) => {
    const value = baseValue * Math.pow(monthlyFactor, index);
    return {
      month: addMonths(startMonth, index),
      value,
      delta: value - baseValue,
    };
  });
};

export const buildContributionSchedule = (params: {
  startMonth: string;
  monthlyContribution: number;
  months: number;
  annualGrowthDecimal?: number;
}): ContributionRow[] => {
  const {
    startMonth,
    monthlyContribution,
    months,
    annualGrowthDecimal = 0,
  } = params;
  if (months <= 0 || monthlyContribution === 0) {
    return [];
  }

  const monthlyFactor = Math.pow(1 + annualGrowthDecimal, 1 / 12);
  let cumulative = 0;

  return Array.from({ length: months }, (_, index) => {
    const amount = monthlyContribution * Math.pow(monthlyFactor, index);
    cumulative += amount;
    return {
      month: addMonths(startMonth, index),
      contribution: amount,
      cumulative,
    };
  });
};
