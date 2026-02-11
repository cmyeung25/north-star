import { describe, expect, it } from "vitest";
import {
  resolveCashflowAssumptionRate,
  resolveCashflowGrowthAssumption,
} from "../growthMode";

describe("growthMode helpers", () => {
  it("maps income events to salary growth", () => {
    const assumption = resolveCashflowGrowthAssumption({
      kind: "income",
      cadence: "monthly",
      tags: undefined,
      growthSource: undefined,
    });

    expect(assumption).toBe("salaryGrowthRate");
    expect(
      resolveCashflowAssumptionRate(
        {
          kind: "income",
          cadence: "monthly",
          tags: undefined,
          growthSource: undefined,
        },
        {
          salaryGrowthRate: 3,
          inflationRate: 2,
          rentAnnualGrowthPct: 4,
        }
      )
    ).toBe(3);
  });

  it("maps general expenses to inflation", () => {
    expect(
      resolveCashflowGrowthAssumption({
        kind: "expense",
        cadence: "monthly",
        tags: ["living"],
        growthSource: undefined,
      })
    ).toBe("inflationRate");
  });

  it("maps rent-related events to rent growth", () => {
    expect(
      resolveCashflowGrowthAssumption({
        kind: "expense",
        cadence: "monthly",
        tags: ["rental"],
        growthSource: undefined,
      })
    ).toBe("rentAnnualGrowthPct");

    expect(
      resolveCashflowGrowthAssumption({
        kind: "income",
        cadence: "monthly",
        tags: undefined,
        growthSource: "rentGrowth",
      })
    ).toBe("rentAnnualGrowthPct");
  });
});
