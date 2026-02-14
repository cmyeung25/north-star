import { describe, expect, it } from "vitest";
import { buildEventOverridePatch } from "../eventOverrideExperiment";
import type { CashflowEvent, HousingEvent } from "../../scenarioV2/events";

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

const housingRentEvent: HousingEvent = {
  id: "housing-rent-1",
  type: "housing",
  kind: "rent",
  label: "Rental Property",
  startMonth: "2026-02",
  endMonth: undefined,
  rentMonthly: 15000,
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

    expect(Object.prototype.hasOwnProperty.call(patch, "endMonth")).toBe(false);
  });

  it("supports direct endMonth override on create", () => {
    const patch = buildEventOverridePatch(baseEvent, {
      id: "exp-4",
      title: "direct end month",
      type: "event_override",
      targetEventId: "rent-1",
      changes: {
        endMonth: "2026-06",
      },
    });

    expect(patch).toMatchObject({ endMonth: "2026-06" });
  });

  it("sets endMonth when event has no endMonth and endMonth specified but no shift", () => {
    const patch = buildEventOverridePatch(baseEvent, {
      id: "exp-5",
      title: "set exact end month no baseline",
      type: "event_override",
      targetEventId: "rent-1",
      changes: {
        endMonth: "2027-03",
      },
    });

    expect(patch).toMatchObject({ endMonth: "2027-03" });
  });

  it("should not return empty patch when setting endMonth", () => {
    const patch = buildEventOverridePatch(baseEvent, {
      id: "exp-6",
      title: "set end month without clearing",
      type: "event_override",
      targetEventId: "rent-1",
      changes: {
        setEndMonth: "2027-06",
      },
    });

    expect(Object.keys(patch).length).toBeGreaterThan(0);
    expect(patch).toMatchObject({ endMonth: "2027-06" });
  });
});

describe("buildEventOverridePatch for HousingEvent", () => {
  it("supports setEndMonth on housing rent event without baseline endMonth", () => {
    const patch = buildEventOverridePatch(housingRentEvent, {
      id: "exp-housing-1",
      title: "set housing end month",
      type: "event_override",
      targetEventId: "housing-rent-1",
      changes: {
        setEndMonth: "2027-02",
      },
    });

    expect(patch).toMatchObject({ endMonth: "2027-02" });
  });

  it("supports clearing endMonth on housing rent event", () => {
    const patch = buildEventOverridePatch(
      {
        ...housingRentEvent,
        endMonth: "2028-01",
      },
      {
        id: "exp-housing-2",
        title: "clear housing end month",
        type: "event_override",
        targetEventId: "housing-rent-1",
        changes: {
          setEndMonth: null,
        },
      }
    );

    expect(Object.prototype.hasOwnProperty.call(patch, "endMonth")).toBe(false);
  });

  it("supports startMonth override on housing event", () => {
    const patch = buildEventOverridePatch(housingRentEvent, {
      id: "exp-housing-3",
      title: "set housing start month",
      type: "event_override",
      targetEventId: "housing-rent-1",
      changes: {
        startMonth: "2026-03",
      },
    });

    expect(patch).toMatchObject({ startMonth: "2026-03" });
  });
});
