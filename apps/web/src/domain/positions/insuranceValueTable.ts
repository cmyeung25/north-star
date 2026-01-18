import type { InsurancePosition } from "../../store/scenarioStore";
import { addMonths } from "../members/age";
import { monthIndex } from "@north-star/engine";
import type { ValueTableRow } from "./investmentValueTable";

export const buildInsuranceValueTable = (params: {
  insurance: InsurancePosition;
  baseMonth: string;
  horizonMonths: number;
}): ValueTableRow[] => {
  const { insurance, baseMonth, horizonMonths } = params;
  if (horizonMonths <= 0) {
    return [];
  }

  if (!insurance.enabled) {
    return [];
  }

  if (insurance.kind !== "savings") {
    return [];
  }

  const startMonth = insurance.startMonth ?? baseMonth;
  if (!startMonth) {
    return [];
  }

  const annualReturnPct = insurance.expectedAnnualReturnPct ?? 0;
  const monthlyReturn =
    annualReturnPct === 0 ? 0 : Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  const annualPremiumGrowth = insurance.premiumAnnualGrowthPct ?? 0;
  const monthlyPremiumGrowth =
    annualPremiumGrowth === 0
      ? 0
      : Math.pow(1 + annualPremiumGrowth / 100, 1 / 12) - 1;
  const basePremium = insurance.premiumMonthly ?? 0;
  const endIndex = insurance.endMonth
    ? monthIndex(startMonth, insurance.endMonth)
    : null;

  let currentValue = insurance.initialCashValue ?? 0;
  let totalContributed = 0;

  return Array.from({ length: horizonMonths }, (_, index) => {
    const month = addMonths(startMonth, index);
    const premiumActive = endIndex === null || index <= endIndex;
    const contribution = premiumActive
      ? basePremium * Math.pow(1 + monthlyPremiumGrowth, index)
      : 0;
    const valueNext = (currentValue + contribution) * (1 + monthlyReturn);
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
