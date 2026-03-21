import React from "react";
(globalThis as { React?: typeof React }).React = React;
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import enMessages from "../../../messages/en.json";
import SampleJourneySection from "./SampleJourneySection";
import { buildMemberCasesEntryHref } from "../../../src/features/member/createCaseEntry";
import { MARKET_ENTRY_EXPERIMENT_SLOTS } from "../../../src/features/marketing/marketEntryExperiments";

describe("SampleJourneySection", () => {
  it("renders sample journey cards and keeps CTA deep links with journey+preset query", () => {
    const html = renderToString(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
        timeZone="UTC"
      >
        <MantineProvider>
          <SampleJourneySection isSignedIn={false} />
        </MantineProvider>
      </NextIntlClientProvider>
    );

    expect(html).toContain("Three sample journeys you can try now");
    expect(html).toContain(
      buildMemberCasesEntryHref("en", {
        journey: "officeSaver",
        presetId: "single-renter",
      }).replaceAll("&", "&amp;")
    );
    expect(html).toContain(
      buildMemberCasesEntryHref("en", {
        journey: "coupleHome",
        presetId: "dual-income-home",
      }).replaceAll("&", "&amp;")
    );
    expect(html).toContain(
      buildMemberCasesEntryHref("en", {
        journey: "newParents",
        presetId: "new-baby",
      }).replaceAll("&", "&amp;")
    );
    expect(html).not.toContain("/en/app/");
  });

  it("keeps sample-journey CTA handoff unchanged when summary ordering variant changes", () => {
    const html = renderToString(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
        timeZone="UTC"
      >
        <MantineProvider>
          <SampleJourneySection
            isSignedIn={false}
            experimentSelection={{
              [MARKET_ENTRY_EXPERIMENT_SLOTS.sampleJourneySummary.key]: "decision_first_v1",
            }}
          />
        </MantineProvider>
      </NextIntlClientProvider>
    );

    expect(html).toContain("Each journey starts with the decision question first");
    expect(html).toContain(
      buildMemberCasesEntryHref("en", {
        journey: "officeSaver",
        presetId: "single-renter",
      }).replaceAll("&", "&amp;")
    );
    expect(html).not.toContain("/en/app/");
    expect(html).not.toContain("hidden-preset");
  });
});
