import { describe, expect, it } from "vitest";
import {
  caseEnterPath,
  marketingHomePath,
  memberCasesPath,
  scenarioDashboardPath,
  scenarioOnboardingPath,
  scenarioPath,
  scenarioPeoplePath,
  scenarioSettingsPath,
} from "../canonicalRoutes";

describe("canonicalRoutes", () => {
  it("uses localePrefix as-needed", () => {
    expect(marketingHomePath("zh-HK")).toBe("/web");
    expect(memberCasesPath("zh-HK")).toBe("/member/cases");
    expect(memberCasesPath("en")).toBe("/en/member/cases");
  });

  it("builds canonical scenario sub-routes", () => {
    expect(scenarioDashboardPath("case-1", "scenario-1")).toBe(
      "/app/case/case-1/scenario/scenario-1/dashboard",
    );
    expect(scenarioOnboardingPath("case-1", "scenario-1", "en")).toBe(
      "/en/app/case/case-1/scenario/scenario-1/onboarding",
    );
    expect(scenarioPeoplePath("case-1", "scenario-1")).toBe(
      "/app/case/case-1/scenario/scenario-1/people",
    );
    expect(scenarioSettingsPath("case-1", "scenario-1", "en")).toBe(
      "/en/app/case/case-1/scenario/scenario-1/settings",
    );
  });

  it("falls back to member cases path when case/scenario ids are missing", () => {
    expect(scenarioPath(undefined, "scenario-1")).toBe("/member/cases");
    expect(scenarioPath("case-1", undefined, "dashboard", "en")).toBe("/en/member/cases");
  });

  it("encodes dynamic path segments", () => {
    expect(caseEnterPath("Case 1", "en")).toBe("/en/member/cases/Case%201/enter");
  });
});
