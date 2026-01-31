import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("../OnboardingDraftWizard", () => ({
  default: () => <div data-testid="onboarding-v2">Onboarding V2</div>,
}));

describe("OnboardingEntry", () => {
  it("renders the V2 onboarding wizard", async () => {
    const { default: OnboardingEntry } = await import("../OnboardingEntry");
    const html = renderToString(React.createElement(OnboardingEntry));

    expect(html.includes("onboarding-v2")).toBe(true);
  });
});
