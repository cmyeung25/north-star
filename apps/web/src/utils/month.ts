export type MonthInputStatus = "valid" | "partial" | "empty" | "invalid";

export const isValidMonthStr = (value: string): boolean =>
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

  if (isValidMonthStr(trimmed)) {
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
