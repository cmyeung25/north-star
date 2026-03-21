import React from "react";
(globalThis as { React?: typeof React }).React = React;
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import enMessages from "../../../messages/en.json";
import PersonaBannerSection from "./PersonaBannerSection";
import { MARKET_ENTRY_EXPERIMENT_SLOTS } from "../../../src/features/marketing/marketEntryExperiments";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => undefined,
  }),
}));

vi.mock("./AuthModalController", () => ({
  useAuthModal: () => ({
    openAuthModal: () => undefined,
  }),
}));

describe("PersonaBannerSection", () => {
  it("renders text-led persona cards without relying on decorative persona images", () => {
    const html = renderToString(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
        timeZone="UTC"
      >
        <MantineProvider>
          <PersonaBannerSection isSignedIn={false} />
        </MantineProvider>
      </NextIntlClientProvider>
    );

    expect(html).toContain("Choose the decision pattern that feels closest to your situation.");
    expect(html).toContain("What you will clarify");
    expect(html).not.toContain("/marketing/personas/");
  });

  it("keeps persona CTA links on the canonical /member/cases handoff even when copy variants change", () => {
    const html = renderToString(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
        timeZone="UTC"
      >
        <MantineProvider>
          <PersonaBannerSection
            isSignedIn={false}
            experimentSelection={{
              [MARKET_ENTRY_EXPERIMENT_SLOTS.personaCtaSummary.key]: "decision_first_v1",
            }}
          />
        </MantineProvider>
      </NextIntlClientProvider>
    );

    expect(html).toContain("Start with this decision");
    expect(html).not.toContain("/en/app/");
    expect(html).not.toContain("evil-preset");
  });
});
