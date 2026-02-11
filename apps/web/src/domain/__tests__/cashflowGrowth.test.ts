import { describe, expect, it } from "vitest";
import { applyAnnualRate, applyDepreciation } from "../cashflowGrowth";

describe("cashflowGrowth utils", () => {
  it("applies annual growth rate for 0/12/24 months", () => {
    const base = 1000;
    expect(applyAnnualRate(base, 0, 3)).toBe(1000);
    expect(applyAnnualRate(base, 12, 3)).toBe(1030);
    expect(applyAnnualRate(base, 24, 3)).toBe(1061);
  });

  it("applies depreciation for 12/24 months", () => {
    const base = 10000;
    expect(applyDepreciation(base, 12, 10)).toBe(9000);
    expect(applyDepreciation(base, 24, 10)).toBe(8100);
  });
});
