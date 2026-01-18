import type { InvestmentPosition } from "../../store/scenarioStore";
import { addMonths } from "../members/age";

export type ValueTableRow = {
  month: string;
  contribution: number;
  growth: number;
  endValue: number;
  totalContributed: number;
};

export const buildInvestmentValueTable = (params: {
  investment: InvestmentPosition;
  baseMonth: string;
  horizonMonths: number;
}): ValueTableRow[] => {
  const { investment, baseMonth, horizonMonths } = params;
  if (horizonMonths <= 0) {
    return [];
  }

  const startMonth = investment.startMonth ?? baseMonth;
  if (!startMonth) {
    return [];
  }

  const annualReturnPct = investment.expectedAnnualReturnPct ?? 0;
  const monthlyRate =
    annualReturnPct === 0 ? 0 : Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  const monthlyContribution = investment.monthlyContribution ?? 0;

  let currentValue = investment.initialValue ?? 0;
  let totalContributed = 0;

  return Array.from({ length: horizonMonths }, (_, index) => {
    const month = addMonths(startMonth, index);
    const contribution = monthlyContribution;
    const valueNext = (currentValue + contribution) * (1 + monthlyRate);
    const growth = valueNext - currentValue - contribution;
    totalContributed += contribution;
    currentValue = valueNext;

    return {
      month,
      contribution,
      growth,
      endValue: valueNext,
      totalContributed,
    };
  });
};
