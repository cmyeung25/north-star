import type { CashflowEvent } from "../../src/domain/scenarioV2/events";

export type CashflowGrowthAssumptionKey =
  | "salaryGrowthRate"
  | "inflationRate"
  | "rentAnnualGrowthPct";

export type CashflowGrowthAssumptions = {
  salaryGrowthRate?: number | null;
  inflationRate?: number | null;
  rentAnnualGrowthPct?: number | null;
};

type CashflowGrowthContext = Pick<
  CashflowEvent,
  "kind" | "cadence" | "tags" | "growthSource"
>;

const rentTags = new Set(["rent", "rental"]);

const isRentRelated = (event: CashflowGrowthContext): boolean => {
  if (event.growthSource === "rentGrowth") {
    return true;
  }
  return (event.tags ?? []).some((tag) => rentTags.has(tag.toLowerCase()));
};

export const resolveCashflowGrowthAssumption = (
  event: CashflowGrowthContext
): CashflowGrowthAssumptionKey | null => {
  if (event.cadence === "oneOff") {
    return null;
  }

  if (isRentRelated(event)) {
    return "rentAnnualGrowthPct";
  }

  if (event.kind === "income") {
    return "salaryGrowthRate";
  }

  return "inflationRate";
};

export const resolveCashflowAssumptionRate = (
  event: CashflowGrowthContext,
  assumptions: CashflowGrowthAssumptions
): number | null => {
  const key = resolveCashflowGrowthAssumption(event);
  if (!key) {
    return null;
  }
  const value = assumptions[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const buildCashflowGrowthPayload = (
  event: CashflowGrowthContext & {
    growthMode: NonNullable<CashflowEvent["growthMode"]>;
    customGrowthRatePct?: number;
  }
): Pick<CashflowEvent, "growthMode" | "customGrowthRatePct" | "growthSource"> => {
  if (event.cadence === "oneOff" || event.growthMode === "none") {
    return {
      growthMode: "none",
      customGrowthRatePct: undefined,
      growthSource: undefined,
    };
  }

  if (event.growthMode === "custom") {
    return {
      growthMode: "custom",
      customGrowthRatePct: event.customGrowthRatePct,
      growthSource: undefined,
    };
  }

  const assumptionKey = resolveCashflowGrowthAssumption(event);
  if (assumptionKey === "inflationRate") {
    return {
      growthMode: "assumption",
      customGrowthRatePct: undefined,
      growthSource: "inflation",
    };
  }
  if (assumptionKey === "rentAnnualGrowthPct") {
    return {
      growthMode: "assumption",
      customGrowthRatePct: undefined,
      growthSource: "rentGrowth",
    };
  }

  return {
    growthMode: "assumption",
    customGrowthRatePct: undefined,
    growthSource: undefined,
  };
};
