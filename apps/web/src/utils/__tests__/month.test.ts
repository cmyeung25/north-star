import { describe, expect, it } from "vitest";
import { isMonthComplete, isValidMonthStr, normalizeMonthStrict } from "../month";

describe("isValidMonthStr", () => {
  it("accepts valid YYYY-MM", () => {
    expect(isValidMonthStr("2024-01")).toBe(true);
    expect(isValidMonthStr("1999-12")).toBe(true);
  });

  it("rejects invalid or partial month strings", () => {
    expect(isValidMonthStr("2024-1")).toBe(false);
    expect(isValidMonthStr("2024-13")).toBe(false);
    expect(isValidMonthStr("2024-00")).toBe(false);
    expect(isValidMonthStr("abcd-ef")).toBe(false);
  });
});

describe("normalizeMonthStrict", () => {
  it("normalizes lenient month input to strict YYYY-MM", () => {
    expect(normalizeMonthStrict("2024-1")).toEqual({ ok: true, month: "2024-01" });
    expect(normalizeMonthStrict("1999-12")).toEqual({ ok: true, month: "1999-12" });
  });

  it("rejects invalid months and formats", () => {
    expect(normalizeMonthStrict("2024-13")).toEqual({
      ok: false,
      reason: "invalid-month",
    });
    expect(normalizeMonthStrict("2024-00")).toEqual({
      ok: false,
      reason: "invalid-month",
    });
    expect(normalizeMonthStrict("2024-")).toEqual({
      ok: false,
      reason: "invalid-format",
    });
  });
});

describe("isMonthComplete", () => {
  it("detects complete YYYY-MM strings", () => {
    expect(isMonthComplete("2024-01")).toBe(true);
    expect(isMonthComplete("2024-1")).toBe(false);
  });
});
