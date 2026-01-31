import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import MoneyLegacyBanner from "../MoneyLegacyBanner";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("MoneyLegacyBanner", () => {
  it("shows banner for legacy scenarios", () => {
    const html = renderToString(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(MoneyLegacyBanner, { schemaVersion: 1 })
      )
    );
    expect(html).toContain("legacyBannerTitle");
  });

  it("hides banner for schema v2", () => {
    const html = renderToString(
      React.createElement(
        MantineProvider,
        null,
        React.createElement(MoneyLegacyBanner, { schemaVersion: 2 })
      )
    );
    expect(html).not.toContain("legacyBannerTitle");
  });
});
