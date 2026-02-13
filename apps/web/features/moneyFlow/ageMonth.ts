import { addMonths, monthsBetween } from "../../src/domain/members/age";

export const clampAgeMonths = (years?: number | null, months?: number | null): number => {
  const safeYears = Number.isFinite(years) ? Math.max(0, Math.floor(years as number)) : 0;
  const safeMonths = Number.isFinite(months) ? Math.max(0, Math.floor(months as number)) : 0;
  return safeYears * 12 + (safeMonths % 12);
};

export const splitAgeMonths = (value: number): { years: number; months: number } => {
  const normalized = Math.max(0, Math.floor(value));
  return { years: Math.floor(normalized / 12), months: normalized % 12 };
};

export const ageToMonth = (
  birthMonth: string | undefined,
  years?: number | null,
  months?: number | null
): string | null => {
  if (!birthMonth) {
    return null;
  }
  return addMonths(birthMonth, clampAgeMonths(years, months));
};

export const monthToAge = (
  birthMonth: string | undefined,
  targetMonth: string | undefined
): { years: number; months: number } | null => {
  if (!birthMonth || !targetMonth) {
    return null;
  }
  const totalMonths = monthsBetween(birthMonth, targetMonth);
  if (!Number.isFinite(totalMonths) || totalMonths < 0) {
    return null;
  }
  return splitAgeMonths(totalMonths);
};

export const formatFriendlyMonth = (month: string): string => {
  const [year, monthValue] = month.split("-");
  return `${year}年${Number(monthValue)}月`;
};

