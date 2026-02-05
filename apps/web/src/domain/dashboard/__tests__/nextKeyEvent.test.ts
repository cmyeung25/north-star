import { describe, expect, it } from "vitest";
import { getNextKeyEvent } from "../nextKeyEvent";

describe("getNextKeyEvent", () => {
  it("returns nearest upcoming highlighted event/milestone", () => {
    const result = getNextKeyEvent({
      baseMonth: "2025-03",
      events: [
        { id: "e1", name: "Trip", startMonth: "2025-08", highlighted: true },
        { id: "e2", name: "Wedding", startMonth: "2025-04", highlighted: true },
      ],
      milestones: [
        { id: "m1", label: "Retirement", month: "2025-05", memberName: "A", kind: "age" },
      ],
    });

    expect(result?.id).toBe("e2");
    expect(result?.month).toBe("2025-04");
  });

  it("returns null when none upcoming", () => {
    const result = getNextKeyEvent({
      baseMonth: "2025-03",
      events: [{ id: "e1", name: "Past", startMonth: "2025-02", highlighted: true }],
      milestones: [],
    });
    expect(result).toBeNull();
  });
});
