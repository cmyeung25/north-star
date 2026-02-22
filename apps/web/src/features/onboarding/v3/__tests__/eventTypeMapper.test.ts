import { describe, expect, it } from "vitest";
import type { ScenarioEvent } from "../../../../domain/scenarioV2/events";
import { mapOnboardingV3EventTypes } from "../eventTypeMapper";

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

    const [mapped] = mapOnboardingV3EventTypes(events) as ScenarioEvent[];
    expect(mapped.meta?.timelineEventType).toBe("custom");
    expect(mapped.meta?.eventTypeMappedBy).toBe("onboarding-v3");
  });

  it("maps travel expense to travel", () => {
    const events: ScenarioEvent[] = [
      { ...baseExpense, id: "e2", tags: ["onboarding:v3:expense:travel"] },
    ];

    const [mapped] = mapOnboardingV3EventTypes(events) as ScenarioEvent[];
    expect(mapped.meta?.timelineEventType).toBe("travel");
  });

  it("maps tax expense to custom with tax tag", () => {
    const events: ScenarioEvent[] = [
      { ...baseExpense, id: "e3", tags: ["onboarding:v3:expense:tax"] },
    ];

    const [mapped] = mapOnboardingV3EventTypes(events) as ScenarioEvent[];
    expect(mapped.meta?.timelineEventType).toBe("custom");
    expect(mapped.tags).toContain("tax");
  });

  it("maps salary income to salary subtype", () => {
    const events: ScenarioEvent[] = [
      { ...baseIncome, tags: ["onboarding:v3:income:salary"] },
    ];

    const [mapped] = mapOnboardingV3EventTypes(events) as ScenarioEvent[];
    expect(mapped.meta?.timelineEventType).toBe("salary");
    expect(mapped.meta?.timelineIncomeSubtype).toBe("salary");
  });

  it("maps rent income to custom with rental subtype", () => {
    const events: ScenarioEvent[] = [
      { ...baseIncome, id: "i2", tags: ["onboarding:v3:income:rent"] },
    ];

    const [mapped] = mapOnboardingV3EventTypes(events) as ScenarioEvent[];
    expect(mapped.meta?.timelineEventType).toBe("custom");
    expect(mapped.meta?.timelineIncomeSubtype).toBe("rental");
    expect(mapped.tags).toContain("income:rental");
  });
});
