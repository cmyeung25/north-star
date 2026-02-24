import { describe, expect, it } from "vitest";
import { getAssumptionGuardrailWarnings } from "../guardrails";

describe("getAssumptionGuardrailWarnings", () => {
  it("warns when inflation is outside comfort range", () => {
    const warnings = getAssumptionGuardrailWarnings({ inflationRate: 12 });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: "inflationOutOfComfortRange",
      suggestion: { inflationRate: 4 },
    });
  });

  it("warns when salary and inflation gap is too wide", () => {
    const warnings = getAssumptionGuardrailWarnings({
      inflationRate: 1,
      salaryGrowthRate: 12,
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: "salaryInflationGapTooWide",
      suggestion: { inflationRate: 1, salaryGrowthRate: 6 },
      context: { gap: 11 },
    });
  });

  it("returns empty when values are within comfort range", () => {
    const warnings = getAssumptionGuardrailWarnings({
      inflationRate: 3,
      salaryGrowthRate: 5,
    });

    expect(warnings).toEqual([]);
  });
});
