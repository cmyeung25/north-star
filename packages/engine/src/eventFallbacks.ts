export type EventAssumptions = {
  inflationRate?: number;
  rentAnnualGrowthPct?: number;
  salaryGrowthRate?: number;
};

export type FallbackCandidateEvent = {
  type?: string;
  annualGrowthPct?: number;
};

export const applyEventAssumptionFallbacks = (
  event: FallbackCandidateEvent,
  assumptions: EventAssumptions
): FallbackCandidateEvent => {
  // Fallback rules (MVP): when event growth is missing, use scenario assumptions.
  if (typeof event.annualGrowthPct === "number") {
    return { ...event, annualGrowthPct: event.annualGrowthPct };
  }

  if (event.type === "rent") {
    // Prefer rent-specific growth when available; otherwise fall back to inflation.
    const fallback = assumptions.rentAnnualGrowthPct ?? assumptions.inflationRate;
    return { ...event, annualGrowthPct: fallback };
  }

  if (event.type === "salary") {
    // Salary growth falls back to the salaryGrowthRate assumption.
    return { ...event, annualGrowthPct: assumptions.salaryGrowthRate };
  }

  return { ...event, annualGrowthPct: event.annualGrowthPct };
};
