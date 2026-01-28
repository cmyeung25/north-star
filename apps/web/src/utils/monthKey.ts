export type MonthInputStatus = "valid" | "partial" | "empty" | "invalid";

export const isValidMonthKey = (value: string): boolean =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export const normalizeMonthInput = (
  value: string
): { status: MonthInputStatus; month?: string } => {
  const trimmed = value.trim();

  if (trimmed === "") {
    return { status: "empty" };
  }

  const partialMatch = /^(\d{0,4})(?:-(\d{0,2})?)?$/.exec(trimmed);
  if (!partialMatch) {
    return { status: "invalid" };
  }

  if (isValidMonthKey(trimmed)) {
    return { status: "valid", month: trimmed };
  }

  const [, yearPart, monthPart] = partialMatch;
  if (!yearPart || yearPart.length < 4) {
    return { status: "partial" };
  }

  if (!monthPart || monthPart.length === 0) {
    return { status: "partial" };
  }

  if (monthPart.length === 1) {
    return { status: "partial" };
  }

  const monthValue = Number(monthPart);
  if (Number.isNaN(monthValue) || monthValue < 1 || monthValue > 12) {
    return { status: "invalid" };
  }

  return {
    status: "valid",
    month: `${yearPart}-${monthPart.padStart(2, "0")}`,
  };
};

export const compareMonthKey = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  if (!isValidMonthKey(a) || !isValidMonthKey(b)) {
    return 0;
  }
  return a < b ? -1 : 1;
};

export const clampMonthRange = (
  startMonth?: string | null,
  endMonth?: string | null
): { startMonth?: string | null; endMonth?: string | null } => {
  if (!startMonth || !endMonth) {
    return { startMonth, endMonth };
  }
  if (!isValidMonthKey(startMonth) || !isValidMonthKey(endMonth)) {
    return { startMonth, endMonth };
  }
  if (compareMonthKey(startMonth, endMonth) <= 0) {
    return { startMonth, endMonth };
  }
  return { startMonth, endMonth: startMonth };
};
