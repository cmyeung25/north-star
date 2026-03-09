import { describe, expect, it } from "vitest";
import { resolveMemberCasesEntryIntent } from "./createCaseEntry";

describe("resolveMemberCasesEntryIntent", () => {
  it("uses allowlisted preset from query", () => {
    const intent = resolveMemberCasesEntryIntent({
      journey: "officeSaver",
      preset: "dual-income-rental",
    });

    expect(intent).toEqual({
      journey: "officeSaver",
      presetId: "dual-income-rental",
    });
  });

  it("falls back to mapped preset when preset query is missing", () => {
    const intent = resolveMemberCasesEntryIntent({
      journey: "coupleHome",
    });

    expect(intent).toEqual({
      journey: "coupleHome",
      presetId: "dual-income-home",
    });
  });

  it("ignores unknown journeys and non-allowlisted presets", () => {
    const intent = resolveMemberCasesEntryIntent({
      journey: "unknown",
      preset: "evil-preset",
    });

    expect(intent).toEqual({
      journey: null,
      presetId: null,
    });
  });

  it("keeps blank create flow when no journey/preset query is provided", () => {
    const intent = resolveMemberCasesEntryIntent({});

    expect(intent).toEqual({
      journey: null,
      presetId: null,
    });
  });
});
