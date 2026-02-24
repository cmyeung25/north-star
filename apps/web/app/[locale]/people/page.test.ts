import { describe, expect, it } from "vitest";
import { resolveLegacyPeopleRouteRedirect } from "./legacyRoute";

describe("/[locale]/people legacy compatibility route", () => {
  it("redirects legacy query URLs to canonical scenario people route", () => {
    const redirectTo = resolveLegacyPeopleRouteRedirect("en", {
      caseId: "case-1",
      scenarioId: "scenario-1",
      tab: "budget",
    });

    expect(redirectTo).toBe("/en/app/case/case-1/scenario/scenario-1/setting?tab=budget");
  });

  it("safely redirects to member cases when identifiers are missing", () => {
    const redirectTo = resolveLegacyPeopleRouteRedirect("zh-HK", {
      tab: "budget",
    });

    expect(redirectTo).toBe("/member/cases");
  });
});
