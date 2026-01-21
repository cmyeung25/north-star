import { describe, expect, it } from "vitest";
import { normalizeOnboardingMonth } from "../month";

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
