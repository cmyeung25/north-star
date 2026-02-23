import { describe, expect, it } from "vitest";
import {
  mapLegacyTimelineTypeToScenario,
  mapScenarioCashflowToLegacyType,
  mapTimelineEventToScenarioCashflow,
  migrateScenarioCashflowCategoryLazy,
} from "../eventMappingRegistry";
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

  it("supports legacy -> v2 -> legacy round-trip for all legacy types", () => {
    const legacyTypes: TimelineEvent["type"][] = [
      "salary",
      "custom",
      "rent",
      "travel",
      "tax_benefit",
      "insurance",
      "buy_home",
      "baby",
      "car",
      "insurance_product",
      "insurance_premium",
      "insurance_payout",
      "helper",
      "investment_contribution",
      "investment_withdrawal",
    ];

    for (const legacyType of legacyTypes) {
      const timelineEvent = buildTimelineEvent({
        type: legacyType,
        incomeSubtype: legacyType === "salary" ? "bonus" : undefined,
      });
      const v2Event = mapTimelineEventToScenarioCashflow(timelineEvent);
      expect(mapScenarioCashflowToLegacyType(v2Event)).toBe(legacyType);
    }
  });

  it("lazy-migrates missing category fields for legacy cashflow events", () => {
    const salaryWithoutCategory = mapTimelineEventToScenarioCashflow(
      buildTimelineEvent({ type: "salary", incomeSubtype: "freelance" })
    );
    delete salaryWithoutCategory.category;

    const migratedIncome = migrateScenarioCashflowCategoryLazy(salaryWithoutCategory);
    expect(migratedIncome.category).toBe("freelance");
    expect(mapScenarioCashflowToLegacyType(migratedIncome)).toBe("salary");

    const travelWithoutCategory = mapTimelineEventToScenarioCashflow(
      buildTimelineEvent({ type: "travel" })
    );
    delete travelWithoutCategory.expenseCategory;

    const migratedExpense = migrateScenarioCashflowCategoryLazy(travelWithoutCategory);
    expect(migratedExpense.expenseCategory).toBe("travel");
    expect(mapScenarioCashflowToLegacyType(migratedExpense)).toBe("travel");
  });

  it("preserves category semantics with acceptable legacy downgrade", () => {
    const salaryMapping = mapLegacyTimelineTypeToScenario("salary", "dividend");
    expect(salaryMapping.category).toBe("dividend");

    const taxBenefitMapping = mapLegacyTimelineTypeToScenario("tax_benefit");
    expect(taxBenefitMapping.category).toBe("other");

    const taxBenefitEvent = mapTimelineEventToScenarioCashflow(
      buildTimelineEvent({ type: "tax_benefit", incomeSubtype: "other" })
    );
    expect(mapScenarioCashflowToLegacyType(taxBenefitEvent)).toBe("tax_benefit");

    const salaryEvent = mapTimelineEventToScenarioCashflow(
      buildTimelineEvent({ type: "salary", incomeSubtype: "dividend" })
    );
    expect(mapScenarioCashflowToLegacyType(salaryEvent)).toBe("salary");
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
