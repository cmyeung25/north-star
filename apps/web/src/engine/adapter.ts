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
  RentalDetails,
  Scenario,
  ScenarioAssumptions,
  ScenarioMember,
  BudgetRule,
} from "../store/scenarioStore";
import { HomePositionSchema } from "../store/scenarioValidation";
import type { OverviewKpis, TimeSeriesPoint } from "../../features/overview/types";
import { getEventSign } from "../events/eventCatalog";
import type { EventDefinition, EventRule } from "../domain/events/types";
import { compileScenarioCashflows } from "../domain/events/compiler";
import { buildScenarioTimelineEvents } from "../domain/events/utils";
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
import { appliesToScenario } from "../domain/applyScope";
import {
  WarningCode,
  type CompilerWarning,
  type WarningRef,
} from "../domain/warnings/types";

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

export type AdapterWarning = CompilerWarning;

export type ScenarioEngineAdapterResult = {
  input: ProjectionInput;
  warnings: CompilerWarning[];
  sanitized: SanitizedProjectionInputs;
};

export type SanitizedProjectionInputs = {
  scenario: Scenario;
  eventLibrary: EventDefinition[];
  members: ScenarioMember[];
  budgetRules: BudgetRule[];
  warnings: CompilerWarning[];
};

type HomePositionWithId = HomePosition & { id?: string };

const formatMonth = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
};

const buildWarning = (
  warning: Omit<CompilerWarning, "messageKey" | "defaultMessage"> & {
    messageKey?: string;
    defaultMessage?: string;
  }
): CompilerWarning => ({
  messageKey: warning.messageKey ?? "warnings.generic",
  defaultMessage: warning.defaultMessage ?? "A projection warning was detected.",
  ...warning,
});

const buildMonthInvalidWarning = ({
  label,
  value,
  refs,
  reason,
  debug,
}: {
  label: string;
  value: string;
  refs?: WarningRef;
  reason?: string;
  debug?: Record<string, unknown>;
}): CompilerWarning =>
  buildWarning({
    code: WarningCode.MonthInvalid,
    severity: "warning",
    messageKey: "warnings.monthInvalid",
    defaultMessage: `${label} has invalid month ${value}.`,
    refs,
    debug: { label, rawValue: value, reason, ...debug },
  });

