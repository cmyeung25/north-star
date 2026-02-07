import { z } from "zod";
import type { ScenarioMember } from "../store/scenarioStore";

export type MonthStr = `${number}-${
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12"}`;

export type DateRef =
  | { mode: "MONTH"; month: MonthStr }
  | { mode: "AGE"; memberId: string; ageYears: number };

export const MonthStrSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/) as z.ZodType<MonthStr>;

export const DateRefSchema = z.union([
  z.object({
    mode: z.literal("MONTH"),
    month: MonthStrSchema,
  }),
  z.object({
    mode: z.literal("AGE"),
    memberId: z.string(),
    ageYears: z.number().int().min(0),
  }),
]) as z.ZodType<DateRef>;

export const parseMonthStr = (month: MonthStr): { year: number; month: number } => {
  const [year, monthValue] = month.split("-").map(Number);
  return { year, month: monthValue };
};

export const formatMonthStr = (year: number, month: number): MonthStr => {
  return `${year}-${String(month).padStart(2, "0")}` as MonthStr;
};

export const addMonths = (month: MonthStr, deltaMonths: number): MonthStr => {
  const base = parseMonthStr(month);
  const totalMonths = base.year * 12 + (base.month - 1) + deltaMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return formatMonthStr(nextYear, nextMonth);
};

export type MemberBirthLookup = Record<
  string,
  Pick<ScenarioMember, "birthMonth"> | undefined
>;

export const resolveDateRef = (
  dateRef: DateRef,
  membersById?: MemberBirthLookup
): MonthStr | null => {
  if (dateRef.mode === "MONTH") {
    return dateRef.month;
  }

  if (!membersById) {
    return null;
  }

  const member = membersById[dateRef.memberId];
  if (!member?.birthMonth) {
    return null;
  }

  return addMonths(member.birthMonth as MonthStr, dateRef.ageYears * 12);
};

export const canRepresentByWholeYears = (
  targetMonth: MonthStr,
  birthMonth: MonthStr
): boolean => {
  const [, targetMonthValue] = targetMonth.split("-");
  const [, birthMonthValue] = birthMonth.split("-");
  return targetMonthValue === birthMonthValue;
};

export const monthToAgeYearsIfAligned = (
  targetMonth: MonthStr,
  birthMonth: MonthStr
): number | null => {
  if (!canRepresentByWholeYears(targetMonth, birthMonth)) {
    return null;
  }

  const targetYear = Number(targetMonth.split("-")[0]);
  const birthYear = Number(birthMonth.split("-")[0]);
  return Math.max(targetYear - birthYear, 0);
};

export const areDateRefsEqual = (
  a?: DateRef | null,
  b?: DateRef | null
): boolean => {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (a.mode !== b.mode) {
    return false;
  }
  if (a.mode === "MONTH" && b.mode === "MONTH") {
    return a.month === b.month;
  }
  if (a.mode === "AGE" && b.mode === "AGE") {
    return a.memberId === b.memberId && a.ageYears === b.ageYears;
  }
  return false;
};

export const buildMonthDateRef = (month?: string | null): DateRef | null => {
  if (!month) {
    return null;
  }
  return { mode: "MONTH", month: month as MonthStr };
};
