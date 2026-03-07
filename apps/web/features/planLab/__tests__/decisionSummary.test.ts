import { describe, expect, it } from "vitest";
import { buildPlanLabDecisionSummary } from "../decisionSummary";

const translate = (
  _key: string,
  fallback: string,
  values?: Record<string, string | number>
) => {
  if (!values) {
    return fallback;
  }
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    fallback
  );
};

describe("decisionSummary", () => {
  it("produces actionable recommendations when KPIs worsen", () => {
    const summary = buildPlanLabDecisionSummary({
      baseMonth: "2026-01",
      baselineTargetMonth: "2028-01",
      optionTargetMonth: "2028-07",
      baselineFirstNegativeCashMonth: "2027-12",
      optionFirstNegativeCashMonth: "2027-06",
      baselineRiskLevel: "healthy",
      optionRiskLevel: "warning",
      minCashDelta: -80000,
      endNetWorthDelta: -150000,
      topDrivers: [
        { title: "Rent", contribution: -12000 },
        { title: "Bonus", contribution: 5000 },
      ],
      translate,
    });

    expect(summary.riskTrend).toContain("worsened");
    expect(summary.riskTiming).toContain("earlier");
    expect(summary.recommendedActions.map((action) => action.id)).toEqual([
      "delay_target",
      "build_cash_buffer",
      "protect_income",
    ]);
  });

  it("returns no forced actions when metrics are stable or improved", () => {
    const summary = buildPlanLabDecisionSummary({
      baseMonth: "2026-01",
      baselineTargetMonth: "2028-01",
      optionTargetMonth: "2027-10",
      baselineFirstNegativeCashMonth: null,
      optionFirstNegativeCashMonth: null,
      baselineRiskLevel: "warning",
      optionRiskLevel: "healthy",
      minCashDelta: 60000,
      endNetWorthDelta: 220000,
      topDrivers: [{ title: "Salary raise", contribution: 20000 }],
      translate,
    });

    expect(summary.riskTrend).toContain("improved");
    expect(summary.riskTiming).toContain("No negative cash month");
    expect(summary.recommendedActions).toHaveLength(0);
  });
});
