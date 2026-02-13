import { describe, expect, it } from "vitest";
import { ageToYYYYMM, yyyymmToAge } from "../ageMonth";

describe("ageMonth", () => {
  it("converts age months into YYYY-MM", () => {
    expect(ageToYYYYMM("2026-02", 0)).toBe("2026-02");
    expect(ageToYYYYMM("2026-02", 1)).toBe("2026-03");
    expect(ageToYYYYMM("2026-12", 2)).toBe("2027-02");
  });

  it("round-trips YYYY-MM back to age", () => {
    expect(yyyymmToAge("2026-02", "2028-05")).toEqual({ years: 2, months: 3 });
  });

  it("rejects negative age offsets", () => {
    expect(yyyymmToAge("2026-02", "2026-01")).toBeNull();
  });
});
