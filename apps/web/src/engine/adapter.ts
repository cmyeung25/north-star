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
  ScenarioMember,
  BudgetRule,
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
import { normalizeMonthStrict } from "../utils/month";
import { compileSmartInvest } from "../domain/smartInvest/compileSmartInvest";
import type {
  SmartInvestContributionSchedule,
  SmartInvestRebalanceSchedule,
  SmartInvestWithdrawalSchedule,
} from "../domain/smartInvest/solver";
import { compileSellLifecycle } from "../domain/positions/compileSellLifecycle";

type AdapterOptions = {
  baseMonth?: string;
  horizonMonths?: number;
  initialCash?: number;
  strict?: boolean;
  eventsOverride?: TimelineEvent[];
  members?: ScenarioMember[];
  budgetRules?: BudgetRule[];
  smartInvestWithdrawalSchedules?: SmartInvestWithdrawalSchedule;
  smartInvestRebalanceSchedules?: SmartInvestRebalanceSchedule;
  smartInvestContributionSchedules?: SmartInvestContributionSchedule;
  smartInvestTransferSeries?: Array<{
    month: string;
    amount: number;
    kind: "contribution" | "withdrawal";
  }>;
};

export type AdapterWarning = {
  code: "invalid-month" | "double-count" | "smart-invest-reserve-shortfall";
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
    const normalized = normalizeMonthStrict(event.startMonth);
    if (!normalized.ok) {
      return earliest;
    }
    if (!earliest || normalized.month < earliest) {
      return normalized.month;
    }
    return earliest;
  }, null);

const getEarliestBuyHomeEvent = (events: TimelineEvent[]) =>
  events.reduce<TimelineEvent | null>((earliest, event) => {
    if (!event.enabled || event.type !== "buy_home") {
      return earliest;
    }
    const normalized = normalizeMonthStrict(event.startMonth);
    if (!normalized.ok) {
      return earliest;
    }
    const earliestNormalized = earliest
      ? normalizeMonthStrict(earliest.startMonth)
      : null;
    if (
      !earliest ||
      !earliestNormalized?.ok ||
      normalized.month < earliestNormalized.month
    ) {
      return event;
    }
    return earliest;
  }, null);

const checkBuyHomeEventMonth = (event: TimelineEvent) =>
  normalizeMonthStrict(event.startMonth).ok;

