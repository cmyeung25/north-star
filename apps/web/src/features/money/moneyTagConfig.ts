import type { BadgeProps } from "@mantine/core";

export type MoneyTagTone = NonNullable<BadgeProps["color"]>;
export type MoneyTagSemanticColorKey =
  | "domain-income"
  | "domain-expense"
  | "domain-asset"
  | "domain-liability"
  | "meta-frequency"
  | "meta-owner"
  | "meta-adjustment"
  | "meta-category"
  | "meta-growth"
  | "meta-projection"
  | "meta-source"
  | "meta-lifecycle";

export const moneyTagSemanticColorMap: Record<MoneyTagSemanticColorKey, MoneyTagTone> = {
  "domain-income": "aurora",
  "domain-expense": "warning",
  "domain-asset": "polar",
  "domain-liability": "danger",
  "meta-frequency": "ice",
  "meta-owner": "neutral",
  "meta-adjustment": "info",
  "meta-category": "aurora",
  "meta-growth": "info",
  "meta-projection": "warning",
  "meta-source": "ice",
  "meta-lifecycle": "neutral",
};

export type MoneyTagConfig = {
  size: BadgeProps["size"];
  variant: BadgeProps["variant"];
  radius: BadgeProps["radius"];
  semanticColor: MoneyTagSemanticColorKey;
  color: MoneyTagTone;
  prefix: string;
  icon?: string;
  priority: number;
};

const withSemanticColor = (
  config: Omit<MoneyTagConfig, "color"> & { semanticColor: MoneyTagSemanticColorKey }
): MoneyTagConfig => ({
  ...config,
  color: moneyTagSemanticColorMap[config.semanticColor],
});

export const moneyTagConfig = {
  incomeType: withSemanticColor({
    size: "sm",
    variant: "light",
    radius: "xl",
    semanticColor: "domain-income",
    prefix: "TYPE",
    icon: "＋",
    priority: 10,
  }),
  expenseType: withSemanticColor({
    size: "sm",
    variant: "light",
    radius: "xl",
    semanticColor: "domain-expense",
    prefix: "TYPE",
    icon: "－",
    priority: 10,
  }),
  category: withSemanticColor({
    size: "sm",
    variant: "light",
    radius: "xl",
    semanticColor: "meta-category",
    prefix: "CAT",
    icon: "▣",
    priority: 20,
  }),
  cadence: withSemanticColor({
    size: "sm",
    variant: "light",
    radius: "xl",
    semanticColor: "meta-frequency",
    prefix: "FREQ",
    icon: "↻",
    priority: 30,
  }),
  member: withSemanticColor({
    size: "sm",
    variant: "outline",
    radius: "xl",
    semanticColor: "meta-owner",
    prefix: "OWN",
    icon: "👤",
    priority: 40,
  }),
  growth: withSemanticColor({
    size: "sm",
    variant: "light",
    radius: "xl",
    semanticColor: "meta-growth",
    prefix: "GR",
    icon: "↗",
    priority: 50,
  }),
  adjustment: withSemanticColor({
    size: "sm",
    variant: "outline",
    radius: "xl",
    semanticColor: "meta-adjustment",
    prefix: "ADJ",
    icon: "±",
    priority: 60,
  }),
  projection: withSemanticColor({
    size: "sm",
    variant: "light",
    radius: "xl",
    semanticColor: "meta-projection",
    prefix: "PRJ",
    icon: "◎",
    priority: 70,
  }),
  assetType: withSemanticColor({
    size: "sm",
    variant: "light",
    radius: "xl",
    semanticColor: "domain-asset",
    prefix: "TYPE",
    icon: "⬢",
    priority: 80,
  }),
  liabilityType: withSemanticColor({
    size: "sm",
    variant: "light",
    radius: "xl",
    semanticColor: "domain-liability",
    prefix: "TYPE",
    icon: "⬣",
    priority: 80,
  }),
  source: withSemanticColor({
    size: "sm",
    variant: "outline",
    radius: "xl",
    semanticColor: "meta-source",
    prefix: "SRC",
    icon: "⌁",
    priority: 90,
  }),
  attribute: withSemanticColor({
    size: "sm",
    variant: "light",
    radius: "xl",
    semanticColor: "meta-lifecycle",
    prefix: "LIFE",
    icon: "◷",
    priority: 100,
  }),
} satisfies Record<string, MoneyTagConfig>;

export type MoneyTagKind = keyof typeof moneyTagConfig;

export type MoneyTagItem = {
  key: string;
  label: string;
  kind: MoneyTagKind;
};
