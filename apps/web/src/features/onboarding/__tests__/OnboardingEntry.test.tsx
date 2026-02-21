import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

vi.mock("../v3/OnboardingV3Wizard", () => ({
  default: () => <div data-testid="onboarding-v3">Onboarding V3</div>,
}));

describe("OnboardingEntry", () => {
  it("renders the V3 onboarding wizard", async () => {
    const { default: OnboardingEntry } = await import("../OnboardingEntry");
    const html = renderToString(React.createElement(OnboardingEntry));

    expect(html.includes("onboarding-v3")).toBe(true);
  });
});
