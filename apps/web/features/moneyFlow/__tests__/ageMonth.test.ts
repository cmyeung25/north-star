import { describe, expect, it } from "vitest";
import { ageToMonth, monthToAge } from "../ageMonth";

describe("ageMonth helpers", () => {
  it("converts age to month from birth month", () => {
    expect(ageToMonth("2026-02", 0, 0)).toBe("2026-02");
    expect(ageToMonth("2026-02", 0, 1)).toBe("2026-03");
    expect(ageToMonth("2026-12", 0, 2)).toBe("2027-02");
  });

  it("converts month back to age", () => {
    expect(monthToAge("2026-02", "2031-08")).toEqual({ years: 5, months: 6 });
  });

  it("is reversible between birth month and age", () => {
    const month = ageToMonth("1992-04", 40, 3);
    expect(month).toBe("2032-07");
    expect(monthToAge("1992-04", month ?? undefined)).toEqual({ years: 40, months: 3 });
  });
});
