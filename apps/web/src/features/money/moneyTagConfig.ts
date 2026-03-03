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
  icon: MoneyTagIconKey;
  priority: number;
};

export type MoneyTagIconKey =
  | "income"
  | "expense"
  | "category"
  | "frequency"
  | "owner"
  | "growth"
  | "adjustment"
  | "projection"
  | "asset"
  | "liability"
  | "source"
  | "lifecycle";

const defaultMoneyTagAppearance = {
  size: "sm",
  radius: "xl",
} satisfies Pick<MoneyTagConfig, "size" | "radius">;

const withSemanticColor = (
  config: Omit<MoneyTagConfig, "color"> & { semanticColor: MoneyTagSemanticColorKey }
): MoneyTagConfig => ({
  ...config,
  color: moneyTagSemanticColorMap[config.semanticColor],
});

export const moneyTagConfig = {
  incomeType: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "light",
    semanticColor: "domain-income",
    prefix: "TYPE",
    icon: "income",
    priority: 10,
  }),
  expenseType: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "light",
    semanticColor: "domain-expense",
    prefix: "TYPE",
    icon: "expense",
    priority: 10,
  }),
  category: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "light",
    semanticColor: "meta-category",
    prefix: "CAT",
    icon: "category",
    priority: 20,
  }),
  cadence: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "light",
    semanticColor: "meta-frequency",
    prefix: "FREQ",
    icon: "frequency",
    priority: 30,
  }),
  member: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "outline",
    semanticColor: "meta-owner",
    prefix: "OWN",
    icon: "owner",
    priority: 40,
  }),
  growth: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "light",
    semanticColor: "meta-growth",
    prefix: "GR",
    icon: "growth",
    priority: 50,
  }),
  adjustment: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "outline",
    semanticColor: "meta-adjustment",
    prefix: "ADJ",
    icon: "adjustment",
    priority: 60,
  }),
  projection: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "light",
    semanticColor: "meta-projection",
    prefix: "PRJ",
    icon: "projection",
    priority: 70,
  }),
  assetType: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "light",
    semanticColor: "domain-asset",
    prefix: "TYPE",
    icon: "asset",
    priority: 80,
  }),
  liabilityType: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "light",
    semanticColor: "domain-liability",
    prefix: "TYPE",
    icon: "liability",
    priority: 80,
  }),
  source: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "outline",
    semanticColor: "meta-source",
    prefix: "SRC",
    icon: "source",
    priority: 90,
  }),
  attribute: withSemanticColor({
    ...defaultMoneyTagAppearance,
    variant: "light",
    semanticColor: "meta-lifecycle",
    prefix: "LIFE",
    icon: "lifecycle",
    priority: 100,
  }),
} satisfies Record<string, MoneyTagConfig>;

export type MoneyTagKind = keyof typeof moneyTagConfig;

export type MoneyTagItem = {
  key: string;
  label: string;
  kind: MoneyTagKind;
};
