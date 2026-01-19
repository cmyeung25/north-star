import { monthIndex } from "@north-star/engine";
import type { CarPosition, HomePosition, Scenario } from "../../store/scenarioStore";
import { buildAmortizationSchedule } from "./calculations";
import { isValidMonthStr } from "../../utils/month";

export type SellCashflowEntry = {
  month: string;
  amount: number;
  label: "sellProceeds" | "sellFees" | "sellLoanPayoff";
  sourceId: string;
  positionId: string;
  positionType: "home" | "car";
};

const computeValueAtMonth = (
  baseValue: number,
  annualRateDecimal: number,
  startMonth: string,
  targetMonth: string
) => {
  if (baseValue <= 0) {
    return 0;
  }
  const offset = monthIndex(startMonth, targetMonth);
  const monthlyFactor =
    annualRateDecimal === 0 ? 1 : Math.pow(1 + annualRateDecimal, 1 / 12);
  return baseValue * Math.pow(monthlyFactor, offset);
};

const computeOutstandingBalance = (params: {
  principal: number;
  annualRateDecimal: number;
  termMonths: number;
  startMonth: string;
  targetMonth: string;
}) => {
  const { principal, annualRateDecimal, termMonths, startMonth, targetMonth } = params;
  if (principal <= 0 || termMonths <= 0) {
    return 0;
  }
  const offset = monthIndex(startMonth, targetMonth);
  if (offset < 0) {
    return principal;
  }
  const schedule = buildAmortizationSchedule({
    principal,
    annualRateDecimal,
    termMonths,
    startMonth,
  });
  const row = schedule[offset];
  return row ? row.closingBalance : 0;
};

const buildHomeSellEntries = (home: HomePosition, homeId: string) => {
  const sellMonth = home.sellMonth;
  if (!sellMonth || !isValidMonthStr(sellMonth)) {
    return [];
  }
  const mode = home.mode ?? "new_purchase";
  const startMonth =
    mode === "existing" && home.existing
      ? home.existing.asOfMonth
      : home.purchaseMonth;
  if (!startMonth || !isValidMonthStr(startMonth)) {
    return [];
  }

  const baseValue =
    mode === "existing" && home.existing
      ? home.existing.marketValue
      : home.purchasePrice ?? 0;
  const valueAtSellMonth = computeValueAtMonth(
    baseValue,
    (home.annualAppreciationPct ?? 0) / 100,
    startMonth,
    sellMonth
  );
  const proceeds = home.sellPriceOverride ?? valueAtSellMonth;
  const entries: SellCashflowEntry[] = [];

  if (proceeds > 0) {
    entries.push({
      month: sellMonth,
      amount: proceeds,
      label: "sellProceeds",
      sourceId: `sell:${homeId}:proceeds`,
      positionId: homeId,
      positionType: "home",
    });
  }

  if ((home.sellFeesOneTime ?? 0) > 0) {
    entries.push({
      month: sellMonth,
      amount: -(home.sellFeesOneTime ?? 0),
      label: "sellFees",
      sourceId: `sell:${homeId}:fees`,
      positionId: homeId,
      positionType: "home",
    });
  }

  const mortgage =
    mode === "existing" && home.existing
      ? {
          principal: home.existing.mortgageBalance,
          annualRateDecimal: (home.existing.annualRatePct ?? 0) / 100,
          termMonths: home.existing.remainingTermMonths,
          startMonth: home.existing.asOfMonth,
        }
      : home.mortgageRatePct && home.mortgageTermYears && home.purchasePrice
        ? {
            principal:
              (home.purchasePrice ?? 0) - (home.downPayment ?? 0),
            annualRateDecimal: (home.mortgageRatePct ?? 0) / 100,
            termMonths: Math.round((home.mortgageTermYears ?? 0) * 12),
            startMonth: home.purchaseMonth ?? startMonth,
          }
        : null;

  if (mortgage && mortgage.principal > 0 && mortgage.termMonths > 0) {
    const payoff = computeOutstandingBalance({
      principal: mortgage.principal,
      annualRateDecimal: mortgage.annualRateDecimal,
      termMonths: mortgage.termMonths,
      startMonth: mortgage.startMonth,
      targetMonth: sellMonth,
    });
    if (payoff > 0) {
      entries.push({
        month: sellMonth,
        amount: -payoff,
        label: "sellLoanPayoff",
        sourceId: `sell:${homeId}:loanPayoff`,
        positionId: homeId,
        positionType: "home",
      });
    }
  }

  return entries;
};

const buildCarSellEntries = (car: CarPosition, carId: string) => {
  const sellMonth = car.sellMonth;
  if (!sellMonth || !isValidMonthStr(sellMonth)) {
    return [];
  }
  if (!car.purchaseMonth || !isValidMonthStr(car.purchaseMonth)) {
    return [];
  }
  const valueAtSellMonth = computeValueAtMonth(
    car.purchasePrice ?? 0,
    (car.annualDepreciationRatePct ?? 0) / 100,
    car.purchaseMonth,
    sellMonth
  );
  const proceeds = car.sellPriceOverride ?? valueAtSellMonth;
  const entries: SellCashflowEntry[] = [];

  if (proceeds > 0) {
    entries.push({
      month: sellMonth,
      amount: proceeds,
      label: "sellProceeds",
      sourceId: `sell:${carId}:proceeds`,
      positionId: carId,
      positionType: "car",
    });
  }

  if ((car.sellFeesOneTime ?? 0) > 0) {
    entries.push({
      month: sellMonth,
      amount: -(car.sellFeesOneTime ?? 0),
      label: "sellFees",
      sourceId: `sell:${carId}:fees`,
      positionId: carId,
      positionType: "car",
    });
  }

  if (car.loan && car.loan.principal > 0 && car.loan.termYears > 0) {
    const payoff = computeOutstandingBalance({
      principal: car.loan.principal,
      annualRateDecimal: (car.loan.annualInterestRatePct ?? 0) / 100,
      termMonths: Math.round((car.loan.termYears ?? 0) * 12),
      startMonth: car.purchaseMonth,
      targetMonth: sellMonth,
    });
    if (payoff > 0) {
      entries.push({
        month: sellMonth,
        amount: -payoff,
        label: "sellLoanPayoff",
        sourceId: `sell:${carId}:loanPayoff`,
        positionId: carId,
        positionType: "car",
      });
    }
  }

  return entries;
};

export const compileSellLifecycle = (scenario: Scenario): SellCashflowEntry[] => {
  const entries: SellCashflowEntry[] = [];
  const homes = scenario.positions?.homes ?? (scenario.positions?.home ? [scenario.positions.home] : []);
  homes.forEach((home, index) => {
    const homeId = (home as { id?: string }).id ?? `home-${index + 1}`;
    entries.push(...buildHomeSellEntries(home, homeId));
  });

  scenario.positions?.cars?.forEach((car, index) => {
    const carId = car.id ?? `car-${index + 1}`;
    entries.push(...buildCarSellEntries(car, carId));
  });

  return entries;
};
