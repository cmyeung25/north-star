import { describe, expect, it } from "vitest";
import { normalizeOnboardingMonth, resolveMonthInList } from "../month";

describe("normalizeOnboardingMonth", () => {
  it("returns fallback month when input is empty", () => {
    const result = normalizeOnboardingMonth("", "2024-01");
    expect(result).toEqual({ ok: true, month: "2024-01" });
  });

  it("returns invalid for partial month", () => {
    const result = normalizeOnboardingMonth("2024-");
    expect(result.ok).toBe(false);
  });
});

describe("resolveMonthInList", () => {
  const months = ["2024-01", "2024-02", "2024-03"];

  it("returns an exact match when available", () => {
    expect(resolveMonthInList(months, "2024-02")).toBe("2024-02");
  });

  it("clamps to the nearest range when target is out of bounds", () => {
    expect(resolveMonthInList(months, "2023-12")).toBe("2024-01");
    expect(resolveMonthInList(months, "2024-06")).toBe("2024-03");
  });

  it("falls back when target is invalid", () => {
    expect(resolveMonthInList(months, "2024-13")).toBe("2024-01");
  });
});
