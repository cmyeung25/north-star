import type { CashflowEvent, HousingEvent, IncomeGrowthMode } from "./events";

const RECURRING_CADENCES = new Set(["monthly", "quarterly", "yearly", "everyNMonths"]);

export const isRecurringCashflowEvent = (event: Pick<CashflowEvent, "cadence">): boolean =>
  RECURRING_CADENCES.has(event.cadence);

export const getDefaultCashflowGrowthMode = (
  event: Pick<CashflowEvent, "cadence" | "kind">
): IncomeGrowthMode => {
  if (!isRecurringCashflowEvent(event)) {
    return "none";
  }
  return "assumption";
};

export const normalizeCashflowGrowth = (event: CashflowEvent): CashflowEvent => {
  const growthMode = event.growthMode ?? getDefaultCashflowGrowthMode(event);
  const nextGrowthSource =
    growthMode === "assumption" && event.kind === "expense"
      ? event.growthSource ?? "inflation"
      : event.growthSource;

  return {
    ...event,
    growthMode,
    growthSource: nextGrowthSource,
    customGrowthRatePct:
      growthMode === "custom" ? event.customGrowthRatePct : undefined,
  };
};

export const resolveHousingGrowthMode = (
  growthMode: HousingEvent["rentGrowthMode"]
): NonNullable<HousingEvent["rentGrowthMode"]> => growthMode ?? "assumption";
