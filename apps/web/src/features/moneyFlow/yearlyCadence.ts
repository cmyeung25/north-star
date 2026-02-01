import { isValidMonthKey } from "../../utils/monthKey";

export const resolveYearlyStartMonthKey = (
  monthOfYearValue: string | null,
  baseMonthKey: string | null
) => {
  const monthNumber = Number(monthOfYearValue);
  if (!Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return "";
  }
  const fallbackBase = (() => {
    if (baseMonthKey && isValidMonthKey(baseMonthKey)) {
      return baseMonthKey;
    }
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  })();
  const [yearString, monthString] = fallbackBase.split("-");
  const baseYear = Number(yearString);
  const baseMonthNumber = Number(monthString);
  const resolvedYear = monthNumber >= baseMonthNumber ? baseYear : baseYear + 1;
  return `${resolvedYear}-${String(monthNumber).padStart(2, "0")}`;
};
