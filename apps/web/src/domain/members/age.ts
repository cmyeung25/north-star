import type { ScenarioMember } from "../../store/scenarioStore";

type YearMonth = { year: number; month: number };

const parseYearMonth = (value: string): YearMonth => {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
};

const formatYearMonth = (value: YearMonth): string =>
  `${value.year}-${String(value.month).padStart(2, "0")}`;

export const monthsBetween = (aMonth: string, bMonth: string): number => {
  const a = parseYearMonth(aMonth);
  const b = parseYearMonth(bMonth);
  return (b.year - a.year) * 12 + (b.month - a.month);
};

export const addMonths = (baseMonth: string, delta: number): string => {
  const base = parseYearMonth(baseMonth);
  const totalMonths = base.year * 12 + (base.month - 1) + delta;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return formatYearMonth({ year: nextYear, month: nextMonth });
};

export const getMemberAgeMonths = (
  member: ScenarioMember,
  month: string,
  baseMonth: string
): number => {
  const ageMonths = member.birthMonth
    ? monthsBetween(member.birthMonth, month)
    : Math.round((member.ageAtBaseMonth ?? 0) * 12 + monthsBetween(baseMonth, month));

  return Math.max(ageMonths, 0);
};

export const getMemberAgeYears = (
  member: ScenarioMember,
  month: string,
  baseMonth: string
): number => getMemberAgeMonths(member, month, baseMonth) / 12;
