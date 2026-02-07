import { z } from "zod";
import type { ScenarioMember } from "../store/scenarioStore";

export type MonthStr =
  `${number}-${"01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12"}`;

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export const MonthStrSchema: z.ZodType<MonthStr> = z
  .string()
  .regex(monthPattern) as z.ZodType<MonthStr>;

export type DateRef =
  | { mode: "MONTH"; month: MonthStr }
  | { mode: "AGE"; memberId: string; ageYears: number };

export type DateRefDraft =
  | { mode: "MONTH"; month: string }
  | { mode: "AGE"; memberId: string; ageYears: number };

export const DateRefSchema: z.ZodType<DateRef> = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("MONTH"), month: MonthStrSchema }),
  z.object({
    mode: z.literal("AGE"),
    memberId: z.string(),
    ageYears: z.number().int().min(0),
  }),
]) as z.ZodType<DateRef>;

export const isMonthStr = (value: string): value is MonthStr => monthPattern.test(value);

export const parseMonthStr = (month: MonthStr): { y: number; m: number } => {
  const [y, m] = month.split("-").map(Number);
  return { y, m };
};

export const formatMonthStr = (y: number, m: number): MonthStr =>
  `${y}-${String(m).padStart(2, "0")}` as MonthStr;

export const addMonths = (month: MonthStr, deltaMonths: number): MonthStr => {
  const { y, m } = parseMonthStr(month);
  const totalMonths = y * 12 + (m - 1) + deltaMonths;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return formatMonthStr(nextYear, nextMonth);
};

export const resolveDateRef = (
  dateRef: DateRef,
  membersById: Record<string, ScenarioMember | undefined>
): MonthStr | null => {
  if (dateRef.mode === "MONTH") {
    return dateRef.month;
  }

  const member = membersById[dateRef.memberId];
  if (!member?.birthMonth || !isMonthStr(member.birthMonth)) {
    return null;
  }

  return addMonths(member.birthMonth, dateRef.ageYears * 12);
};

export const resolveDateRefDraft = (
  dateRef: DateRefDraft,
  membersById: Record<string, ScenarioMember | undefined>
): MonthStr | null => {
  if (dateRef.mode === "MONTH") {
    return isMonthStr(dateRef.month) ? dateRef.month : null;
  }
  return resolveDateRef(dateRef, membersById);
};

export const canRepresentByWholeYears = (
  targetMonth: MonthStr,
  birthMonth: MonthStr
): boolean => parseMonthStr(targetMonth).m === parseMonthStr(birthMonth).m;

export const monthToAgeYearsIfAligned = (
  targetMonth: MonthStr,
  birthMonth: MonthStr
): number | null => {
  if (!canRepresentByWholeYears(targetMonth, birthMonth)) {
    return null;
  }
  const targetYear = parseMonthStr(targetMonth).y;
  const birthYear = parseMonthStr(birthMonth).y;
  return Math.max(targetYear - birthYear, 0);
};

export const toMonthDateRef = (month: string): DateRef | null =>
  isMonthStr(month) ? { mode: "MONTH", month } : null;

export const toDateRef = (dateRef: DateRefDraft): DateRef | null => {
  if (dateRef.mode === "MONTH") {
    return toMonthDateRef(dateRef.month);
  }
  return { mode: "AGE", memberId: dateRef.memberId, ageYears: dateRef.ageYears };
};
