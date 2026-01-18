import { monthIndex } from "@north-star/engine";
import type {
  CarPosition,
  HomePosition,
  InvestmentPosition,
  LoanPosition,
} from "../../store/scenarioStore";
import { addMonths } from "../members/age";
import { computeMonthlyPayment } from "./calculations";

export type PositionCashflowEntry = {
  month: string;
  amount: number;
  label: string;
  sourceId: string;
};

export type PositionCashflowBreakdown = {
  entries: PositionCashflowEntry[];
  series: Array<{ month: string; amount: number }>;
};

const toMonthlyFactor = (annualGrowthDecimal: number) =>
  Math.pow(1 + annualGrowthDecimal, 1 / 12);

const clampEntriesToHorizon = (
  entries: PositionCashflowEntry[],
  baseMonth: string | null | undefined,
  horizonMonths: number
) => {
  if (!baseMonth || horizonMonths <= 0) {
    return entries;
  }
  return entries.filter((entry) => {
    const offset = monthIndex(baseMonth, entry.month);
    return offset >= 0 && offset < horizonMonths;
  });
};

const buildSeries = (entries: PositionCashflowEntry[]) => {
  const totals = new Map<string, number>();
  entries.forEach((entry) => {
    totals.set(entry.month, (totals.get(entry.month) ?? 0) + entry.amount);
  });

  return Array.from(totals.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, amount]) => ({ month, amount }));
};

const buildMonthlyEntries = (params: {
  startMonth: string;
  months: number;
  amount: number;
  annualGrowthDecimal?: number;
  label: string;
  sourceId: string;
}): PositionCashflowEntry[] => {
  const {
    startMonth,
    months,
    amount,
    annualGrowthDecimal = 0,
    label,
    sourceId,
  } = params;
  if (!months || amount === 0) {
    return [];
  }
  const factor = toMonthlyFactor(annualGrowthDecimal);

  return Array.from({ length: months }, (_, index) => ({
    month: addMonths(startMonth, index),
    amount: amount * Math.pow(factor, index),
    label,
    sourceId,
  }));
};

export const buildHomeCashflowBreakdown = (params: {
  home: HomePosition;
  baseMonth?: string | null;
  horizonMonths: number;
}): PositionCashflowBreakdown => {
  const { home, baseMonth, horizonMonths } = params;
  const mode = home.mode ?? "new_purchase";
  const entries: PositionCashflowEntry[] = [];

  if (mode === "existing" && home.existing) {
    const startMonth = home.existing.asOfMonth;
    const termMonths = home.existing.remainingTermMonths;
    const principal = home.existing.mortgageBalance;
    const annualRateDecimal = (home.existing.annualRatePct ?? 0) / 100;
    const payment = computeMonthlyPayment(principal, annualRateDecimal, termMonths);

    entries.push(
      ...buildMonthlyEntries({
        startMonth,
        months: termMonths,
        amount: -payment,
        label: "mortgagePayment",
        sourceId: "home:mortgage",
      })
    );
  }

  if (mode !== "existing") {
    const purchaseMonth = home.purchaseMonth ?? baseMonth ?? "";
    const purchasePrice = home.purchasePrice ?? 0;
    const downPayment = home.downPayment ?? 0;
    const principal = purchasePrice - downPayment;
    const termMonths = Math.max(0, Math.round((home.mortgageTermYears ?? 0) * 12));
    const annualRateDecimal = (home.mortgageRatePct ?? 0) / 100;
    const payment = computeMonthlyPayment(principal, annualRateDecimal, termMonths);

    if (purchaseMonth) {
      if (downPayment > 0) {
        entries.push({
          month: purchaseMonth,
          amount: -downPayment,
          label: "downPayment",
          sourceId: "home:downPayment",
        });
      }

      if ((home.feesOneTime ?? 0) > 0) {
        entries.push({
          month: purchaseMonth,
          amount: -(home.feesOneTime ?? 0),
          label: "feesOneTime",
          sourceId: "home:feesOneTime",
        });
      }

      entries.push(
        ...buildMonthlyEntries({
          startMonth: purchaseMonth,
          months: termMonths,
          amount: -payment,
          label: "mortgagePayment",
          sourceId: "home:mortgage",
        })
      );
    }
  }

  if ((home.holdingCostMonthly ?? 0) > 0) {
    const holdingStart =
      (mode === "existing" ? home.existing?.asOfMonth : home.purchaseMonth) ??
      baseMonth ??
      "";
    if (holdingStart) {
      entries.push(
        ...buildMonthlyEntries({
          startMonth: holdingStart,
          months: horizonMonths,
          amount: -(home.holdingCostMonthly ?? 0),
          annualGrowthDecimal: (home.holdingCostAnnualGrowthPct ?? 0) / 100,
          label: "holdingCost",
          sourceId: "home:holding",
        })
      );
    }
  }

  const filtered = clampEntriesToHorizon(entries, baseMonth, horizonMonths);
  return { entries: filtered, series: buildSeries(filtered) };
};

