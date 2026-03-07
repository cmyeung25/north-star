import { describe, expect, it } from "vitest";
import {
  INCOME_SHOCK_DEFAULT_PAYLOAD,
  buildIncomeShockDefaultPayload,
  buildPlanLabDecisionTemplateOptions,
} from "../decisionTemplates";

const translate = (_key: string, fallback: string) => fallback;

describe("decisionTemplates", () => {
  it("returns three decision templates", () => {
    const templates = buildPlanLabDecisionTemplateOptions({
      hasEligibleIncomeEvent: true,
      translate,
    });

    expect(templates).toHaveLength(3);
    expect(templates.map((template) => template.id)).toEqual([
      "home_purchase",
      "new_baby",
      "income_shock",
    ]);
  });

  it("disables income shock template when no editable income event exists", () => {
    const templates = buildPlanLabDecisionTemplateOptions({
      hasEligibleIncomeEvent: false,
      translate,
    });

    const incomeShock = templates.find((template) => template.id === "income_shock");
    expect(incomeShock?.availability.enabled).toBe(false);
    expect(incomeShock?.availability.reasonFallback).toContain("No editable baseline income");
  });

  it("builds default income shock payload using base month", () => {
    const payload = buildIncomeShockDefaultPayload({
      baseMonth: "2026-03",
    });

    expect(payload).toEqual({
      ...INCOME_SHOCK_DEFAULT_PAYLOAD,
      startMonth: "2026-04",
      endMonth: "2027-03",
    });
  });

  it("falls back to event start month when base month is unavailable", () => {
    const payload = buildIncomeShockDefaultPayload({
      baseMonth: null,
      fallbackStartMonth: "2026-05",
    });

    expect(payload?.startMonth).toBe("2026-06");
    expect(payload?.endMonth).toBe("2027-05");
  });
});
