// Shape note: Engine HomePosition originally accepted feesOneTime only for extra home costs.
// Added fields mapped here: holdingCostMonthly (number) and holdingCostAnnualGrowth (decimal).
// Back-compat: missing holding cost fields map to 0 in the engine input.
import {
  type ProjectionInput,
  type ProjectionResult,
  monthIndex,
} from "@north-star/engine";
import type {
  CarPosition,
  CashBucketPosition,
  HomePosition,
  InsurancePosition,
  InvestmentPosition,
  LoanPosition,
  Scenario,
} from "../store/scenarioStore";
import { HomePositionSchema } from "../store/scenarioValidation";
import type { OverviewKpis, TimeSeriesPoint } from "../../features/overview/types";
import { getEventSign } from "../events/eventCatalog";
import type { EventDefinition } from "../domain/events/types";
import { compileScenarioCashflows } from "../domain/events/compiler";
import { buildScenarioTimelineEvents, resolveEventRule } from "../domain/events/utils";
import type { TimelineEvent } from "../features/timeline/schema";
import { compileAllBudgetRules } from "../domain/budget/compileBudgetRules";
import type { CashflowItem } from "../domain/ledger/types";
import { isValidMonthStr } from "../utils/month";

type AdapterOptions = {
  baseMonth?: string;
  horizonMonths?: number;
  initialCash?: number;
  strict?: boolean;
  eventsOverride?: TimelineEvent[];
};

export type AdapterWarning = {
  code: "invalid-month" | "double-count";
  message: string;
  meta?: Record<string, unknown>;
};

export type ScenarioEngineAdapterResult = {
  input: ProjectionInput;
  warnings: AdapterWarning[];
};

type HomePositionWithId = HomePosition & { id?: string };

const formatMonth = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
};

const getEarliestStartMonth = (events: TimelineEvent[]) =>
  events.reduce<string | null>((earliest, event) => {
    if (!event.enabled) {
      return earliest;
    }
    if (!isValidMonth(event.startMonth)) {
      return earliest;
    }
    if (!earliest || event.startMonth < earliest) {
      return event.startMonth;
    }
    return earliest;
  }, null);

const isValidMonth = (value: string) => isValidMonthStr(value);

const getEarliestBuyHomeEvent = (events: TimelineEvent[]) =>
  events.reduce<TimelineEvent | null>((earliest, event) => {
    if (!event.enabled || event.type !== "buy_home") {
      return earliest;
    }
    if (!isValidMonth(event.startMonth)) {
      return earliest;
    }
    if (!earliest || event.startMonth < earliest.startMonth) {
      return event;
    }
    return earliest;
  }, null);

const checkBuyHomeEventMonth = (event: TimelineEvent) =>
  isValidMonth(event.startMonth);

const buildEngineEventsFromCashflows = (
  cashflows: CashflowItem[],
  warnings: AdapterWarning[]
): ProjectionInput["events"] =>
  cashflows
    .filter((entry) => entry.amount !== 0)
    .filter(
      (entry) => entry.category !== "buy_home" && entry.category !== "insurance_product"
    )
    .filter((entry) => {
      if (isValidMonth(entry.month)) {
        return true;
      }
      warnings.push({
        code: "invalid-month",
        message: `Skipped cashflow with invalid month ${entry.month}.`,
        meta: { sourceId: entry.sourceId, category: entry.category },
      });
      return false;
    })
    .map((entry) => ({
      id: `${entry.sourceId}:${entry.month}`,
      type: entry.category,
      enabled: true,
      startMonth: entry.month,
      endMonth: entry.month,
      monthlyAmount: 0,
      oneTimeAmount: entry.amount,
      annualGrowthPct: 0,
    }));

const eventCashflowsToLedger = (
  cashflows: ReturnType<typeof compileScenarioCashflows>
): CashflowItem[] =>
  cashflows.map((entry) => ({
    month: entry.month,
    amount: entry.amountSigned,
    source: "event",
    sourceId: entry.sourceEventId,
    label: entry.title,
    category: entry.category,
  }));

const filterCashflowsToHorizon = (
  ledger: CashflowItem[],
  baseMonth: string,
  horizonMonths: number,
  warnings: AdapterWarning[]
) =>
  ledger.filter((entry) => {
    if (!isValidMonth(entry.month)) {
      warnings.push({
        code: "invalid-month",
        message: `Skipped cashflow with invalid month ${entry.month}.`,
        meta: { sourceId: entry.sourceId, category: entry.category },
      });
      return false;
    }
    const offset = monthIndex(baseMonth, entry.month);
    return offset >= 0 && offset < horizonMonths;
  });

