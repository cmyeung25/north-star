import { describe, expect, it } from "vitest";
import { resolveLegacySettingsRedirectPath } from "../legacySettingsRedirect";

describe("resolveLegacySettingsRedirectPath", () => {
  it("redirects old settings links to canonical scenario settings preserving locale", () => {
    expect(
      resolveLegacySettingsRedirectPath("en", {
        caseId: "case-123",
        scenarioId: "scenario-456",
      }),
    ).toBe("/en/app/case/case-123/scenario/scenario-456/settings");
  });

  it("falls back to locale member cases when case/scenario context is missing", () => {
    expect(resolveLegacySettingsRedirectPath("en", { scenarioId: "scenario-456" })).toBe(
      "/en/member/cases",
    );
    expect(resolveLegacySettingsRedirectPath("zh-HK", {})).toBe("/member/cases");
  });
});
