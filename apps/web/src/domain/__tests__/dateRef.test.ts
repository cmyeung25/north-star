import { describe, expect, it } from "vitest";
import {
  monthToAgeYearsIfAligned,
  resolveDateRef,
  type DateRef,
  type MonthStr,
} from "../dateRef";

describe("resolveDateRef", () => {
  it("returns month for MONTH mode", () => {
    const dateRef: DateRef = { mode: "MONTH", month: "2030-07" };
    expect(resolveDateRef(dateRef)).toBe("2030-07");
  });

  it("resolves AGE mode against member birthMonth", () => {
    const dateRef: DateRef = { mode: "AGE", memberId: "member-1", ageYears: 65 };
    const membersById = {
      "member-1": { id: "member-1", birthMonth: "1990-02" as MonthStr },
    };
    expect(resolveDateRef(dateRef, membersById)).toBe("2055-02");
  });
});

describe("monthToAgeYearsIfAligned", () => {
  it("returns age when month aligns with birth month", () => {
    expect(monthToAgeYearsIfAligned("2055-02", "1990-02")).toBe(65);
  });

  it("returns null when month is not aligned", () => {
    expect(monthToAgeYearsIfAligned("2055-03", "1990-02")).toBeNull();
  });
});
