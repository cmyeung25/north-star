import { describe, expect, it } from "vitest";
import { buildEventExperimentChanges, type EventExperimentDraftInput } from "../eventExperimentAdapter";
import type { CashflowEvent } from "../../../src/domain/scenarioV2/events";

const baseDraft: EventExperimentDraftInput = {
  amountMode: "delta",
  deltaUnit: "percent",
  amountValue: 0,
  setAmountValue: null,
  startMonthMode: "offset",
  startAgeYears: 0,
  startAgeMonths: 0,
  startShiftMonths: 0,
  startMonthValue: "2026-02",
  endMonthMode: "month",
  endAgeYears: 0,
  endAgeMonths: 0,
  endShiftMonths: 0,
  endMonthValue: "2026-06",
  clearEndMonth: false,
  growthMode: "unchanged",
  growthRate: 0,
};

const baselineEvent: CashflowEvent = {
  id: "rent-1",
  type: "cashflow",
  kind: "expense",
  label: "Rent",
  cadence: "monthly",
  amount: 12000,
  startMonth: "2026-02",
};

describe("buildEventExperimentChanges", () => {
  it("includes endMonth override when baseline has no endMonth", () => {
    const { changes } = buildEventExperimentChanges({
      draft: baseDraft,
      baselineEvent,
      baseMonth: "2026-01",
      members: [],
    });

    expect(changes.endMonth).toBe("2026-06");
  });
});
