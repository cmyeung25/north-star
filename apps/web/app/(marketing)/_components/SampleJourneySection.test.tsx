import React from "react";
(globalThis as { React?: typeof React }).React = React;
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import enMessages from "../../../messages/en.json";
import SampleJourneySection from "./SampleJourneySection";

describe("SampleJourneySection", () => {
  it("renders sample journey cards and keeps CTA deep links with journey+preset query", () => {
    const html = renderToString(
      <NextIntlClientProvider
        locale="en"
        messages={enMessages as unknown as AbstractIntlMessages}
        timeZone="UTC"
      >
        <MantineProvider>
          <SampleJourneySection />
        </MantineProvider>
      </NextIntlClientProvider>
    );

    expect(html).toContain("Three sample journeys you can try now");
    expect(html).toContain("/en/member/cases?journey=officeSaver&amp;preset=single-renter");
    expect(html).toContain("/en/member/cases?journey=coupleHome&amp;preset=dual-income-home");
    expect(html).toContain("/en/member/cases?journey=newParents&amp;preset=new-baby");
  });
});
