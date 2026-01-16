import type { Scenario } from "../../store/scenarioStore";
import type { EventDefinition, ScenarioEventRef } from "./types";
import { buildScenarioEventViews, resolveEventRule } from "./utils";
import { buildMonthRange, monthIndex } from "@north-star/engine";

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
}: CashflowCompilerOptions): MonthlyCashflowPoint[] => {
  if (definition.kind !== "cashflow") {
    return [];
  }

  if (!ref.enabled) {
    return [];
  }

  const effectiveRule = resolveEventRule(definition, ref);
  const baseMonth = assumptions.baseMonth ?? effectiveRule.startMonth ?? null;
  const horizonMonths = assumptions.horizonMonths ?? 0;

  if (!baseMonth || horizonMonths <= 0) {
    return [];
  }

  const sign = signByType(definition.type);

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

  const monthlyAmount = Math.abs(effectiveRule.monthlyAmount ?? 0);
  const oneTimeAmount = Math.abs(effectiveRule.oneTimeAmount ?? 0);
  const annualGrowthPct = effectiveRule.annualGrowthPct ?? 0;
  const monthlyFactor = Math.pow(1 + annualGrowthPct / 100, 1 / 12);

  const startIndex = monthIndex(baseMonth, effectiveRule.startMonth);
  const endIndex = effectiveRule.endMonth
    ? monthIndex(baseMonth, effectiveRule.endMonth)
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
};

export const compileScenarioCashflows = ({
  scenario,
  eventLibrary,
  signByType,
}: ScenarioCompilerOptions): ScenarioCashflowEntry[] => {
  const assumptions = {
    baseMonth: scenario.assumptions.baseMonth,
    horizonMonths: scenario.assumptions.horizonMonths,
  };

  return buildScenarioEventViews(scenario, eventLibrary)
    .filter((view) => view.definition.kind === "cashflow")
    .flatMap((view) =>
      compileEventToMonthlyCashflowSeries({
        definition: view.definition,
        ref: view.ref,
        assumptions,
        signByType,
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
