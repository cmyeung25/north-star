import { buildMonthRange } from "@north-star/engine";
import type { ScenarioMember } from "../../store/scenarioStore";
import { normalizeMonthStrict } from "../../utils/month";
import { monthAtAge, monthsBetween } from "../members/age";
import type { EventRuleScheduleEntry, SalaryStep } from "./types";

type SalaryScheduleParams = {
  baseMonth: string;
  horizonMonths: number;
  eventStartMonth: string;
  eventEndMonth?: string | null;
  annualGrowthPct?: number;
  member?: ScenarioMember;
  steps: SalaryStep[];
  baseMonthlyAmount: number;
};

type ResolveStepMonthParams = {
  step: SalaryStep;
  member?: ScenarioMember;
  baseMonth?: string | null;
};

export const resolveSalaryStepMonth = ({
  step,
  member,
  baseMonth,
}: ResolveStepMonthParams): string | null => {
  if (step.basis === "month") {
    const normalized = normalizeMonthStrict(step.startMonth ?? "");
    if (!normalized.ok) {
      return null;
    }
    return normalized.month;
  }

  if (!member || member.kind !== "person") {
    return null;
  }

  if (typeof step.startAgeYears !== "number" || step.startAgeYears < 0) {
    return null;
  }

  if (!baseMonth) {
    return null;
  }

  const normalizedBase = normalizeMonthStrict(baseMonth);
  if (!normalizedBase.ok) {
    return null;
  }

  return monthAtAge(member, step.startAgeYears, normalizedBase.month);
};

export const resolveSalaryEndMonth = (params: {
  endMonth?: string | null;
  endAtAgeYears?: number;
  member?: ScenarioMember;
  baseMonth?: string | null;
}): string | null => {
  const rawEnd = params.endMonth?.trim() ?? "";
  if (rawEnd) {
    const normalized = normalizeMonthStrict(rawEnd);
    return normalized.ok ? normalized.month : null;
  }

  if (!params.member || params.member.kind !== "person") {
    return null;
  }

  if (typeof params.endAtAgeYears !== "number") {
    return null;
  }

  if (!params.baseMonth) {
    return null;
  }

  const normalizedBase = normalizeMonthStrict(params.baseMonth);
  if (!normalizedBase.ok) {
    return null;
  }

  return monthAtAge(params.member, params.endAtAgeYears, normalizedBase.month);
};

export const normalizeSalarySteps = (steps: SalaryStep[]): SalaryStep[] =>
  steps.map((step) => {
    if (step.basis !== "month") {
      return step;
    }
    const normalized = normalizeMonthStrict(step.startMonth ?? "");
    return normalized.ok ? { ...step, startMonth: normalized.month } : step;
  });

export const buildSalaryScheduleEntries = ({
  baseMonth,
  horizonMonths,
  eventStartMonth,
  eventEndMonth,
  annualGrowthPct = 0,
  member,
  steps,
  baseMonthlyAmount,
}: SalaryScheduleParams): EventRuleScheduleEntry[] => {
  const normalizedBase = normalizeMonthStrict(baseMonth);
  const normalizedStart = normalizeMonthStrict(eventStartMonth);
  if (!normalizedBase.ok || !normalizedStart.ok || horizonMonths <= 0) {
    return [];
  }
  const normalizedEnd = eventEndMonth ? normalizeMonthStrict(eventEndMonth) : null;
  const effectiveEnd = normalizedEnd?.ok ? normalizedEnd.month : null;
  const months = buildMonthRange(normalizedBase.month, horizonMonths);
  const monthlyFactor = Math.pow(1 + annualGrowthPct / 100, 1 / 12);
  const baseAmount = Math.abs(baseMonthlyAmount ?? 0);
  const resolvedSteps = steps.flatMap((step, index) => {
    const resolvedMonth = resolveSalaryStepMonth({
      step,
      member,
      baseMonth: normalizedBase.month,
    });
    if (!resolvedMonth) {
      return [];
    }
    return [
      {
        id: step.id,
        startMonth: resolvedMonth,
        monthlyAmount: Math.abs(step.monthlyAmount ?? 0),
        index,
      },
    ];
  });

  const filteredSteps = resolvedSteps.filter((step) => {
    if (step.startMonth < normalizedStart.month) {
      return false;
    }
    if (effectiveEnd && step.startMonth > effectiveEnd) {
      return false;
    }
    return true;
  });

  if (baseAmount <= 0 && filteredSteps.length === 0) {
    return [];
  }

  const dedupedSteps = Array.from(
    filteredSteps.reduce((map, step) => {
      map.set(step.startMonth, step);
      return map;
    }, new Map<string, (typeof filteredSteps)[number]>())
  ).map(([, step]) => step);
  const hasStepAtStart = dedupedSteps.some(
    (step) => step.startMonth === normalizedStart.month
  );
  const allSteps = [
    ...(hasStepAtStart
      ? []
      : [
          {
            id: "base",
            startMonth: normalizedStart.month,
            monthlyAmount: baseAmount,
            index: -1,
          },
        ]),
    ...dedupedSteps,
  ].sort((a, b) => {
    const monthCompare = a.startMonth.localeCompare(b.startMonth);
    if (monthCompare !== 0) {
      return monthCompare;
    }
    return a.index - b.index;
  });

  let stepIndex = 0;
  const schedule: EventRuleScheduleEntry[] = [];

  for (const month of months) {
    if (monthsBetween(normalizedStart.month, month) < 0) {
      continue;
    }
    if (effectiveEnd && monthsBetween(effectiveEnd, month) > 0) {
      break;
    }
    while (
      stepIndex + 1 < allSteps.length &&
      monthsBetween(allSteps[stepIndex + 1].startMonth, month) >= 0
    ) {
      stepIndex += 1;
    }
    const step = allSteps[stepIndex];
    const monthsSinceStart = monthsBetween(step.startMonth, month);
    if (monthsSinceStart < 0) {
      continue;
    }
    const amount = step.monthlyAmount * Math.pow(monthlyFactor, monthsSinceStart);
    schedule.push({ month, amount: Math.round(amount) });
  }

  return schedule.filter((entry) => entry.amount > 0);
};
