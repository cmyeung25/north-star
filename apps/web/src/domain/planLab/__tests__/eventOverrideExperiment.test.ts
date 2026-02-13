import { describe, expect, it } from "vitest";
import { buildEventOverridePatch } from "../eventOverrideExperiment";
import type { CashflowEvent } from "../../scenarioV2/events";

const baseEvent: CashflowEvent = {
  id: "rent-1",
  type: "cashflow",
  kind: "expense",
  label: "Rent",
  cadence: "monthly",
  amount: 12000,
  startMonth: "2026-02",
  endMonth: undefined,
};

describe("buildEventOverridePatch", () => {
  it("supports amountSet override", () => {
    const patch = buildEventOverridePatch(baseEvent, {
      id: "exp-1",
      title: "set amount",
      type: "event_override",
      targetEventId: "rent-1",
      changes: {
        amountSet: 0,
      },
    });

    expect(patch).toMatchObject({ amount: 0 });
  });

  it("supports setEndMonth when baseline has no end month", () => {
    const patch = buildEventOverridePatch(baseEvent, {
      id: "exp-2",
      title: "set end month",
      type: "event_override",
      targetEventId: "rent-1",
      changes: {
        setEndMonth: "2027-01",
      },
    });

    expect(patch).toMatchObject({ endMonth: "2027-01" });
  });

  it("supports clearing end month explicitly", () => {
    const patch = buildEventOverridePatch(
      {
        ...baseEvent,
        endMonth: "2028-03",
      },
      {
        id: "exp-3",
        title: "clear end month",
        type: "event_override",
        targetEventId: "rent-1",
        changes: {
          setEndMonth: null,
        },
      }
    );

    expect(patch).not.toHaveProperty("endMonth");
  });
});
