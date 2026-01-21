export type MonthInputStatus = "valid" | "partial" | "empty" | "invalid";

export const isValidMonthStr = (value: string): boolean =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export const normalizeMonthStrict = (
  input: string
): { ok: true; month: string } | { ok: false; reason: string } => {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { ok: false, reason: "empty" };
  }

  const match = /^(\d{4})-(\d{1,2})$/.exec(trimmed);
  if (!match) {
    return { ok: false, reason: "invalid-format" };
  }

  const monthValue = Number(match[2]);
  if (!Number.isInteger(monthValue) || monthValue < 1 || monthValue > 12) {
    return { ok: false, reason: "invalid-month" };
  }

  return {
    ok: true,
    month: `${match[1]}-${String(monthValue).padStart(2, "0")}`,
  };
};

export const isMonthComplete = (input: string): boolean =>
  /^\d{4}-\d{2}$/.test(input.trim());

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

export type OnboardingMonthNormalization =
  | { ok: true; month?: string }
  | { ok: false; reason: string };

export const normalizeOnboardingMonth = (
  value: string | null | undefined,
  fallback?: string | null
): OnboardingMonthNormalization => {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") {
    if (!fallback) {
      return { ok: true, month: undefined };
    }
    const normalizedFallback = normalizeMonthStrict(fallback);
    if (!normalizedFallback.ok) {
      return { ok: false, reason: normalizedFallback.reason };
    }
    return { ok: true, month: normalizedFallback.month };
  }

  const normalized = normalizeMonthStrict(trimmed);
  if (!normalized.ok) {
    return { ok: false, reason: normalized.reason };
  }
  return { ok: true, month: normalized.month };
};