export const sanitizeScenarioForProjection = ({
  scenario,
  eventLibrary,
  members = [],
  budgetRules = [],
}: {
  scenario: Scenario;
  eventLibrary: EventDefinition[];
  members?: ScenarioMember[];
  budgetRules?: BudgetRule[];
}): SanitizedProjectionInputs => {
  const warnings: CompilerWarning[] = [];
  const sanitizeMonth = (
    label: string,
    value: string | null | undefined,
    refs?: WarningRef
  ) => {
    const raw = value?.trim() ?? "";
    if (!raw) {
      return null;
    }
    const normalized = normalizeMonthStrict(raw);
    if (!normalized.ok) {
      warnings.push(
        buildMonthInvalidWarning({
          label,
          value: raw,
          refs,
          reason: normalized.reason,
        })
      );
      return null;
    }
    return normalized.month;
  };

  const sanitizeSchedule = (
    label: string,
    schedule: EventRule["schedule"],
    refs?: WarningRef
  ) =>
    (schedule ?? []).flatMap((entry) => {
      const normalized = sanitizeMonth(label, entry.month, refs);
      if (!normalized) {
        return [];
      }
      return [{ ...entry, month: normalized }];
    });

  const sanitizedMembers = members.map((member) => {
    if (!member.birthMonth) {
      return member;
    }
    const normalizedBirth = sanitizeMonth(
      "member.birthMonth",
      member.birthMonth,
      { memberId: member.id, month: member.birthMonth }
    );
    if (!normalizedBirth) {
      return { ...member, birthMonth: undefined };
    }
    return { ...member, birthMonth: normalizedBirth };
  });

  const sanitizedEventLibrary = eventLibrary.map((definition) => {
    const normalizedStart = sanitizeMonth(
      "event.startMonth",
      definition.rule.startMonth,
      { eventId: definition.id, month: definition.rule.startMonth ?? undefined }
    );
    const normalizedEnd = sanitizeMonth(
      "event.endMonth",
      definition.rule.endMonth ?? undefined,
      { eventId: definition.id, month: definition.rule.endMonth ?? undefined }
    );
    const normalizedSchedule = sanitizeSchedule(
      "event.schedule.month",
      definition.rule.schedule,
      { eventId: definition.id }
    );
    const normalizedSalarySteps = (definition.rule.salarySteps ?? []).flatMap((step) => {
      if (step.basis !== "month") {
        return [step];
      }
      const normalizedStep = sanitizeMonth(
        "event.salaryStep.startMonth",
        step.startMonth ?? "",
        { eventId: definition.id, month: step.startMonth }
      );
      if (!normalizedStep) {
        return [];
      }
      return [{ ...step, startMonth: normalizedStep }];
    });

    return {
      ...definition,
      rule: {
        ...definition.rule,
        startMonth: normalizedStart ?? undefined,
        endMonth: normalizedEnd ?? undefined,
        schedule: normalizedSchedule,
        salarySteps: normalizedSalarySteps.length > 0 ? normalizedSalarySteps : undefined,
      },
    };
  });

  const sanitizedEventRefs = scenario.eventRefs?.map((ref) => {
    if (!ref.overrides) {
      return ref;
    }
    const overrides = { ...ref.overrides };
    const normalizedStart = sanitizeMonth(
      "event.override.startMonth",
      overrides.startMonth,
      { eventId: ref.refId, month: overrides.startMonth }
    );
    const normalizedEnd = sanitizeMonth(
      "event.override.endMonth",
      overrides.endMonth ?? undefined,
      { eventId: ref.refId, month: overrides.endMonth ?? undefined }
    );
    const normalizedSchedule = sanitizeSchedule(
      "event.override.schedule.month",
      overrides.schedule,
      { eventId: ref.refId }
    );
    if (overrides.startMonth && !normalizedStart) {
      delete overrides.startMonth;
    } else if (normalizedStart) {
      overrides.startMonth = normalizedStart;
    }
    if (overrides.endMonth && !normalizedEnd) {
      delete overrides.endMonth;
    } else if (normalizedEnd) {
      overrides.endMonth = normalizedEnd;
    }
    if (overrides.schedule) {
      overrides.schedule = normalizedSchedule;
    }
    return { ...ref, overrides };
  });

  const sanitizedScenario: Scenario = {
    ...scenario,
    assumptions: {
      ...scenario.assumptions,
      baseMonth: sanitizeMonth("assumptions.baseMonth", scenario.assumptions.baseMonth),
    },
    eventRefs: sanitizedEventRefs,
    positions: scenario.positions
      ? {
          ...scenario.positions,
          investments: scenario.positions.investments?.flatMap((investment) => {
            const normalizedStart = sanitizeMonth(
              "investment.startMonth",
              investment.startMonth,
              { positionId: investment.id, month: investment.startMonth }
            );
            if (!normalizedStart) {
              return [];
            }
            return [{ ...investment, startMonth: normalizedStart }];
          }),
          insurances: scenario.positions.insurances?.flatMap((insurance) => {
            const normalizedStart = sanitizeMonth(
              "insurance.startMonth",
              insurance.startMonth,
              { positionId: insurance.id, month: insurance.startMonth }
            );
            if (!normalizedStart) {
              return [];
            }
            const normalizedEnd = sanitizeMonth(
              "insurance.endMonth",
              insurance.endMonth ?? undefined,
              { positionId: insurance.id, month: insurance.endMonth ?? undefined }
            );
            return [
              {
                ...insurance,
                startMonth: normalizedStart,
                endMonth: normalizedEnd ?? undefined,
              },
            ];
          }),
          loans: scenario.positions.loans?.flatMap((loan) => {
            const normalizedStart = sanitizeMonth(
              "loan.startMonth",
              loan.startMonth,
              { positionId: loan.id, month: loan.startMonth }
            );
            if (!normalizedStart) {
              return [];
            }
            return [{ ...loan, startMonth: normalizedStart }];
          }),
          cars: scenario.positions.cars?.flatMap((car) => {
            const normalizedPurchase = sanitizeMonth(
              "car.purchaseMonth",
              car.purchaseMonth,
              { positionId: car.id, month: car.purchaseMonth }
            );
            if (!normalizedPurchase) {
              return [];
            }
            const normalizedSell = sanitizeMonth(
              "car.sellMonth",
              car.sellMonth ?? undefined,
              { positionId: car.id, month: car.sellMonth ?? undefined }
            );
            return [
              {
                ...car,
                purchaseMonth: normalizedPurchase,
                sellMonth: normalizedSell ?? undefined,
              },
            ];
          }),
          homes: scenario.positions.homes?.map((home) => {
            const rental = home.rental?.isRented === false ? undefined : home.rental;
            const normalizedPurchase = sanitizeMonth(
              "home.purchaseMonth",
              home.purchaseMonth,
              { positionId: home.id, month: home.purchaseMonth }
            );
            const normalizedSell = sanitizeMonth(
              "home.sellMonth",
              home.sellMonth ?? undefined,
              { positionId: home.id, month: home.sellMonth ?? undefined }
            );
            const normalizedExisting = home.existing?.asOfMonth
              ? sanitizeMonth(
                  "home.existing.asOfMonth",
                  home.existing.asOfMonth,
                  { positionId: home.id, month: home.existing.asOfMonth }
                )
              : null;
            const normalizedRentStart = rental?.rentStartMonth
              ? sanitizeMonth(
                  "home.rental.rentStartMonth",
                  rental.rentStartMonth,
                  { positionId: home.id, month: rental.rentStartMonth }
                )
              : null;
            const normalizedRentEnd = rental?.rentEndMonth
              ? sanitizeMonth(
                  "home.rental.rentEndMonth",
                  rental.rentEndMonth,
                  { positionId: home.id, month: rental.rentEndMonth }
                )
              : null;

            return {
              ...home,
              purchaseMonth: normalizedPurchase ?? undefined,
              sellMonth: normalizedSell ?? undefined,
              existing: home.existing
                ? {
                    ...home.existing,
                    asOfMonth: normalizedExisting ?? home.existing.asOfMonth,
                  }
                : undefined,
              rental:
                rental
                ? {
                    ...rental,
                    rentStartMonth: normalizedRentStart ?? rental.rentStartMonth,
                    rentEndMonth: normalizedRentEnd ?? rental.rentEndMonth,
                  }
                : undefined,
            };
          }),
        }
      : scenario.positions,
  };

  const sanitizedBudgetRules = budgetRules.map((rule) => ({
    ...rule,
    startMonth: sanitizeMonth(
      "budgetRule.startMonth",
      rule.startMonth ?? undefined,
      { ruleId: rule.id, month: rule.startMonth ?? undefined }
    ) ?? undefined,
    endMonth: sanitizeMonth(
      "budgetRule.endMonth",
      rule.endMonth ?? undefined,
      { ruleId: rule.id, month: rule.endMonth ?? undefined }
    ) ?? undefined,
  }));

  return {
    scenario: sanitizedScenario,
    eventLibrary: sanitizedEventLibrary,
    members: sanitizedMembers,
    budgetRules: sanitizedBudgetRules,
    warnings,
  };
};

