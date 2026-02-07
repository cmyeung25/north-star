import type { Scenario, ScenarioMember } from "../../store/scenarioStore";
import type { EventDefinition, ScenarioEventRef } from "./types";
import { buildScenarioEventViews, resolveEventRule } from "./utils";
import { buildMonthRange, monthIndex } from "@north-star/engine";
import { normalizeMonthStrict } from "../../utils/month";
import {
  buildSalaryScheduleEntries,
  resolveSalaryEndMonth,
  resolveSalaryStepMonth,
} from "./salary";
import { WarningCode, type CompilerWarning } from "../warnings/types";

export type MonthlyCashflowPoint = {
  month: string;
  amount: number;
  sourceEventId: string;
};

export type ScenarioCashflowEntry = {
  month: string;
  amountSigned: number;
  sourceEventId: string;
  refId: string;
  title: string;
  category: string;
  parentId?: string;
};

type CashflowCompilerOptions = {
  definition: EventDefinition;
  ref: ScenarioEventRef;
  assumptions: Pick<Scenario["assumptions"], "baseMonth" | "horizonMonths">;
  signByType: (type: EventDefinition["type"]) => 1 | -1;
  members?: ScenarioMember[];
  warnings?: CompilerWarning[];
};

const applySignedAmount = (value: number | null | undefined, sign: 1 | -1) => {
  const absValue = Math.abs(value ?? 0);
  return absValue === 0 ? 0 : sign * absValue;
};

const buildScheduleMap = (
  schedule?: Array<{ month: string; amount: number }>
): Record<string, number> =>
  (schedule ?? []).reduce<Record<string, number>>((result, entry) => {
    result[entry.month] = Math.abs(entry.amount ?? 0);
    return result;
  }, {});

const pushWarning = (
  warnings: CompilerWarning[] | undefined,
  warning: CompilerWarning
) => {
  warnings?.push(warning);
};

const warnInvalidMonth = (params: {
  warnings: CompilerWarning[] | undefined;
  label: string;
  value: string;
  reason?: string;
  eventId: string;
  month?: string;
  debug?: Record<string, unknown>;
}) => {
  pushWarning(params.warnings, {
    code: WarningCode.MonthInvalid,
    severity: "warning",
    messageKey: "warnings.monthInvalid",
    defaultMessage: `${params.label} has invalid month ${params.value}.`,
    refs: { eventId: params.eventId, month: params.month ?? params.value },
    debug: { label: params.label, rawValue: params.value, reason: params.reason, ...params.debug },
  });
};

const warnSalaryLadderInvalid = (params: {
  warnings: CompilerWarning[] | undefined;
  eventId: string;
  debug?: Record<string, unknown>;
}) => {
  pushWarning(params.warnings, {
    code: WarningCode.SalaryLadderInvalid,
    severity: "warning",
    messageKey: "warnings.salaryLadderInvalid",
    defaultMessage: "Salary ladder could not be compiled; salary steps were skipped.",
    refs: { eventId: params.eventId },
    debug: params.debug,
  });
};

const resolveMonthRange = ({
  baseMonth,
  horizonMonths,
  startMonth,
  endMonth,
}: {
  baseMonth: string;
  horizonMonths: number;
  startMonth: string;
  endMonth?: string | null;
}) => {
  const startIndex = monthIndex(baseMonth, startMonth);
  const endIndex = endMonth
    ? monthIndex(baseMonth, endMonth)
    : horizonMonths - 1;
  const rangeStart = Math.max(0, startIndex);
  const rangeEnd = Math.min(horizonMonths - 1, endIndex);

  if (rangeStart > rangeEnd) {
    return null;
  }

  return { startIndex, rangeStart, rangeEnd };
};

