import { describe, expect, it } from "vitest";
import { isSubmissionV2Enabled } from "../featureFlags";

describe("featureFlags submission rollout", () => {
  it("keeps onboarding enabled for v2 submission path", () => {
    expect(isSubmissionV2Enabled("onboarding")).toBe(true);
  });
});
