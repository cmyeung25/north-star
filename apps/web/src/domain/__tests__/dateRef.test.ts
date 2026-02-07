import { describe, expect, it } from "vitest";
import {
  monthToAgeYearsIfAligned,
  resolveDateRef,
  type DateRef,
} from "../dateRef";
import type { ScenarioMember } from "../../store/scenarioStore";

describe("dateRef helpers", () => {
  it("resolves month-based references", () => {
    const membersById: Record<string, ScenarioMember> = {};
    const ref: DateRef = { mode: "MONTH", month: "2030-06" };
    expect(resolveDateRef(ref, membersById)).toBe("2030-06");
  });

  it("resolves age-based references using birth month", () => {
    const membersById: Record<string, ScenarioMember> = {
      member: {
        id: "member",
        name: "Alex",
        kind: "person",
        birthMonth: "1990-02",
      },
    };
    const ref: DateRef = { mode: "AGE", memberId: "member", ageYears: 65 };
    expect(resolveDateRef(ref, membersById)).toBe("2055-02");
  });

  it("derives age years when the target month aligns with birth month", () => {
    expect(monthToAgeYearsIfAligned("2035-02", "1990-02")).toBe(45);
    expect(monthToAgeYearsIfAligned("2035-03", "1990-02")).toBeNull();
  });
});
