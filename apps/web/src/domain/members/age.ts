import type { ScenarioMember } from "../../store/scenarioStore";

type YearMonth = { year: number; month: number };

const parseYearMonth = (value: string): YearMonth => {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
};

export const monthsBetween = (aMonth: string, bMonth: string): number => {
  const a = parseYearMonth(aMonth);
  const b = parseYearMonth(bMonth);
  return (b.year - a.year) * 12 + (b.month - a.month);
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
