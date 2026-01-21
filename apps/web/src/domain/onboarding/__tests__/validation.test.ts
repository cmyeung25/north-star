import { describe, expect, it } from "vitest";
import { hasIncomeAttribution } from "../validation";

const baseIncome = {
  id: "income-1",
  title: "Salary",
  subtype: "salary",
  monthlyAmount: 1000,
  startMonth: "2024-01",
  endMonth: "",
  endAtAgeYears: undefined,
} as const;

describe("hasIncomeAttribution", () => {
  it("requires explicit attribution", () => {
    expect(hasIncomeAttribution({ ...baseIncome, memberId: null })).toBe(false);
    expect(hasIncomeAttribution({ ...baseIncome, memberId: "" })).toBe(false);
    expect(hasIncomeAttribution({ ...baseIncome, memberId: "household" })).toBe(true);
    expect(hasIncomeAttribution({ ...baseIncome, memberId: "member-1" })).toBe(true);
  });
});
