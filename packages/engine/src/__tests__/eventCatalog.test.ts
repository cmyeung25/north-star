import { describe, expect, it } from "vitest";

import {
  applyEventAssumptionFallbacks,
  getEventGroup,
} from "../index";

describe("event catalog helpers", () => {
  it("returns the correct groups for key event types", () => {
    expect(getEventGroup("rent")).toBe("housing");
    expect(getEventGroup("salary")).toBe("income");
    expect(getEventGroup("buy_home")).toBe("housing");
  });
});

describe("event assumption fallbacks", () => {
  it("uses inflation as rent growth when annualGrowthPct is missing", () => {
    const result = applyEventAssumptionFallbacks(
      { type: "rent" },
      { inflationRate: 2 }
    );

    expect(result.annualGrowthPct).toBe(2);
  });

  it("uses salary growth when annualGrowthPct is missing", () => {
    const result = applyEventAssumptionFallbacks(
      { type: "salary" },
      { salaryGrowthRate: 4 }
    );

    expect(result.annualGrowthPct).toBe(4);
  });

  it("prefers rent growth assumption when provided", () => {
    const result = applyEventAssumptionFallbacks(
      { type: "rent" },
      { inflationRate: 2, rentAnnualGrowthPct: 3 }
    );

    expect(result.annualGrowthPct).toBe(3);
  });
});
