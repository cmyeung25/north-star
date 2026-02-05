import React from "react";
(globalThis as { React?: typeof React }).React = React;
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import TemplatePickerDrawer from "../TemplatePickerDrawer";

vi.mock("@mantine/core", async () => {
  const vitestWithImportActual = vi as unknown as {
    importActual: (path: string) => Promise<unknown>;
  };
  const actual = (await vitestWithImportActual.importActual("@mantine/core")) as typeof import("@mantine/core");
  return {
    ...actual,
    Drawer: ({ opened, title, children }: { opened: boolean; title?: React.ReactNode; children: React.ReactNode }) =>
      opened ? (
        <section>
          <h2>{title}</h2>
          {children}
        </section>
      ) : null,
  };
});

const zhMap: Record<string, string> = {
  templatePickerTitle: "選擇模板",
  createIntentHint: "你想新增哪一種？",
  createIntentPlanTitle: "建立計劃",
  createIntentItemTitle: "新增項目",
  createIntentItemHint: "選擇分類並新增單一項目。",
  incomeTitle: "收入",
  expensesTitle: "支出",
  assetsTitle: "資產",
  liabilitiesTitle: "負債",
  templatePickerSearchPlaceholder: "搜尋模板",
};

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const translate = ((key: string) => zhMap[key] ?? key) as ((key: string) => string) & {
      has: (key: string) => boolean;
    };
    translate.has = (key: string) => key in zhMap;
    return translate;
  },
}));

describe("TemplatePickerDrawer", () => {
  it("renders the intent screen", () => {
    const html = renderToString(
      <MantineProvider>
      <TemplatePickerDrawer
        opened
        showIntentScreen
        onClose={() => undefined}
        onSelect={() => undefined}
      />
      </MantineProvider>
    );

    expect(html).toContain("選擇模板");
    expect(html).toContain("你想新增哪一種？");
    expect(html).toContain("建立計劃");
    expect(html).toContain("新增項目");
  });

  it("renders item category tabs when intent is item", () => {
    const html = renderToString(
      <MantineProvider>
      <TemplatePickerDrawer
        opened
        showIntentScreen
        defaultIntent="item"
        defaultItemCategory="income"
        onClose={() => undefined}
        onSelect={() => undefined}
      />
      </MantineProvider>
    );

    expect(html).toContain("收入");
    expect(html).toContain("支出");
    expect(html).toContain("資產");
    expect(html).toContain("負債");
  });
});