export const buildCarCashflowBreakdown = (params: {
  car: CarPosition;
  baseMonth?: string | null;
  horizonMonths: number;
}): PositionCashflowBreakdown => {
  const { car, baseMonth, horizonMonths } = params;
  const entries: PositionCashflowEntry[] = [];
  const purchaseMonth = car.purchaseMonth ?? baseMonth ?? "";

  if (purchaseMonth) {
    if ((car.downPayment ?? 0) > 0) {
      entries.push({
        month: purchaseMonth,
        amount: -(car.downPayment ?? 0),
        label: "downPayment",
        sourceId: "car:downPayment",
      });
    }

    if (car.loan) {
      const termMonths = Math.max(0, Math.round((car.loan.termYears ?? 0) * 12));
      const annualRateDecimal = (car.loan.annualInterestRatePct ?? 0) / 100;
      const payment =
        car.loan.monthlyPayment ??
        computeMonthlyPayment(car.loan.principal, annualRateDecimal, termMonths);

      entries.push(
        ...buildMonthlyEntries({
          startMonth: purchaseMonth,
          months: termMonths,
          amount: -payment,
          label: "loanPayment",
          sourceId: "car:loan",
        })
      );
    }
  }

  if ((car.holdingCostMonthly ?? 0) > 0 && purchaseMonth) {
    entries.push(
      ...buildMonthlyEntries({
        startMonth: purchaseMonth,
        months: horizonMonths,
        amount: -(car.holdingCostMonthly ?? 0),
        annualGrowthDecimal: (car.holdingCostAnnualGrowthPct ?? 0) / 100,
        label: "holdingCost",
        sourceId: "car:holding",
      })
    );
  }

  const filtered = clampEntriesToHorizon(entries, baseMonth, horizonMonths);
  return { entries: filtered, series: buildSeries(filtered) };
};

export const buildLoanCashflowBreakdown = (params: {
  loan: LoanPosition;
  baseMonth?: string | null;
  horizonMonths: number;
}): PositionCashflowBreakdown => {
  const { loan, baseMonth, horizonMonths } = params;
  const entries: PositionCashflowEntry[] = [];
  const startMonth = loan.startMonth ?? baseMonth ?? "";
  const termMonths = Math.max(0, Math.round((loan.termYears ?? 0) * 12));
  const annualRateDecimal = (loan.annualInterestRatePct ?? 0) / 100;
  const payment =
    loan.monthlyPayment ??
    computeMonthlyPayment(loan.principal, annualRateDecimal, termMonths);

  if (startMonth) {
    if ((loan.feesOneTime ?? 0) > 0) {
      entries.push({
        month: startMonth,
        amount: -(loan.feesOneTime ?? 0),
        label: "feesOneTime",
        sourceId: "loan:feesOneTime",
      });
    }

    entries.push(
      ...buildMonthlyEntries({
        startMonth,
        months: termMonths,
        amount: -payment,
        label: "loanPayment",
        sourceId: "loan:repayment",
      })
    );
  }

  const filtered = clampEntriesToHorizon(entries, baseMonth, horizonMonths);
  return { entries: filtered, series: buildSeries(filtered) };
};

export const buildInvestmentCashflowBreakdown = (params: {
  investment: InvestmentPosition;
  baseMonth?: string | null;
  horizonMonths: number;
}): PositionCashflowBreakdown => {
  const { investment, baseMonth, horizonMonths } = params;
  const entries: PositionCashflowEntry[] = [];
  const startMonth = investment.startMonth ?? baseMonth ?? "";

  if (startMonth && (investment.monthlyContribution ?? 0) !== 0) {
    entries.push(
      ...buildMonthlyEntries({
        startMonth,
        months: horizonMonths,
        amount: -(investment.monthlyContribution ?? 0),
        label: "contribution",
        sourceId: "investment:contribution",
      })
    );
  }

  const filtered = clampEntriesToHorizon(entries, baseMonth, horizonMonths);
  return { entries: filtered, series: buildSeries(filtered) };
};
