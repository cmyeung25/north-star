import { describe, expect, it } from "vitest";
import { mapScenarioCashflowToLegacyType, mapTimelineEventToScenarioCashflow } from "../eventMappingRegistry";
import { expenseCategories, incomeSubtypes, structuralEventTypes } from "../eventTaxonomy";
import type { TimelineEvent } from "../../../features/timeline/schema";

const buildTimelineEvent = (overrides: Partial<TimelineEvent>): TimelineEvent => ({
  id: "evt-1",
  type: "salary",
  name: "Event",
  startMonth: "2026-01",
  endMonth: null,
  enabled: true,
  monthlyAmount: 1000,
  oneTimeAmount: 0,
  annualGrowthPct: 0,
  currency: "HKD",
  ...overrides,
});

describe("eventMappingRegistry", () => {
  it("round-trips all income subtypes with stable semantics", () => {
    const subtypeInputs: NonNullable<TimelineEvent["incomeSubtype"]>[] = [
      "salary",
      "bonus",
      "freelance",
      "rental",
      "dividend",
      "interest",
      "other",
    ];

    for (const incomeSubtype of subtypeInputs) {
      const mapped = mapTimelineEventToScenarioCashflow(
        buildTimelineEvent({ type: "salary", incomeSubtype })
      );
      expect(mapped.type).toBe("cashflow");
      expect(mapped.kind).toBe("income");
      expect(mapped.category).toBe(incomeSubtype);
      expect(mapped.mappingMetadata.legacyType).toBe("salary");
      expect(mapScenarioCashflowToLegacyType(mapped)).toBe("salary");
    }
  });

  it("maps expense path and keeps legacy metadata", () => {
    const mapped = mapTimelineEventToScenarioCashflow(
      buildTimelineEvent({ type: "travel", monthlyAmount: 0, oneTimeAmount: 2000 })
    );

    expect(mapped.kind).toBe("expense");
    expect(mapped.cadence).toBe("oneOff");
    expect(mapped.expenseCategory).toBe("travel");
    expect(mapped.mappingMetadata.legacyType).toBe("travel");
    expect(mapScenarioCashflowToLegacyType(mapped)).toBe("travel");
  });

  it("fails fast for unknown legacy type", () => {
    expect(() =>
      mapTimelineEventToScenarioCashflow(
        buildTimelineEvent({ type: "mystery" as TimelineEvent["type"] })
      )
    ).toThrow(/Unknown legacy event type/);
  });

  it("locks taxonomy contract", () => {
    expect(structuralEventTypes).toEqual([
      "cashflow",
      "housing",
      "loan",
      "insurance",
      "adjustment",
    ]);
    expect(incomeSubtypes).toEqual([
      "salary",
      "bonus",
      "freelance",
      "rental",
      "dividend",
      "interest",
      "other",
    ]);
    expect(expenseCategories).toEqual([
      "daily_living",
      "transport",
      "property_ownership",
      "vehicle_ownership",
      "insurance",
      "healthcare",
      "education",
      "family_support",
      "entertainment",
      "travel",
      "tax",
      "debt_repayment",
      "other",
    ]);
  });
});
