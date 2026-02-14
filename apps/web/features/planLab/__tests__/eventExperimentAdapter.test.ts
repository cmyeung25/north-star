import { describe, expect, it } from "vitest";
import {
  buildEventExperimentChanges,
  normalizeYYYYMM,
  type EventExperimentDraftInput,
} from "../eventExperimentAdapter";
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

describe("normalizeYYYYMM", () => {
  it("normalizes CJK month strings", () => {
    expect(normalizeYYYYMM("2027年2月")).toBe("2027-02");
  });
});

describe("buildEventExperimentChanges", () => {
  it("includes endMonth override when baseline has no endMonth", () => {
    const { changes } = buildEventExperimentChanges({
      draft: baseDraft,
      baselineEvent,
      baseMonth: "2026-01",
      members: [],
    });

    expect(changes.setEndMonth).toBe("2026-06");
  });

  it("should not create endMonth property when in month mode", () => {
    const { changes } = buildEventExperimentChanges({
      draft: baseDraft,
      baselineEvent,
      baseMonth: "2026-01",
      members: [],
    });

    expect(changes.endMonth).toBeUndefined();
  });

  it("throws when end month cannot be normalized", () => {
    expect(() =>
      buildEventExperimentChanges({
        draft: {
          ...baseDraft,
          endMonthValue: "2026/06",
        },
        baselineEvent,
        baseMonth: "2026-01",
        members: [],
      })
    ).toThrow("end-month-invalid");
  });
});
