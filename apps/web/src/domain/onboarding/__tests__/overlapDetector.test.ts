import { describe, expect, it } from "vitest";
import { detectOnboardingOverlaps } from "../overlapDetector";
import type { BudgetRule } from "../../../store/scenarioStore";

const budgetRule: BudgetRule = {
  id: "rule-1",
  name: "Childcare",
  enabled: true,
  memberId: "member-1",
  category: "childcare",
  ageBand: { fromYears: 0, toYears: 6 },
  monthlyAmount: 3000,
  annualGrowthPct: 0,
  applyScope: { scope: "all" as const },
};

describe("detectOnboardingOverlaps", () => {
  it("warns when child event overlaps childcare budget and housing overlap", () => {
    const warnings = detectOnboardingOverlaps(
      [budgetRule],
      [
        {
          id: "event-1",
          title: "Baby",
          type: "baby",
          memberId: "member-1",
          startMonth: "2024-01",
          endMonth: "",
          monthlyAmount: 0,
          oneTimeAmount: 10000,
        },
        {
          id: "event-2",
          title: "Rent",
          type: "rent",
          memberId: "household",
          startMonth: "2024-01",
          endMonth: "",
          monthlyAmount: 5000,
          oneTimeAmount: 0,
        },
      ],
      true
    );

    expect(warnings.some((warning) => warning.type === "budget-event")).toBe(true);
    expect(warnings.some((warning) => warning.type === "housing")).toBe(true);
  });
});