const buildEngineEventsFromCashflows = (
  cashflows: CashflowItem[],
  warnings: AdapterWarning[]
): ProjectionInput["events"] =>
  cashflows
    .filter((entry) => entry.amount !== 0)
    .filter(
      (entry) => entry.category !== "buy_home" && entry.category !== "insurance_product"
    )
    .flatMap((entry) => {
      const normalized = normalizeMonthStrict(entry.month);
      if (!normalized.ok) {
        warnings.push({
          code: "invalid-month",
          message: `Skipped cashflow with invalid month ${entry.month}.`,
          meta: {
            sourceId: entry.sourceId,
            category: entry.category,
            reason: normalized.reason,
          },
        });
        return [];
      }
      return [{ entry, month: normalized.month }];
    })
    .map(({ entry, month }) => ({
      id: `${entry.sourceId}:${month}`,
      type: entry.category,
      enabled: true,
      startMonth: month,
      endMonth: month,
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
  ledger.flatMap((entry) => {
    const normalized = normalizeMonthStrict(entry.month);
    if (!normalized.ok) {
      warnings.push({
        code: "invalid-month",
        message: `Skipped cashflow with invalid month ${entry.month}.`,
        meta: {
          sourceId: entry.sourceId,
          category: entry.category,
          reason: normalized.reason,
        },
      });
      return [];
    }
    const offset = monthIndex(baseMonth, normalized.month);
    if (offset < 0 || offset >= horizonMonths) {
      return [];
    }
    return [{ ...entry, month: normalized.month }];
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
  const normalizeRequiredMonth = (
    label: string,
    value: string | null | undefined,
    meta?: Record<string, unknown>
  ): string | null => {
    const raw = value?.trim() ?? "";
    if (!raw) {
      warnInvalidMonth(label, value ?? "", { ...meta, reason: "empty" });
      return null;
    }
    const normalized = normalizeMonthStrict(raw);
    if (!normalized.ok) {
      warnInvalidMonth(label, raw, { ...meta, reason: normalized.reason });
      return null;
    }
    return normalized.month;
  };
  const normalizeOptionalMonth = (
    label: string,
    value: string | null | undefined,
    meta?: Record<string, unknown>
  ): string | null => {
    const raw = value?.trim() ?? "";
    if (!raw) {
      return null;
    }
    const normalized = normalizeMonthStrict(raw);
    if (!normalized.ok) {
      warnInvalidMonth(label, raw, { ...meta, reason: normalized.reason });
      return null;
    }
    return normalized.month;
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
  const normalizeHomeMonths = (home: HomePosition, homeId?: string) => {
    const issues: Array<{ label: string; value: string }> = [];
    const normalized: HomePosition = {
      ...home,
      existing: home.existing ? { ...home.existing } : undefined,
      rental: home.rental ? { ...home.rental } : undefined,
    };
    if (home.purchaseMonth) {
      const normalizedPurchase = normalizeOptionalMonth(
        "home.purchaseMonth",
        home.purchaseMonth,
        { homeId }
      );
      if (!normalizedPurchase) {
        issues.push({ label: "home.purchaseMonth", value: home.purchaseMonth });
      } else {
        normalized.purchaseMonth = normalizedPurchase;
      }
    }
    if (home.existing?.asOfMonth) {
      const normalizedExisting = normalizeRequiredMonth(
        "home.existing.asOfMonth",
        home.existing.asOfMonth,
        { homeId }
      );
      if (!normalizedExisting) {
        issues.push({
          label: "home.existing.asOfMonth",
          value: home.existing.asOfMonth,
        });
      } else if (normalized.existing) {
        normalized.existing.asOfMonth = normalizedExisting;
      }
    }
    if (home.rental?.rentStartMonth) {
      const normalizedRentStart = normalizeRequiredMonth(
        "home.rental.rentStartMonth",
        home.rental.rentStartMonth,
        { homeId }
      );
      if (!normalizedRentStart) {
        issues.push({
          label: "home.rental.rentStartMonth",
          value: home.rental.rentStartMonth,
        });
      } else if (normalized.rental) {
        normalized.rental.rentStartMonth = normalizedRentStart;
      }
    }
    if (home.rental?.rentEndMonth) {
      const normalizedRentEnd = normalizeOptionalMonth(
        "home.rental.rentEndMonth",
        home.rental.rentEndMonth,
        { homeId }
      );
      if (!normalizedRentEnd) {
        issues.push({
          label: "home.rental.rentEndMonth",
          value: home.rental.rentEndMonth,
        });
      } else if (normalized.rental) {
        normalized.rental.rentEndMonth = normalizedRentEnd;
      }
    }
    if (home.sellMonth) {
      const normalizedSellMonth = normalizeOptionalMonth(
        "home.sellMonth",
        home.sellMonth,
        { homeId }
      );
      if (!normalizedSellMonth) {
        issues.push({ label: "home.sellMonth", value: home.sellMonth });
      } else {
        normalized.sellMonth = normalizedSellMonth;
      }
    }
    if (issues.length > 0) {
      issues.forEach((issue) =>
        warnInvalidMonth(issue.label, issue.value, { homeId })
      );
      return null;
    }
    return normalized;
  };
  const validatedHomes = resolvedHomePositions.reduce<HomePositionWithId[]>(
    (result, homePosition) => {
      const homeId = (homePosition as { id?: string }).id;
      const normalizedHome = normalizeHomeMonths(homePosition, homeId);
      if (!normalizedHome) {
        return result;
      }
      const parsed = HomePositionSchema.safeParse(normalizedHome);
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
    const normalized = normalizeMonthStrict(candidate);
    if (normalized.ok) {
      baseMonth = normalized.month;
      break;
    }
    warnInvalidMonth("baseMonth", candidate, { reason: normalized.reason });
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
    if (rule.startMonth) {
      const normalized = normalizeMonthStrict(rule.startMonth);
      if (!normalized.ok) {
        warnInvalidMonth("event.startMonth", rule.startMonth, {
          eventId: ref.refId,
          reason: normalized.reason,
        });
      }
    }
    if (rule.endMonth) {
      const normalized = normalizeMonthStrict(rule.endMonth);
      if (!normalized.ok) {
        warnInvalidMonth("event.endMonth", rule.endMonth, {
          eventId: ref.refId,
          reason: normalized.reason,
        });
      }
    }
    if (rule.mode === "schedule") {
      (rule.schedule ?? []).forEach((entry) => {
        const normalized = normalizeMonthStrict(entry.month);
        if (!normalized.ok) {
          warnInvalidMonth("event.schedule.month", entry.month, {
            eventId: ref.refId,
            reason: normalized.reason,
          });
        }
      });
    }
  });
  const normalizePositionMonthOrWarn = (
    label: string,
    value: string | null | undefined,
    meta?: Record<string, unknown>
  ): string | null => normalizeRequiredMonth(label, value, meta);
  const normalizeBudgetRules = (rules: BudgetRule[]) =>
    rules.flatMap((rule) => {
      const startMonth = normalizeOptionalMonth("budgetRule.startMonth", rule.startMonth, {
        ruleId: rule.id,
      });
      if (rule.startMonth && !startMonth) {
        return [];
      }
      const endMonth = normalizeOptionalMonth("budgetRule.endMonth", rule.endMonth, {
        ruleId: rule.id,
      });
      if (rule.endMonth && !endMonth) {
        return [];
      }
      return [
        {
          ...rule,
          startMonth: startMonth ?? undefined,
          endMonth: endMonth ?? undefined,
        },
      ];
    });
  const includeBudgetRulesInProjection =
    scenario.assumptions.includeBudgetRulesInProjection ?? true;
  const members = options.members ?? [];
  const cashflowLedger = compileScenarioCashflows({
    scenario,
    eventLibrary,
    signByType: getEventSign,
    members,
  });
  const eventLedger = eventCashflowsToLedger(cashflowLedger);
  const budgetRules = options.budgetRules ?? [];
  const normalizedBudgetRules = normalizeBudgetRules(budgetRules);
  const budgetLedger = includeBudgetRulesInProjection
    ? compileAllBudgetRules(scenario, normalizedBudgetRules, members)
    : [];
  const combinedLedger = filterCashflowsToHorizon(
    [...eventLedger, ...budgetLedger],
    baseMonth,
    horizonMonths,
    warnings
  );
  const hasSmartInvestSchedules =
    Boolean(options.smartInvestContributionSchedules) ||
    Boolean(options.smartInvestWithdrawalSchedules) ||
    Boolean(options.smartInvestRebalanceSchedules);
  const smartInvestTransferLedger =
    !hasSmartInvestSchedules && options.smartInvestTransferSeries?.length
      ? filterCashflowsToHorizon(
          options.smartInvestTransferSeries.map((entry) => ({
            month: entry.month,
            amount: entry.amount,
            source: "smartInvest",
            sourceId: `smartInvest:${entry.kind}`,
            label: entry.kind,
            category:
              entry.kind === "withdrawal"
                ? "investment_withdrawal"
                : "investment_contribution",
          })),
          baseMonth,
          horizonMonths,
          warnings
        )
      : [];
  const smartInvestPolicy = scenario.assumptions.smartInvest;
  const smartInvestInvestments =
    smartInvestPolicy?.enabled
      ? compileSmartInvest({
          baseMonth,
          horizonMonths,
          scenario,
          policy: smartInvestPolicy,
          baselineCashflows: combinedLedger.map((entry) => ({
            month: entry.month,
            amount: entry.amount,
          })),
          contributionScheduleByAllocation: options.smartInvestContributionSchedules,
          withdrawalScheduleByAllocation: options.smartInvestWithdrawalSchedules,
          rebalanceScheduleByAllocation: options.smartInvestRebalanceSchedules,
        })
      : [];
  const sellCashflows = compileSellLifecycle(scenario)
    .flatMap((entry) => {
      const normalized = normalizeMonthStrict(entry.month);
      if (!normalized.ok) {
        warnings.push({
          code: "invalid-month",
          message: `Skipped cashflow with invalid month ${entry.month}.`,
          meta: { sourceId: entry.sourceId, reason: normalized.reason },
        });
        return [];
      }
      return [{ ...entry, month: normalized.month }];
    })
    .filter((entry) => {
      const offset = monthIndex(baseMonth, entry.month);
      return offset >= 0 && offset < horizonMonths;
    })
    .map((entry) => ({
      month: entry.month,
      amount: entry.amount,
      source: "position" as const,
      sourceId: entry.sourceId,
      label: entry.label,
      category: "position_sell",
    }));
  const combinedLedgerWithSell = [...combinedLedger, ...sellCashflows];
  const events = buildEngineEventsFromCashflows(
    [...combinedLedgerWithSell, ...smartInvestTransferLedger],
    warnings
  );
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
              sellMonth: home.sellMonth,
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

          const purchasePrice = home.purchasePrice ?? 0;
          const downPayment = home.downPayment ?? 0;
          const principal = purchasePrice - downPayment;
          const annualRateDecimal = (home.mortgageRatePct ?? 0) / 100;
          const termMonths = (home.mortgageTermYears ?? 0) * 12;

          if (process.env.NODE_ENV === "development") {
            if (annualRateDecimal < 0 || annualRateDecimal > 1) {
              throw new Error(
                `Invalid mortgage rate decimal: ${annualRateDecimal}. Expected 0-1.`
              );
            }
            if (termMonths < 1 || termMonths > 720) {
              console.warn("[homeMap] Unusual mortgage term months", {
                termMonths,
                homeId: home.id,
              });
            }
            console.debug("[homeMap]", {
              purchasePrice,
              downPayment,
              principal,
              annualRateDecimal,
              termMonths,
            });
          }

          return {
            id: home.id,
            usage,
            mode,
            purchasePrice,
            downPayment,
            purchaseMonth: home.purchaseMonth ?? baseMonth,
            sellMonth: home.sellMonth,
            annualAppreciation: home.annualAppreciationPct / 100,
            feesOneTime: home.feesOneTime,
            holdingCostMonthly: home.holdingCostMonthly ?? 0,
            holdingCostAnnualGrowth: (home.holdingCostAnnualGrowthPct ?? 0) / 100,
            mortgage: {
              principal,
              annualRate: annualRateDecimal,
              termMonths,
            },
            rental,
          };
        })
      : undefined;

  const mappedInvestments = scenario.positions?.investments
    ? scenario.positions.investments.flatMap((investment: InvestmentPosition) => {
        const startMonth =
          normalizePositionMonthOrWarn("investment.startMonth", investment.startMonth ?? baseMonth, {
            id: investment.id,
          });
        if (!startMonth) {
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
    ? scenario.positions.insurances.flatMap((insurance: InsurancePosition) => {
        if (!insurance.enabled) {
          return [];
        }
        const startMonth = normalizePositionMonthOrWarn(
          "insurance.startMonth",
          insurance.startMonth ?? baseMonth,
          {
            id: insurance.id,
          }
        );
        if (!startMonth) {
          return [];
        }
        const endMonth = insurance.endMonth
          ? normalizeOptionalMonth("insurance.endMonth", insurance.endMonth, {
              id: insurance.id,
            })
          : undefined;
        if (insurance.endMonth && !endMonth) {
          return [];
        }

        return [
          {
            id: insurance.id,
            kind: insurance.kind,
            startMonth,
            endMonth: endMonth ?? undefined,
            premiumMonthly: insurance.premiumMonthly ?? 0,
            premiumAnnualGrowth: (insurance.premiumAnnualGrowthPct ?? 0) / 100,
            initialCashValue: insurance.initialCashValue ?? 0,
            annualReturnRate: (insurance.expectedAnnualReturnPct ?? 0) / 100,
          },
        ];
      })
    : undefined;

  const mappedLoans = scenario.positions?.loans
    ? scenario.positions.loans.flatMap((loan: LoanPosition) => {
        const startMonth = normalizePositionMonthOrWarn("loan.startMonth", loan.startMonth, {
          id: loan.id,
        });
        if (!startMonth) {
          return [];
        }
        return [
          {
            id: loan.id,
            startMonth,
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
        const purchaseMonth = normalizePositionMonthOrWarn(
          "car.purchaseMonth",
          car.purchaseMonth,
          { id: car.id }
        );
        if (!purchaseMonth) {
          return [];
        }
        const sellMonth = car.sellMonth
          ? normalizeOptionalMonth("car.sellMonth", car.sellMonth, { id: car.id })
          : undefined;
        if (car.sellMonth && !sellMonth) {
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
            purchaseMonth,
            purchasePrice: car.purchasePrice,
            downPayment: car.downPayment,
            annualDepreciationRate: (car.annualDepreciationRatePct ?? 0) / 100,
            holdingCostMonthly: car.holdingCostMonthly,
            holdingCostAnnualGrowth: (car.holdingCostAnnualGrowthPct ?? 0) / 100,
            loan,
            sellMonth: sellMonth ?? undefined,
          },
        ];
      })
    : undefined;

  const mappedCashBuckets = scenario.positions?.cashBuckets
    ? scenario.positions.cashBuckets.flatMap((bucket: CashBucketPosition) => {
        const asOfMonth = bucket.asOfMonth
          ? normalizeOptionalMonth("cashBucket.asOfMonth", bucket.asOfMonth, {
              id: bucket.id,
            })
          : undefined;
        if (bucket.asOfMonth && !asOfMonth) {
          return [];
        }
        return [
          {
            id: bucket.id,
            name: bucket.name,
            balance: bucket.balance,
            asOfMonth: asOfMonth ?? undefined,
          },
        ];
      })
    : undefined;

  const hasPositions =
    Boolean(
      mappedHomes ||
        mappedInvestments ||
        mappedInsurances ||
        mappedLoans ||
        mappedCars ||
        mappedCashBuckets
    ) || smartInvestInvestments.length > 0;
  const positions = hasPositions
    ? {
        homes: mappedHomes,
        investments:
          mappedInvestments || smartInvestInvestments.length > 0
            ? [...(mappedInvestments ?? []), ...smartInvestInvestments]
            : undefined,
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
