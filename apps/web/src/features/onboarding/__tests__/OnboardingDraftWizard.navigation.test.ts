import { describe, expect, it } from "vitest";

import { resolveOnboardingCompletionPath } from "../OnboardingDraftWizard";

describe("resolveOnboardingCompletionPath", () => {
  it("returns canonical scenario dashboard path for route case id", () => {
    expect(
      resolveOnboardingCompletionPath({
        scenarioId: "scenario-1",
        routeCaseId: "case-1",
      }),
    ).toBe("/app/case/case-1/scenario/scenario-1/dashboard");
  });

  it("prefers scenario context case id over route case id", () => {
    expect(
      resolveOnboardingCompletionPath({
        scenarioId: "scenario-1",
        routeCaseId: "legacy-case",
        scenarioContextCaseId: "canonical-case",
      }),
    ).toBe("/app/case/canonical-case/scenario/scenario-1/dashboard");
  });

  it("does not produce legacy /dashboard query redirects", () => {
    const path = resolveOnboardingCompletionPath({
      scenarioId: "scenario-1",
      routeCaseId: "case-1",
    });

    expect(path).not.toContain("/dashboard?");
    expect(path).not.toContain("caseId=");
    expect(path).not.toContain("scenarioId=");
  });
});