export const mapScenarioToEngineInput = (
  scenario: Scenario,
  eventLibrary: EventDefinition[],
  options: AdapterOptions = {}
): ScenarioEngineAdapterResult => {
  const warnings: AdapterWarning[] = [];
  const strict = options.strict ?? true;
  const resolvedEvents =
    options.eventsOverride ?? buildScenarioTimelineEvents(scenario, eventLibrary);
  const enabledEvents = resolvedEvents.filter((event) => event.enabled);
  const earliestStartMonth = getEarliestStartMonth(enabledEvents);
  const buyHomeEvent = getEarliestBuyHomeEvent(enabledEvents);
  const homePositions = scenario.positions?.homes;
  const legacyHome = scenario.positions?.home ?? null;
  const resolvedHomePositions =
    homePositions ?? (legacyHome ? [legacyHome] : []);
  const warnInvalidMonth = (
    label: string,
    value: string,
    meta?: Record<string, unknown>
  ) => {
    warnings.push({
      code: "invalid-month",
      message: `${label} has invalid month ${value}.`,
      meta,
    });
  };
  if (buyHomeEvent && !checkBuyHomeEventMonth(buyHomeEvent)) {
    warnings.push({
      code: "invalid-month",
      message: `buy_home event has invalid startMonth ${buyHomeEvent.startMonth}.`,
      meta: { eventId: buyHomeEvent.id },
    });
  }
  if (!resolvedHomePositions.length && buyHomeEvent && strict) {
    throw new Error("buy_home event requires home details in scenario.positions.homes.");
  }
  const hasValidHomeMonths = (home: HomePosition, homeId?: string) => {
    const issues: Array<{ label: string; value: string }> = [];
    if (home.purchaseMonth && !isValidMonth(home.purchaseMonth)) {
      issues.push({ label: "home.purchaseMonth", value: home.purchaseMonth });
    }
    if (home.existing?.asOfMonth && !isValidMonth(home.existing.asOfMonth)) {
      issues.push({ label: "home.existing.asOfMonth", value: home.existing.asOfMonth });
    }
    if (home.rental?.rentStartMonth && !isValidMonth(home.rental.rentStartMonth)) {
      issues.push({
        label: "home.rental.rentStartMonth",
        value: home.rental.rentStartMonth,
      });
    }
    if (home.rental?.rentEndMonth && !isValidMonth(home.rental.rentEndMonth)) {
      issues.push({
        label: "home.rental.rentEndMonth",
        value: home.rental.rentEndMonth,
      });
    }
    if (issues.length > 0) {
      issues.forEach((issue) =>
        warnInvalidMonth(issue.label, issue.value, { homeId })
      );
      return false;
    }
    return true;
  };
  const validatedHomes = resolvedHomePositions.reduce<HomePositionWithId[]>(
    (result, homePosition) => {
      const homeId = (homePosition as { id?: string }).id;
      if (!hasValidHomeMonths(homePosition, homeId)) {
        return result;
      }
      const parsed = HomePositionSchema.safeParse(homePosition);
      if (!parsed.success) {
        if (strict) {
          throw new Error("scenario.positions.homes is invalid.");
        }
        return result;
      }
      result.push({
        ...parsed.data,
        id: homeId,
      });
      return result;
    },
    []
  );
  const homePurchaseMonth = validatedHomes.reduce<string | null>(
    (earliest, home) => {
      const candidate =
        (home.mode ?? "new_purchase") === "existing"
          ? home.existing?.asOfMonth
          : home.purchaseMonth;
      if (!candidate) {
        return earliest;
      }
      if (!earliest || candidate < earliest) {
        return candidate;
      }
      return earliest;
    },
    null
  );
  const baseMonthCandidates = [
    options.baseMonth ?? null,
    scenario.assumptions.baseMonth ?? null,
    earliestStartMonth,
    homePurchaseMonth,
  ];
  let baseMonth = formatMonth(new Date());
  for (const candidate of baseMonthCandidates) {
    if (!candidate) {
      continue;
    }
    if (isValidMonth(candidate)) {
      baseMonth = candidate;
      break;
    }
    warnInvalidMonth("baseMonth", candidate);
  }
  const horizonMonths =
    options.horizonMonths ?? scenario.assumptions.horizonMonths ?? 240;
  const initialCash =
    options.initialCash ?? scenario.assumptions.initialCash ?? 0;
  const investmentReturnAssumptions =
    scenario.assumptions.investmentReturnAssumptions ?? {};
  const eventLibraryMap = new Map(
    eventLibrary.map((definition) => [definition.id, definition])
  );
  (scenario.eventRefs ?? []).forEach((ref) => {
    const definition = eventLibraryMap.get(ref.refId);
    if (!definition) {
      return;
    }
    const rule = resolveEventRule(definition, ref);
    if (rule.startMonth && !isValidMonth(rule.startMonth)) {
      warnInvalidMonth("event.startMonth", rule.startMonth, { eventId: ref.refId });
    }
    if (rule.endMonth && !isValidMonth(rule.endMonth)) {
      warnInvalidMonth("event.endMonth", rule.endMonth, { eventId: ref.refId });
    }
    if (rule.mode === "schedule") {
      (rule.schedule ?? []).forEach((entry) => {
        if (!isValidMonth(entry.month)) {
          warnInvalidMonth("event.schedule.month", entry.month, {
            eventId: ref.refId,
          });
        }
      });
    }
  });
  const isValidMonthOrWarn = (
    label: string,
    value: string,
    meta?: Record<string, unknown>
  ) => {
    if (!isValidMonth(value)) {
      warnInvalidMonth(label, value, meta);
      return false;
    }
    return true;
  };
  const cashflowLedger = compileScenarioCashflows({
    scenario,
    eventLibrary,
    signByType: getEventSign,
  });
  const eventLedger = eventCashflowsToLedger(cashflowLedger);
  const includeBudgetRulesInProjection =
    scenario.assumptions.includeBudgetRulesInProjection ?? true;
  const budgetLedger = includeBudgetRulesInProjection
    ? compileAllBudgetRules(scenario)
    : [];
  const combinedLedger = filterCashflowsToHorizon(
    [...eventLedger, ...budgetLedger],
    baseMonth,
    horizonMonths,
    warnings
  );
  const events = buildEngineEventsFromCashflows(combinedLedger, warnings);
  const mappedHomes =
    validatedHomes.length > 0
      ? validatedHomes.map((home) => {
          const mode = home.mode ?? "new_purchase";
          const usage = home.usage ?? "primary";
          const rental = home.rental
            ? {
                rentMonthly: home.rental.rentMonthly,
                rentStartMonth: home.rental.rentStartMonth,
                rentEndMonth: home.rental.rentEndMonth ?? undefined,
                rentAnnualGrowth: (home.rental.rentAnnualGrowthPct ?? 0) / 100,
                vacancyRate: (home.rental.vacancyRatePct ?? 0) / 100,
              }
            : undefined;

          if (mode === "existing" && home.existing) {
            return {
              id: home.id,
              usage,
              mode,
              purchasePrice: home.purchasePrice ?? home.existing.marketValue,
              annualAppreciation: home.annualAppreciationPct / 100,
              feesOneTime: home.feesOneTime,
              holdingCostMonthly: home.holdingCostMonthly ?? 0,
              holdingCostAnnualGrowth: (home.holdingCostAnnualGrowthPct ?? 0) / 100,
              existing: {
                asOfMonth: home.existing.asOfMonth,
                marketValue: home.existing.marketValue,
                mortgageBalance: home.existing.mortgageBalance,
                remainingTermMonths: home.existing.remainingTermMonths,
                annualRate: (home.existing.annualRatePct ?? 0) / 100,
              },
              rental,
            };
          }

          return {
            id: home.id,
            usage,
            mode,
            purchasePrice: home.purchasePrice ?? 0,
            downPayment: home.downPayment ?? 0,
            purchaseMonth: home.purchaseMonth ?? baseMonth,
            annualAppreciation: home.annualAppreciationPct / 100,
            feesOneTime: home.feesOneTime,
            holdingCostMonthly: home.holdingCostMonthly ?? 0,
            holdingCostAnnualGrowth: (home.holdingCostAnnualGrowthPct ?? 0) / 100,
            mortgage: {
              principal: (home.purchasePrice ?? 0) - (home.downPayment ?? 0),
              annualRate: (home.mortgageRatePct ?? 0) / 100,
              termMonths: (home.mortgageTermYears ?? 0) * 12,
            },
            rental,
          };
        })
      : undefined;

  const mappedInvestments = scenario.positions?.investments
    ? scenario.positions.investments.flatMap((investment: InvestmentPosition) => {
        const startMonth = investment.startMonth ?? baseMonth;
        if (!isValidMonthOrWarn("investment.startMonth", startMonth, { id: investment.id })) {
          return [];
        }
        const assumedReturn =
          investment.expectedAnnualReturnPct ??
          (investment.assetClass
            ? investmentReturnAssumptions[investment.assetClass] ?? 0
            : 0);

        return [
          {
            id: investment.id,
            startMonth,
            initialValue: investment.initialValue ?? 0,
            annualReturnRate: assumedReturn / 100,
            monthlyContribution: investment.monthlyContribution ?? 0,
            monthlyWithdrawal: investment.monthlyWithdrawal ?? 0,
            feeAnnualRate: (investment.feeAnnualRatePct ?? 0) / 100,
          },
        ];
      })
    : undefined;

  const mappedInsurances = scenario.positions?.insurances
    ? scenario.positions.insurances.map((insurance: InsurancePosition) => {
        const premiumMonthly =
          insurance.premiumMode === "annual"
            ? insurance.premiumAmount / 12
            : insurance.premiumAmount;

        return {
          insuranceType: insurance.insuranceType,
          premiumMonthly,
          hasCashValue: insurance.hasCashValue,
          cashValue: insurance.cashValueAsOf ?? 0,
          cashValueAnnualGrowth: (insurance.cashValueAnnualGrowthPct ?? 0) / 100,
          coverageMeta: insurance.coverageMeta,
        };
      })
    : undefined;

  const mappedLoans = scenario.positions?.loans
    ? scenario.positions.loans.flatMap((loan: LoanPosition) => {
        if (!isValidMonthOrWarn("loan.startMonth", loan.startMonth, { id: loan.id })) {
          return [];
        }
        return [
          {
            id: loan.id,
            startMonth: loan.startMonth,
            principal: loan.principal,
            annualInterestRate: (loan.annualInterestRatePct ?? 0) / 100,
            termMonths: Math.max(0, loan.termYears ?? 0) * 12,
            monthlyPayment: loan.monthlyPayment,
            feesOneTime: loan.feesOneTime,
          },
        ];
      })
    : undefined;

  const mappedCars = scenario.positions?.cars
    ? scenario.positions.cars.flatMap((car: CarPosition) => {
        if (!isValidMonthOrWarn("car.purchaseMonth", car.purchaseMonth, { id: car.id })) {
          return [];
        }
        const loan = car.loan
          ? {
              principal: car.loan.principal,
              annualInterestRate: (car.loan.annualInterestRatePct ?? 0) / 100,
              termMonths: Math.max(0, car.loan.termYears ?? 0) * 12,
              monthlyPayment: car.loan.monthlyPayment,
            }
          : undefined;

        return [
          {
            id: car.id,
            purchaseMonth: car.purchaseMonth,
            purchasePrice: car.purchasePrice,
            downPayment: car.downPayment,
            annualDepreciationRate: (car.annualDepreciationRatePct ?? 0) / 100,
            holdingCostMonthly: car.holdingCostMonthly,
            holdingCostAnnualGrowth: (car.holdingCostAnnualGrowthPct ?? 0) / 100,
            loan,
          },
        ];
      })
    : undefined;

  const mappedCashBuckets = scenario.positions?.cashBuckets
    ? scenario.positions.cashBuckets.flatMap((bucket: CashBucketPosition) => {
        if (bucket.asOfMonth && !isValidMonthOrWarn("cashBucket.asOfMonth", bucket.asOfMonth, { id: bucket.id })) {
          return [];
        }
        return [
          {
            id: bucket.id,
            name: bucket.name,
            balance: bucket.balance,
            asOfMonth: bucket.asOfMonth,
          },
        ];
      })
    : undefined;

  const positions =
    mappedHomes ||
    mappedInvestments ||
    mappedInsurances ||
    mappedLoans ||
    mappedCars ||
    mappedCashBuckets
      ? {
          homes: mappedHomes,
          investments: mappedInvestments,
          insurances: mappedInsurances,
          loans: mappedLoans,
          cars: mappedCars,
          cashBuckets: mappedCashBuckets,
        }
      : undefined;

  const ledgerEntries = combinedLedger.filter((entry) => entry.amount < 0);
  const entryMatchesKeywords = (entry: CashflowItem, keywords: string[]) => {
    const haystack = `${entry.label ?? ""} ${entry.category ?? ""}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  };
  const calcFixedMonthlyPayment = (
    principal: number,
    annualRate: number,
    termMonths: number
  ) => {
    if (principal <= 0 || termMonths <= 0) {
      return 0;
    }
    const monthlyRate = annualRate / 12;
    if (monthlyRate === 0) {
      return principal / termMonths;
    }
    return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
  };
  const hasRecurringOutflow = (
    startMonth: string,
    months: number,
    targetAmount?: number
  ) => {
    if (!targetAmount || targetAmount <= 0) {
      return false;
    }
    const matchingMonths = new Set(
      ledgerEntries
        .filter((entry) => {
          const offset = monthIndex(startMonth, entry.month);
          if (offset < 0 || offset >= months) {
            return false;
          }
          const delta = Math.abs(Math.abs(entry.amount) - targetAmount);
          const tolerance = Math.max(1, targetAmount * 0.1);
          return delta <= tolerance;
        })
        .map((entry) => entry.month)
    );
    return matchingMonths.size >= 3;
  };

  if (mappedLoans && mappedLoans.length > 0) {
    const loanKeywords = ["loan", "repay", "repayment", "debt", "installment"];
    mappedLoans.forEach((loan) => {
      const hasKeyword = ledgerEntries.some((entry) =>
        entryMatchesKeywords(entry, loanKeywords)
      );
      const targetPayment =
        loan.monthlyPayment ??
        calcFixedMonthlyPayment(loan.principal, loan.annualInterestRate, loan.termMonths);
      const recurring = hasRecurringOutflow(
        loan.startMonth,
        loan.termMonths,
        targetPayment
      );
      if (hasKeyword || recurring) {
        warnings.push({
          code: "double-count",
          message: `Potential double-count detected for loan ${loan.id ?? ""}.`,
          meta: { positionId: loan.id, type: "loan" },
        });
      }
    });
  }

  if (mappedCars && mappedCars.length > 0) {
    const carKeywords = ["car", "auto", "vehicle", "maintenance", "loan"];
    mappedCars.forEach((car) => {
      const hasKeyword = ledgerEntries.some((entry) =>
        entryMatchesKeywords(entry, carKeywords)
      );
      const loanPayment = car.loan
        ? car.loan.monthlyPayment ??
          calcFixedMonthlyPayment(
            car.loan.principal,
            car.loan.annualInterestRate,
            car.loan.termMonths
          )
        : undefined;
      const recurring = loanPayment
        ? hasRecurringOutflow(car.purchaseMonth, car.loan?.termMonths ?? 0, loanPayment)
        : false;
      if (hasKeyword || recurring) {
        warnings.push({
          code: "double-count",
          message: `Potential double-count detected for car ${car.id ?? ""}.`,
          meta: { positionId: car.id, type: "car" },
        });
      }
    });
  }

  if (mappedInvestments && mappedInvestments.length > 0) {
    const investmentKeywords = ["invest", "investment", "fund", "etf", "stock"];
    mappedInvestments.forEach((investment) => {
      const hasKeyword = ledgerEntries.some((entry) =>
        entryMatchesKeywords(entry, investmentKeywords)
      );
      const recurring = hasRecurringOutflow(
        investment.startMonth,
        horizonMonths,
        investment.monthlyContribution
      );
      if (hasKeyword || recurring) {
        warnings.push({
          code: "double-count",
          message: `Potential double-count detected for investment ${investment.id ?? ""}.`,
          meta: { positionId: investment.id, type: "investment" },
        });
      }
    });
  }

  return {
    input: {
      baseMonth,
      horizonMonths,
      initialCash,
      events,
      positions,
    },
    warnings,
  };
};

export const projectionToOverviewViewModel = (projection: ProjectionResult): {
  kpis: OverviewKpis;
  cashSeries: TimeSeriesPoint[];
  netWorthSeries: TimeSeriesPoint[];
} => ({
  kpis: {
    lowestMonthlyBalance: projection.lowestMonthlyBalance.value,
    runwayMonths: projection.runwayMonths,
    netWorthYear5: projection.netWorthYear5,
    riskLevel: projection.riskLevel,
  },
  cashSeries: projection.months.map((month, index) => ({
    month,
    value: projection.cashBalance[index] ?? 0,
  })),
  netWorthSeries: mapNetWorthSeries(projection),
});

export const mapNetWorthSeries = (
  projection: ProjectionResult
): TimeSeriesPoint[] => {
  if (!projection.months.length || !projection.netWorth.length) {
    return [];
  }

  const seriesLength = Math.min(projection.months.length, projection.netWorth.length);

  return projection.months.slice(0, seriesLength).map((month, index) => ({
    month,
    value: projection.netWorth[index] ?? 0,
  }));
};
