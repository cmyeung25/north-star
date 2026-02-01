import { describe, expect, it } from "vitest";
import { resolveYearlyStartMonthKey } from "../yearlyCadence";

describe("resolveYearlyStartMonthKey", () => {
  it("resolves to the same year when month is after base month", () => {
    expect(resolveYearlyStartMonthKey("8", "2024-06")).toBe("2024-08");
  });

  it("rolls to next year when month is before base month", () => {
    expect(resolveYearlyStartMonthKey("3", "2024-06")).toBe("2025-03");
  });

  it("returns empty string for invalid month selection", () => {
    expect(resolveYearlyStartMonthKey("0", "2024-06")).toBe("");
  });
});
