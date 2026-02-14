import { describe, expect, it } from "vitest";
import type { CashflowEvent } from "../events";
import { normalizeCashflowGrowth } from "../growthPolicy";

const baseExpense: CashflowEvent = {
  id: "evt-expense",
  type: "cashflow",
  kind: "expense",
  cadence: "monthly",
  amount: 1000,
  startMonth: "2024-01",
};

describe("normalizeCashflowGrowth", () => {
  it("defaults missing growthMode to assumption for recurring cashflow", () => {
    const normalized = normalizeCashflowGrowth(baseExpense);

    expect(normalized.growthMode).toBe("assumption");
    expect(normalized.growthSource).toBe("inflation");
  });

  it("keeps custom growth configuration", () => {
    const normalized = normalizeCashflowGrowth({
      ...baseExpense,
      kind: "income",
      growthMode: "custom",
      customGrowthRatePct: 5,
    });

    expect(normalized.growthMode).toBe("custom");
    expect(normalized.customGrowthRatePct).toBe(5);
  });

  it("keeps none growth mode and clears custom rate", () => {
    const normalized = normalizeCashflowGrowth({
      ...baseExpense,
      growthMode: "none",
      customGrowthRatePct: 5,
    });

    expect(normalized.growthMode).toBe("none");
    expect(normalized.customGrowthRatePct).toBeUndefined();
  });
});
