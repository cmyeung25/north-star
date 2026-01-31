import { describe, expect, it } from "vitest";
import { CashflowEventSchema } from "../events";

describe("CashflowEventSchema", () => {
  it("accepts a valid monthly cashflow event", () => {
    const result = CashflowEventSchema.safeParse({
      id: "evt-1",
      type: "cashflow",
      kind: "income",
      cadence: "monthly",
      amount: 5000,
      startMonth: "2024-01",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing startMonth for recurring cadences", () => {
    const result = CashflowEventSchema.safeParse({
      id: "evt-2",
      type: "cashflow",
      kind: "expense",
      cadence: "monthly",
      amount: 100,
    });

    expect(result.success).toBe(false);
  });

  it("rejects oneOff without occurrenceMonth", () => {
    const result = CashflowEventSchema.safeParse({
      id: "evt-3",
      type: "cashflow",
      kind: "expense",
      cadence: "oneOff",
      amount: 250,
    });

    expect(result.success).toBe(false);
  });
});