const getCashflowRefs = (entry: CashflowItem): WarningRef => {
  if (entry.source === "event") {
    return { eventId: entry.sourceId, month: entry.month };
  }
  if (entry.source === "budget") {
    return { ruleId: entry.sourceId, month: entry.month };
  }
  if (entry.source === "position") {
    return { positionId: entry.sourceId, month: entry.month };
  }
  return { month: entry.month };
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
  warnings: CompilerWarning[]
): ProjectionInput["events"] =>
  cashflows
    .filter((entry) => entry.amount !== 0)
    .filter(
      (entry) => entry.category !== "buy_home" && entry.category !== "insurance_product"
    )
    .flatMap((entry) => {
      const normalized = normalizeMonthStrict(entry.month);
      if (!normalized.ok) {
        warnings.push(
          buildWarning({
            code: WarningCode.MonthInvalid,
            severity: "warning",
            messageKey: "warnings.monthInvalid",
            defaultMessage: `Skipped cashflow with invalid month ${entry.month}.`,
            refs: getCashflowRefs(entry),
            debug: {
              sourceId: entry.sourceId,
              category: entry.category,
              reason: normalized.reason,
            },
          })
        );
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
  warnings: CompilerWarning[]
) =>
  ledger.flatMap((entry) => {
    const normalized = normalizeMonthStrict(entry.month);
    if (!normalized.ok) {
      warnings.push(
        buildWarning({
          code: WarningCode.MonthInvalid,
          severity: "warning",
          messageKey: "warnings.monthInvalid",
          defaultMessage: `Skipped cashflow with invalid month ${entry.month}.`,
          refs: getCashflowRefs(entry),
          debug: {
            sourceId: entry.sourceId,
            category: entry.category,
            reason: normalized.reason,
          },
        })
      );
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
  const warnings: CompilerWarning[] = [];
  const {
    scenario: sanitizedScenario,
    eventLibrary: sanitizedEventLibrary,
    members: sanitizedMembers,
    budgetRules: sanitizedBudgetRules,
    warnings: sanitizeWarnings,
  } = sanitizeScenarioForProjection({
    scenario,
    eventLibrary,
    members: options.members,
    budgetRules: options.budgetRules,
  });
  warnings.push(...sanitizeWarnings);
  const strict = options.strict ?? true;
  const resolvedEvents =
    options.eventsOverride ??
    buildScenarioTimelineEvents(sanitizedScenario, sanitizedEventLibrary);
  const enabledEvents = resolvedEvents.filter((event) => event.enabled);
  const earliestStartMonth = getEarliestStartMonth(enabledEvents);
  const buyHomeEvent = getEarliestBuyHomeEvent(enabledEvents);
  const homePositions = sanitizedScenario.positions?.homes;
  const legacyHome = sanitizedScenario.positions?.home ?? null;
  const resolvedHomePositions =
    homePositions ?? (legacyHome ? [legacyHome] : []);
  const warnInvalidMonth = (
    label: string,
    value: string,
    refs?: WarningRef,
    reason?: string,
    debug?: Record<string, unknown>
  ) => {
    warnings.push(
      buildMonthInvalidWarning({
        label,
        value,
        refs,
        reason,
        debug,
      })
    );
  };
  const normalizeRequiredMonth = (
    label: string,
    value: string | null | undefined,
    refs?: WarningRef,
    debug?: Record<string, unknown>
  ): string | null => {
    const raw = value?.trim() ?? "";
    if (!raw) {
      warnInvalidMonth(label, value ?? "", refs, "empty", debug);
      return null;
    }
    const normalized = normalizeMonthStrict(raw);
    if (!normalized.ok) {
      warnInvalidMonth(label, raw, refs, normalized.reason, debug);
      return null;
    }
    return normalized.month;
  };
  const normalizeOptionalMonth = (
    label: string,
    value: string | null | undefined,
    refs?: WarningRef,
    debug?: Record<string, unknown>
  ): string | null => {
    const raw = value?.trim() ?? "";
    if (!raw) {
      return null;
    }
    const normalized = normalizeMonthStrict(raw);
    if (!normalized.ok) {
      warnInvalidMonth(label, raw, refs, normalized.reason, debug);
      return null;
    }
    return normalized.month;
  };
  if (buyHomeEvent && !checkBuyHomeEventMonth(buyHomeEvent)) {
    warnings.push(
      buildWarning({
        code: WarningCode.MonthInvalid,
        severity: "warning",
        messageKey: "warnings.monthInvalid",
        defaultMessage: `buy_home event has invalid startMonth ${buyHomeEvent.startMonth}.`,
        refs: { eventId: buyHomeEvent.id, month: buyHomeEvent.startMonth },
        debug: { reason: "invalid-start-month" },
      })
    );
  }
  if (!resolvedHomePositions.length && buyHomeEvent && strict) {
    throw new Error("buy_home event requires home details in scenario.positions.homes.");
  }
  const normalizeHomeMonths = (home: HomePosition, homeId?: string) => {
    const issues: Array<{ label: string; value: string }> = [];
    const refs = homeId ? { positionId: homeId } : undefined;
    const rental = home.rental?.isRented === false ? undefined : home.rental;
    const normalized: HomePosition = {
      ...home,
      existing: home.existing ? { ...home.existing } : undefined,
      rental: rental ? { ...rental } : undefined,
    };
    if (home.purchaseMonth) {
      const normalizedPurchase = normalizeOptionalMonth(
        "home.purchaseMonth",
        home.purchaseMonth,
        refs
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
        refs
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
    if (rental?.rentStartMonth) {
      const normalizedRentStart = normalizeRequiredMonth(
        "home.rental.rentStartMonth",
        rental.rentStartMonth,
        refs
      );
      if (!normalizedRentStart) {
        issues.push({
          label: "home.rental.rentStartMonth",
          value: rental.rentStartMonth,
        });
      } else if (normalized.rental) {
        normalized.rental.rentStartMonth = normalizedRentStart;
      }
    }
    if (rental?.rentEndMonth) {
      const normalizedRentEnd = normalizeOptionalMonth(
        "home.rental.rentEndMonth",
        rental.rentEndMonth,
        refs
      );
      if (!normalizedRentEnd) {
        issues.push({
          label: "home.rental.rentEndMonth",
          value: rental.rentEndMonth,
        });
      } else if (normalized.rental) {
        normalized.rental.rentEndMonth = normalizedRentEnd;
      }
    }
    if (home.sellMonth) {
      const normalizedSellMonth = normalizeOptionalMonth(
        "home.sellMonth",
        home.sellMonth,
        refs
      );
      if (!normalizedSellMonth) {
        issues.push({ label: "home.sellMonth", value: home.sellMonth });
      } else {
        normalized.sellMonth = normalizedSellMonth;
      }
    }
    if (issues.length > 0) {
      issues.forEach((issue) =>
        warnInvalidMonth(issue.label, issue.value, refs)
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
    sanitizedScenario.assumptions.baseMonth ?? null,
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
    warnInvalidMonth("baseMonth", candidate, undefined, normalized.reason);
  }
  const horizonMonths =
    options.horizonMonths ?? sanitizedScenario.assumptions.horizonMonths ?? 60;
  const initialCash =
    options.initialCash ?? sanitizedScenario.assumptions.initialCash ?? 0;
  const investmentReturnAssumptions =
    sanitizedScenario.assumptions.investmentReturnAssumptions ?? {};
  const normalizePositionMonthOrWarn = (
    label: string,
    value: string | null | undefined,
    refs?: WarningRef
  ): string | null => normalizeRequiredMonth(label, value, refs);
  const normalizeBudgetRules = (rules: BudgetRule[]) =>
    rules.flatMap((rule) => {
      if (
        rule.enabled &&
        rule.applyScope &&
        !appliesToScenario(rule.applyScope, scenario.id)
      ) {
        warnings.push(
          buildWarning({
            code: WarningCode.ApplyScopeMismatch,
            severity: "info",
            messageKey: "warnings.applyScopeMismatch",
            defaultMessage: `Budget rule ${rule.name || rule.id} does not apply to this scenario.`,
            refs: { ruleId: rule.id, scenarioId: scenario.id },
          })
        );
      }
      const startMonth = normalizeOptionalMonth(
        "budgetRule.startMonth",
        rule.startMonth,
        { ruleId: rule.id, month: rule.startMonth ?? undefined }
      );
      if (rule.startMonth && !startMonth) {
        return [];
      }
      const endMonth = normalizeOptionalMonth(
        "budgetRule.endMonth",
        rule.endMonth,
        { ruleId: rule.id, month: rule.endMonth ?? undefined }
      );
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
    sanitizedScenario.assumptions.includeBudgetRulesInProjection ?? true;
  const members = sanitizedMembers;
  const cashflowLedger = compileScenarioCashflows({
    scenario: sanitizedScenario,
    eventLibrary: sanitizedEventLibrary,
    signByType: getEventSign,
    members,
    warnings,
  });
  const eventLedger = eventCashflowsToLedger(cashflowLedger);
  const budgetRules = sanitizedBudgetRules.length
    ? sanitizedBudgetRules
    : options.budgetRules ?? [];
  const normalizedBudgetRules = normalizeBudgetRules(budgetRules);
  const budgetLedger = includeBudgetRulesInProjection
    ? compileAllBudgetRules(sanitizedScenario, normalizedBudgetRules, members)
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
  const smartInvestPolicy = sanitizedScenario.assumptions.smartInvest;
  const smartInvestInvestments =
    smartInvestPolicy?.enabled
      ? compileSmartInvest({
          baseMonth,
          horizonMonths,
          scenario: sanitizedScenario,
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
  const sellCashflows = compileSellLifecycle(sanitizedScenario)
    .flatMap((entry) => {
      const normalized = normalizeMonthStrict(entry.month);
      if (!normalized.ok) {
        warnings.push(
          buildWarning({
            code: WarningCode.MonthInvalid,
            severity: "warning",
            messageKey: "warnings.monthInvalid",
            defaultMessage: `Skipped cashflow with invalid month ${entry.month}.`,
            refs: { positionId: entry.sourceId, month: entry.month },
            debug: { sourceId: entry.sourceId, reason: normalized.reason },
          })
        );
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
  const homePurchaseCandidates = validatedHomes.flatMap((home) => {
    const mode = home.mode ?? "new_purchase";
    if (mode === "existing") {
      return [];
    }
    if (!home.purchaseMonth) {
      return [];
    }
    return [
      {
        positionId: home.id,
        month: home.purchaseMonth,
      },
    ];
  });
  const homeExpenseKeywords = [
    "down payment",
    "downpayment",
    "closing",
    "closing cost",
    "home purchase",
    "mortgage fee",
    "escrow",
  ];
  const isPotentialHomeExpenseEvent = (event: TimelineEvent) => {
    if (event.type === "buy_home") {
      return true;
    }
    const haystack = `${event.name ?? ""} ${event.type ?? ""}`.toLowerCase();
    return homeExpenseKeywords.some((keyword) => haystack.includes(keyword));
  };
  if (homePurchaseCandidates.length > 0) {
    enabledEvents.forEach((event) => {
      if (!event.oneTimeAmount || Math.abs(event.oneTimeAmount) === 0) {
        return;
      }
      if (Math.abs(event.monthlyAmount ?? 0) > 0) {
        return;
      }
      if (getEventSign(event.type) !== -1) {
        return;
      }
      if (!isPotentialHomeExpenseEvent(event)) {
        return;
      }
      const normalized = normalizeMonthStrict(event.startMonth);
      if (!normalized.ok) {
        return;
      }
      homePurchaseCandidates.forEach((homePurchase) => {
        if (normalized.month !== homePurchase.month) {
          return;
        }
        warnings.push(
          buildWarning({
            code: WarningCode.DoubleCountingHomeEvent,
            severity: "warning",
            messageKey: "warnings.doubleCountingHomeEvent",
            defaultMessage: `Home purchase may double-count with one-off event ${event.name ?? event.id ?? ""}.`,
            refs: {
              positionId: homePurchase.positionId,
              eventId: event.id,
              month: homePurchase.month,
            },
            debug: { eventType: event.type },
          })
        );
      });
    });
  }

  const resolveHomeAppreciationPct = (home: HomePosition, assumptions: ScenarioAssumptions) =>
    home.appreciationMode === "GLOBAL"
      ? assumptions.propertyAppreciationPct ?? home.annualAppreciationPct
      : home.annualAppreciationPct;

  const resolveRentalGrowthPct = (
    rental: RentalDetails | undefined,
    assumptions: ScenarioAssumptions
  ) => {
    if (!rental) {
      return 0;
    }
    return rental.rentGrowthMode === "GLOBAL"
      ? assumptions.rentAnnualGrowthPct ?? rental.rentAnnualGrowthPct ?? 0
      : rental.rentAnnualGrowthPct ?? 0;
  };

  const resolveCarDepreciationPct = (car: CarPosition, assumptions: ScenarioAssumptions) =>
    car.depreciationMode === "GLOBAL"
      ? Math.abs(assumptions.carDepreciationRatePct ?? car.annualDepreciationRatePct ?? 0)
      : car.annualDepreciationRatePct ?? 0;
  const mappedHomes =
    validatedHomes.length > 0
      ? validatedHomes.map((home) => {
          const mode = home.mode ?? "new_purchase";
          const usage = home.usage ?? "primary";
          const rentalDetails = home.rental?.isRented === false ? undefined : home.rental;
          const rental = rentalDetails
            ? {
                rentMonthly: rentalDetails.rentMonthly,
                rentStartMonth: rentalDetails.rentStartMonth,
                rentEndMonth: rentalDetails.rentEndMonth ?? undefined,
                rentAnnualGrowth:
                  resolveRentalGrowthPct(rentalDetails, scenario.assumptions) / 100,
                vacancyRate: (rentalDetails.vacancyRatePct ?? 0) / 100,
              }
            : undefined;

          if (mode === "existing" && home.existing) {
            return {
              id: home.id,
              usage,
              mode,
              purchasePrice: home.purchasePrice ?? home.existing.marketValue,
              sellMonth: home.sellMonth,
              annualAppreciation:
                resolveHomeAppreciationPct(home, scenario.assumptions) / 100,
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
            annualAppreciation:
              resolveHomeAppreciationPct(home, scenario.assumptions) / 100,
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
          normalizePositionMonthOrWarn(
            "investment.startMonth",
            investment.startMonth ?? baseMonth,
            { positionId: investment.id, month: investment.startMonth ?? baseMonth }
          );
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
            positionId: insurance.id,
            month: insurance.startMonth ?? baseMonth,
          }
        );
        if (!startMonth) {
          return [];
        }
        const endMonth = insurance.endMonth
          ? normalizeOptionalMonth("insurance.endMonth", insurance.endMonth, {
              positionId: insurance.id,
              month: insurance.endMonth,
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
          positionId: loan.id,
          month: loan.startMonth,
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
          { positionId: car.id, month: car.purchaseMonth }
        );
        if (!purchaseMonth) {
          return [];
        }
        const sellMonth = car.sellMonth
          ? normalizeOptionalMonth("car.sellMonth", car.sellMonth, {
              positionId: car.id,
              month: car.sellMonth,
            })
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
            annualDepreciationRate:
              resolveCarDepreciationPct(car, scenario.assumptions) / 100,
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
              positionId: bucket.id,
              month: bucket.asOfMonth,
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
        warnings.push(
          buildWarning({
            code: WarningCode.DoubleCountingPosition,
            severity: "warning",
            messageKey: "warnings.doubleCountingPosition",
            defaultMessage: `Potential double-count detected for loan ${loan.id ?? ""}.`,
            refs: { positionId: loan.id },
            debug: { positionType: "loan" },
          })
        );
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
        warnings.push(
          buildWarning({
            code: WarningCode.DoubleCountingPosition,
            severity: "warning",
            messageKey: "warnings.doubleCountingPosition",
            defaultMessage: `Potential double-count detected for car ${car.id ?? ""}.`,
            refs: { positionId: car.id },
            debug: { positionType: "car" },
          })
        );
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
        warnings.push(
          buildWarning({
            code: WarningCode.DoubleCountingPosition,
            severity: "warning",
            messageKey: "warnings.doubleCountingPosition",
            defaultMessage: `Potential double-count detected for investment ${investment.id ?? ""}.`,
            refs: { positionId: investment.id },
            debug: { positionType: "investment" },
          })
        );
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
    sanitized: {
      scenario: sanitizedScenario,
      eventLibrary: sanitizedEventLibrary,
      members: sanitizedMembers,
      budgetRules: sanitizedBudgetRules,
      warnings: sanitizeWarnings,
    },
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
