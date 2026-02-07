import { describe, expect, it } from "vitest";
import { buildPlanLabEventFromCashflowDraft } from "../planLabCashflowAdapter";

describe("buildPlanLabEventFromCashflowDraft", () => {
  it("maps cashflow draft to plan lab overlay event definition", () => {
    const mapped = buildPlanLabEventFromCashflowDraft({
      draft: {
        type: "cashflow",
        label: "Part-time income",
        kind: "income",
        cadence: "monthly",
        amount: "12000",
        startAt: { mode: "MONTH", month: "2026-01" },
        endAt: { mode: "MONTH", month: "" },
        occurrenceMonth: "",
        everyNMonths: "",
        memberId: "member-1",
      },
      baseCurrency: "HKD",
      baseMonth: "2025-01",
      horizonMonths: 120,
      createId: () => "planlab_evt_test",
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.definition.id).toBe("planlab_evt_test");
    expect(mapped?.definition.type).toBe("salary");
    expect(mapped?.definition.rule.mode).toBe("params");
    expect(mapped?.definition.rule.monthlyAmount).toBe(12000);
    expect(mapped?.ref.refId).toBe("planlab_evt_test");
  });
});
