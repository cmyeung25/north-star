"use client";

import React from "react";
import { Badge, Group, rem, useMantineTheme } from "@mantine/core";
import {
  moneyTagConfig,
  type MoneyTagIconKey,
  type MoneyTagItem,
} from "./moneyTagConfig";

type Props = {
  tags: MoneyTagItem[];
};

type IconProps = {
  size: string;
  stroke: number;
};

const iconRegistry: Record<MoneyTagIconKey, (props: IconProps) => React.JSX.Element> = {
  income: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  ),
  expense: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  ),
  category: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="10" height="10" rx="2" stroke="currentColor" strokeWidth={stroke} />
    </svg>
  ),
  frequency: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6a4 4 0 1 1 1 5" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
      <path d="M4 3v3h3" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  owner: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth={stroke} />
      <path d="M3.5 13a4.5 4.5 0 0 1 9 0" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  ),
  growth: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 11l4-4 2.5 2.5L13 6" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 6h3v3" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  adjustment: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
      <path d="M3 12h10" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  ),
  projection: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth={stroke} />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
    </svg>
  ),
  asset: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5l5 2.75v5.5L8 13.5l-5-2.75v-5.5L8 2.5Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
    </svg>
  ),
  liability: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2.5l4.5 2.75v5.5L8 13.5l-4.5-2.75v-5.5L8 2.5Z" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
      <path d="M5.5 8h5" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  ),
  source: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 10.5c1.5 1.5 3.5 1.5 5 0s3.5-1.5 5 0" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
      <path d="M3.5 5.5c1.5 1.5 3.5 1.5 5 0s3.5-1.5 5 0" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  ),
  lifecycle: ({ size, stroke }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth={stroke} />
      <path d="M8 8V4.5M8 8l2.5 1.5" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
    </svg>
  ),
};

export default function MoneyMetaTags({ tags }: Props) {
  const theme = useMantineTheme();

  if (tags.length === 0) {
    return null;
  }

  const sortedTags = [...tags].sort(
    (left, right) =>
      moneyTagConfig[left.kind].priority - moneyTagConfig[right.kind].priority
  );

  const iconSize = rem(12);
  const iconStroke = 1.75;

  return (
    <Group gap="xs" wrap="wrap">
      {sortedTags.map((tag) => {
        const config = moneyTagConfig[tag.kind];
        const Icon = iconRegistry[config.icon];
        return (
          <Badge
            key={tag.key}
            size={config.size}
            variant={config.variant}
            radius={config.radius}
            color={config.color}
          >
            <Group gap={theme.spacing.xs} wrap="nowrap">
              <span aria-hidden="true" style={{ display: "inline-flex", lineHeight: 0 }}>
                <Icon size={iconSize} stroke={iconStroke} />
              </span>
              <span>{config.prefix}:</span>
              <span>{tag.label}</span>
            </Group>
          </Badge>
        );
      })}
    </Group>
  );
}
