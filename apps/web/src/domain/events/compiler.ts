import type { Scenario, ScenarioMember } from "../../store/scenarioStore";
import type { EventDefinition, ScenarioEventRef } from "./types";
import { buildScenarioEventViews, resolveEventRule } from "./utils";
import { buildMonthRange, monthIndex } from "@north-star/engine";
import { normalizeMonthStrict } from "../../utils/month";
import { buildSalaryScheduleEntries, resolveSalaryEndMonth } from "./salary";

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

export const compileEventToMonthlyCashflowSeries = ({
  definition,
  ref,
  assumptions,
  signByType,
  members,
}: CashflowCompilerOptions): MonthlyCashflowPoint[] => {
  if (definition.kind !== "cashflow") {
    return [];
  }

  if (!ref.enabled) {
    return [];
  }

  const effectiveRule = resolveEventRule(definition, ref);
  const baseMonthRaw = assumptions.baseMonth ?? effectiveRule.startMonth ?? null;
  const horizonMonths = assumptions.horizonMonths ?? 0;

  if (!baseMonthRaw || horizonMonths <= 0) {
    return [];
  }
  const normalizedBase = normalizeMonthStrict(baseMonthRaw);
  if (!normalizedBase.ok) {
    return [];
  }
  const baseMonth = normalizedBase.month;

  const sign = signByType(definition.type);
  const member = definition.memberId
    ? members?.find((entry) => entry.id === definition.memberId)
    : undefined;

  const rawEndMonth = effectiveRule.endMonth ?? "";
  const normalizedEnd =
    typeof rawEndMonth === "string" && rawEndMonth.trim() !== ""
      ? normalizeMonthStrict(rawEndMonth)
      : null;
  if (normalizedEnd && !normalizedEnd.ok) {
    return [];
  }

  const resolvedEndMonth = resolveSalaryEndMonth({
    endMonth: normalizedEnd?.ok ? normalizedEnd.month : null,
    endAtAgeYears: definition.endAtAgeYears,
    member,
    baseMonth,
  });

  const isSalarySubtype = (definition.incomeSubtype ?? "salary") === "salary";
  const salarySchedule =
    definition.type === "salary" && isSalarySubtype && effectiveRule.salarySteps?.length
      ? buildSalaryScheduleEntries({
          baseMonth,
          horizonMonths,
          eventStartMonth: effectiveRule.startMonth ?? "",
          eventEndMonth: resolvedEndMonth,
          annualGrowthPct: effectiveRule.annualGrowthPct ?? 0,
          member,
          steps: effectiveRule.salarySteps,
          baseMonthlyAmount: effectiveRule.monthlyAmount ?? 0,
        })
      : null;

  if (salarySchedule && salarySchedule.length > 0) {
    const scheduleMap = buildScheduleMap(salarySchedule);
    const months = buildMonthRange(baseMonth, horizonMonths);
    return months.map((month) => ({
      month,
      amount: applySignedAmount(scheduleMap[month] ?? 0, sign),
      sourceEventId: definition.id,
    }));
  }

  if (effectiveRule.mode === "schedule") {
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
    return [];
  }
  const startMonth = normalizedStart.month;
  const endMonth = resolvedEndMonth;

  const monthlyAmount = Math.abs(effectiveRule.monthlyAmount ?? 0);
  const oneTimeAmount = Math.abs(effectiveRule.oneTimeAmount ?? 0);
  const annualGrowthPct = effectiveRule.annualGrowthPct ?? 0;
  const monthlyFactor = Math.pow(1 + annualGrowthPct / 100, 1 / 12);

  const startIndex = monthIndex(baseMonth, startMonth);
  const endIndex = endMonth
    ? monthIndex(baseMonth, endMonth)
    : horizonMonths - 1;
  const rangeStart = Math.max(0, startIndex);
  const rangeEnd = Math.min(horizonMonths - 1, endIndex);

  if (rangeStart > rangeEnd) {
    return [];
  }

  const months = buildMonthRange(baseMonth, horizonMonths);
  const series: MonthlyCashflowPoint[] = [];

  for (let i = rangeStart; i <= rangeEnd; i += 1) {
    const monthsSinceStart = i - startIndex;
    const grownMonthlyAmount = monthlyAmount * Math.pow(monthlyFactor, monthsSinceStart);
    let amount = applySignedAmount(grownMonthlyAmount, sign);

    if (i === startIndex && oneTimeAmount !== 0) {
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
};

export const compileScenarioCashflows = ({
  scenario,
  eventLibrary,
  signByType,
  members,
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
