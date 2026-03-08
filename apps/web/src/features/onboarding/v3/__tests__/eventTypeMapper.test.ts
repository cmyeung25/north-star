import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../../domain/scenarioV2/events";
import { mapOnboardingV3EventTypes } from "../eventTypeMapper";

const asCashflowEvent = (event: ScenarioEvent) => {
  expect(event.type).toBe("cashflow");
  return event as Extract<ScenarioEvent, { type: "cashflow" }>;
};

const baseExpense = {
  id: "e1",
  type: "cashflow" as const,
  kind: "expense" as const,
  cadence: "monthly" as const,
  amount: 1000,
  startMonth: "2025-01",
};

const baseIncome = {
  id: "i1",
  type: "cashflow" as const,
  kind: "income" as const,
  cadence: "monthly" as const,
  amount: 50000,
  startMonth: "2025-01",
};

describe("mapOnboardingV3EventTypes", () => {
  it("maps daily expense to custom", () => {
    const events: ScenarioEvent[] = [
      { ...baseExpense, tags: ["onboarding:v3:expense:daily-monthly"] },
    ];

    const mapped = asCashflowEvent((mapOnboardingV3EventTypes(events) as ScenarioEvent[])[0]);
    expect(mapped.meta?.timelineEventType).toBe("custom");
    expect(mapped.expenseCategory).toBe("daily_living");
    expect(mapped.meta?.eventTypeMappedBy).toBe("onboarding-v3");
  });

  it("maps travel expense to travel", () => {
    const events: ScenarioEvent[] = [
      { ...baseExpense, id: "e2", tags: ["onboarding:v3:expense:travel"] },
    ];

    const mapped = asCashflowEvent((mapOnboardingV3EventTypes(events) as ScenarioEvent[])[0]);
    expect(mapped.meta?.timelineEventType).toBe("travel");
    expect(mapped.expenseCategory).toBe("travel");
  });

  it("maps tax expense to custom with tax tag", () => {
    const events: ScenarioEvent[] = [
      { ...baseExpense, id: "e3", tags: ["onboarding:v3:expense:tax"] },
    ];

    const mapped = asCashflowEvent((mapOnboardingV3EventTypes(events) as ScenarioEvent[])[0]);
    expect(mapped.meta?.timelineEventType).toBe("custom");
    expect(mapped.expenseCategory).toBe("tax");
    expect(mapped.tags).toContain("tax");
  });

  it("maps salary income to salary subtype", () => {
    const events: ScenarioEvent[] = [
      { ...baseIncome, tags: ["onboarding:v3:income:salary"] },
    ];

    const mapped = asCashflowEvent((mapOnboardingV3EventTypes(events) as ScenarioEvent[])[0]);
    expect(mapped.meta?.timelineEventType).toBe("salary");
    expect(mapped.meta?.timelineIncomeSubtype).toBe("salary");
    expect(mapped.category).toBe("salary");
  });

  it("maps rent income to custom with rental subtype", () => {
    const events: ScenarioEvent[] = [
      { ...baseIncome, id: "i2", tags: ["onboarding:v3:income:rent"] },
    ];

    const mapped = asCashflowEvent((mapOnboardingV3EventTypes(events) as ScenarioEvent[])[0]);
    expect(mapped.meta?.timelineEventType).toBe("custom");
    expect(mapped.meta?.timelineIncomeSubtype).toBe("rental");
    expect(mapped.category).toBe("rental");
    expect(mapped.tags).toContain("income:rental");
  });

  it("maps bonus income to bonus subtype", () => {
    const events: ScenarioEvent[] = [
      { ...baseIncome, id: "i3", tags: ["onboarding:v3:income:bonus"] },
    ];

    const mapped = asCashflowEvent((mapOnboardingV3EventTypes(events) as ScenarioEvent[])[0]);
    expect(mapped.meta?.timelineEventType).toBe("custom");
    expect(mapped.meta?.timelineIncomeSubtype).toBe("bonus");
    expect(mapped.category).toBe("bonus");
  });

  it("maps generic onboarding income to other subtype", () => {
    const events: ScenarioEvent[] = [
      { ...baseIncome, id: "i4", tags: ["onboarding:v3:income:manual"] },
    ];

    const mapped = asCashflowEvent((mapOnboardingV3EventTypes(events) as ScenarioEvent[])[0]);
    expect(mapped.meta?.timelineEventType).toBe("custom");
    expect(mapped.meta?.timelineIncomeSubtype).toBe("other");
    expect(mapped.category).toBe("other");
  });

  it("maps other-fixed expense to other category", () => {
    const events: ScenarioEvent[] = [
      { ...baseExpense, id: "e5", tags: ["onboarding:v3:expense:other-fixed"] },
    ];

    const mapped = asCashflowEvent((mapOnboardingV3EventTypes(events) as ScenarioEvent[])[0]);
    expect(mapped.meta?.timelineEventType).toBe("custom");
    expect(mapped.expenseCategory).toBe("other");
  });

  it("removes onboarding v3 internal tags after mapping", () => {
    const events: ScenarioEvent[] = [
      {
        ...baseExpense,
        id: "e4",
        tags: ["onboarding:v3:expense:daily-monthly", "onboarding:v3:expense:source-onboarding", "keep:manual"],
      },
    ];

    const mapped = asCashflowEvent((mapOnboardingV3EventTypes(events) as ScenarioEvent[])[0]);
    expect(mapped.tags).toEqual(["keep:manual"]);
    expect(mapped.meta?.timelineEventType).toBe("custom");
  });

});
