import type { BadgeProps } from "@mantine/core";

export type MoneyTagTone = NonNullable<BadgeProps["color"]>;

export type MoneyTagConfig = {
  size: BadgeProps["size"];
  variant: BadgeProps["variant"];
  radius: BadgeProps["radius"];
  color: MoneyTagTone;
  icon?: string;
  priority: number;
};

export const moneyTagConfig = {
  eventType: {
    size: "sm",
    variant: "light",
    radius: "xl",
    color: "neutral",
    priority: 10,
  },
  category: {
    size: "sm",
    variant: "light",
    radius: "xl",
    color: "aurora",
    priority: 20,
  },
  cadence: {
    size: "sm",
    variant: "light",
    radius: "xl",
    color: "ice",
    priority: 30,
  },
  member: {
    size: "sm",
    variant: "outline",
    radius: "xl",
    color: "polar",
    priority: 40,
  },
  growth: {
    size: "sm",
    variant: "light",
    radius: "xl",
    color: "info",
    priority: 50,
  },
  adjustment: {
    size: "sm",
    variant: "outline",
    radius: "xl",
    color: "info",
    priority: 60,
  },
  projection: {
    size: "sm",
    variant: "light",
    radius: "xl",
    color: "warning",
    priority: 70,
  },
  assetType: {
    size: "sm",
    variant: "light",
    radius: "xl",
    color: "polar",
    priority: 80,
  },
  liabilityType: {
    size: "sm",
    variant: "light",
    radius: "xl",
    color: "danger",
    priority: 80,
  },
  source: {
    size: "sm",
    variant: "outline",
    radius: "xl",
    color: "ice",
    priority: 90,
  },
  attribute: {
    size: "sm",
    variant: "light",
    radius: "xl",
    color: "neutral",
    priority: 100,
  },
} satisfies Record<string, MoneyTagConfig>;

export type MoneyTagKind = keyof typeof moneyTagConfig;

export type MoneyTagItem = {
  key: string;
  label: string;
  kind: MoneyTagKind;
};
