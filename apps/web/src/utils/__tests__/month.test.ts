import { describe, expect, it } from "vitest";
import { isValidMonthStr } from "../month";

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