export const compileEventToMonthlyCashflowSeries = ({
  definition,
  ref,
  assumptions,
  signByType,
  members,
  warnings,
}: CashflowCompilerOptions): MonthlyCashflowPoint[] => {
  if (definition.kind !== "cashflow") {
    return [];
  }

  if (!ref.enabled) {
    return [];
  }

  const effectiveRule = resolveEventRule(definition, ref, { members });
  const baseMonthRaw = assumptions.baseMonth ?? effectiveRule.startMonth ?? null;
  const horizonMonths = assumptions.horizonMonths ?? 0;

  if (!baseMonthRaw || horizonMonths <= 0) {
    return [];
  }
  const normalizedBase = normalizeMonthStrict(baseMonthRaw);
  if (!normalizedBase.ok) {
    warnInvalidMonth({
      warnings,
      label: "event.baseMonth",
      value: baseMonthRaw,
      reason: normalizedBase.reason,
      eventId: definition.id,
    });
    return [];
  }
  const baseMonth = normalizedBase.month;

  const sign = signByType(definition.type);
  const member = definition.memberId
    ? members?.find((entry) => entry.id === definition.memberId)
    : undefined;

  if (effectiveRule.startAt?.mode === "AGE" && !effectiveRule.startMonth) {
    throw new Error(`Missing birth month for age-based start: ${definition.id}`);
  }
  if (effectiveRule.endAt?.mode === "AGE" && !effectiveRule.endMonth) {
    throw new Error(`Missing birth month for age-based end: ${definition.id}`);
  }

  const rawEndMonth = effectiveRule.endMonth ?? "";
  const normalizedEnd =
    typeof rawEndMonth === "string" && rawEndMonth.trim() !== ""
      ? normalizeMonthStrict(rawEndMonth)
      : null;
  if (normalizedEnd && !normalizedEnd.ok) {
    warnInvalidMonth({
      warnings,
      label: "event.endMonth",
      value: rawEndMonth,
      reason: normalizedEnd.reason,
      eventId: definition.id,
      month: rawEndMonth,
    });
    return [];
  }

  const resolvedEndMonth = resolveSalaryEndMonth({
    endMonth: normalizedEnd?.ok ? normalizedEnd.month : null,
    endAtAgeYears: definition.endAtAgeYears,
    member,
    baseMonth,
  });

  const isSalarySubtype = (definition.incomeSubtype ?? "salary") === "salary";
  const isSalaryEvent = definition.type === "salary" && isSalarySubtype;

  if (isSalaryEvent) {
    if (!effectiveRule.startMonth) {
      return [];
    }
    const normalizedStart = normalizeMonthStrict(effectiveRule.startMonth);
    if (!normalizedStart.ok) {
      warnInvalidMonth({
        warnings,
        label: "event.startMonth",
        value: effectiveRule.startMonth,
        reason: normalizedStart.reason,
        eventId: definition.id,
        month: effectiveRule.startMonth,
      });
      return [];
    }

    const months = buildMonthRange(baseMonth, horizonMonths);
    if (months.length === 0) {
      return [];
    }
    const horizonEndMonth = months[months.length - 1];
    const effectiveEndMonth = resolvedEndMonth ?? horizonEndMonth;
    const range = resolveMonthRange({
      baseMonth,
      horizonMonths,
      startMonth: normalizedStart.month,
      endMonth: effectiveEndMonth,
    });
    if (!range) {
      warnSalaryLadderInvalid({
        warnings,
        eventId: definition.id,
        debug: {
          reason: "empty-range",
          startMonth: normalizedStart.month,
          endMonth: effectiveEndMonth,
        },
      });
      return [];
    }

    const invalidStepIds = (effectiveRule.salarySteps ?? [])
      .filter((step) => {
        const resolved = resolveSalaryStepMonth({
          step,
          member,
          baseMonth,
        });
        if (resolved) {
          return false;
        }
        if (step.basis === "month") {
          const raw = step.startMonth ?? "";
          const normalized = normalizeMonthStrict(raw);
          if (!normalized.ok) {
            warnInvalidMonth({
              warnings,
              label: "salaryStep.startMonth",
              value: raw,
              reason: normalized.reason,
              eventId: definition.id,
              month: raw,
              debug: { stepId: step.id },
            });
          }
        }
        return true;
      })
      .map((step) => step.id);
    if (invalidStepIds.length > 0) {
      warnSalaryLadderInvalid({
        warnings,
        eventId: definition.id,
        debug: { reason: "invalid-step", stepIds: invalidStepIds },
      });
    }

    const salarySchedule = buildSalaryScheduleEntries({
      baseMonth,
      horizonMonths,
      eventStartMonth: normalizedStart.month,
      eventEndMonth: resolvedEndMonth,
      annualGrowthPct: effectiveRule.annualGrowthPct ?? 0,
      member,
      steps: effectiveRule.salarySteps ?? [],
      baseMonthlyAmount: effectiveRule.monthlyAmount ?? 0,
    });

    if (salarySchedule.length === 0) {
      warnSalaryLadderInvalid({
        warnings,
        eventId: definition.id,
        debug: {
          reason: "empty-schedule",
          startMonth: normalizedStart.month,
          endMonth: resolvedEndMonth,
          baseMonthlyAmount: effectiveRule.monthlyAmount ?? 0,
          stepCount: effectiveRule.salarySteps?.length ?? 0,
        },
      });
      return [];
    }

    const scheduleMap = buildScheduleMap(salarySchedule);
    const series: MonthlyCashflowPoint[] = [];
    for (let i = range.rangeStart; i <= range.rangeEnd; i += 1) {
      const month = months[i];
      series.push({
        month,
        amount: applySignedAmount(scheduleMap[month] ?? 0, sign),
        sourceEventId: definition.id,
      });
    }
    return series;
  }

  if (effectiveRule.mode === "schedule") {
    (effectiveRule.schedule ?? []).forEach((entry) => {
      const normalized = normalizeMonthStrict(entry.month);
      if (!normalized.ok) {
        warnInvalidMonth({
          warnings,
          label: "event.schedule.month",
          value: entry.month,
          reason: normalized.reason,
          eventId: definition.id,
          month: entry.month,
        });
      }
    });
    const scheduleMap = buildScheduleMap(effectiveRule.schedule);
    const months = buildMonthRange(baseMonth, horizonMonths);
    return months.map((month) => ({
      month,
      amount: applySignedAmount(scheduleMap[month] ?? 0, sign),
      sourceEventId: definition.id,
    }));
  }

  if (!effectiveRule.startMonth) {
    return [];
  }

  const normalizedStart = normalizeMonthStrict(effectiveRule.startMonth);
  if (!normalizedStart.ok) {
    warnInvalidMonth({
      warnings,
      label: "event.startMonth",
      value: effectiveRule.startMonth,
      reason: normalizedStart.reason,
      eventId: definition.id,
      month: effectiveRule.startMonth,
    });
    return [];
  }
  const startMonth = normalizedStart.month;
  const endMonth = resolvedEndMonth;

  const monthlyAmount = Math.abs(effectiveRule.monthlyAmount ?? 0);
  const oneTimeAmount = Math.abs(effectiveRule.oneTimeAmount ?? 0);
  const annualGrowthPct = effectiveRule.annualGrowthPct ?? 0;
  const monthlyFactor = Math.pow(1 + annualGrowthPct / 100, 1 / 12);

  const range = resolveMonthRange({
    baseMonth,
    horizonMonths,
    startMonth,
    endMonth,
  });
  if (!range) {
    return [];
  }

  const months = buildMonthRange(baseMonth, horizonMonths);
  const series: MonthlyCashflowPoint[] = [];

  for (let i = range.rangeStart; i <= range.rangeEnd; i += 1) {
    const monthsSinceStart = i - range.startIndex;
    const grownMonthlyAmount = monthlyAmount * Math.pow(monthlyFactor, monthsSinceStart);
    let amount = applySignedAmount(grownMonthlyAmount, sign);

    if (i === range.startIndex && oneTimeAmount !== 0) {
      amount += applySignedAmount(oneTimeAmount, sign);
    }

    series.push({
      month: months[i],
      amount,
      sourceEventId: definition.id,
    });
  }

  return series;
};

type ScenarioCompilerOptions = {
  scenario: Scenario;
  eventLibrary: EventDefinition[];
  signByType: (type: EventDefinition["type"]) => 1 | -1;
  members?: ScenarioMember[];
  warnings?: CompilerWarning[];
};

export const compileScenarioCashflows = ({
  scenario,
  eventLibrary,
  signByType,
  members,
  warnings,
}: ScenarioCompilerOptions): ScenarioCashflowEntry[] => {
  const assumptions = {
    baseMonth: scenario.assumptions.baseMonth,
    horizonMonths: scenario.assumptions.horizonMonths,
  };
  const resolvedMembers = members ?? [];

  return buildScenarioEventViews(scenario, eventLibrary)
    .filter((view) => view.definition.kind === "cashflow")
    .flatMap((view) =>
      compileEventToMonthlyCashflowSeries({
        definition: view.definition,
        ref: view.ref,
        assumptions,
        signByType,
        members: resolvedMembers,
        warnings,
      }).map((point) => ({
        month: point.month,
        amountSigned: point.amount,
        sourceEventId: view.definition.id,
        refId: view.ref.refId,
        title: view.definition.title,
        category: view.definition.type,
        parentId: view.definition.parentId,
      }))
    );
};
