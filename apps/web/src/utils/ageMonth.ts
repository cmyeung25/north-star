import { monthIndex } from "@north-star/engine";
import { parseMonthStrict } from "./month";

export const ageToYYYYMM = (birthMonth: string, ageInMonths: number): string | null => {
  if (!parseMonthStrict(birthMonth).ok || !Number.isInteger(ageInMonths) || ageInMonths < 0) {
    return null;
  }
  const [year, month] = birthMonth.split("-").map(Number);
  const date = new Date(year, month - 1 + ageInMonths, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const yyyymmToAge = (
  birthMonth: string,
  targetMonth: string
): { years: number; months: number } | null => {
  if (!parseMonthStrict(birthMonth).ok || !parseMonthStrict(targetMonth).ok) {
    return null;
  }
  const ageInMonths = monthIndex(birthMonth, targetMonth);
  if (!Number.isInteger(ageInMonths) || ageInMonths < 0) {
    return null;
  }
  return {
    years: Math.floor(ageInMonths / 12),
    months: ageInMonths % 12,
  };
};
