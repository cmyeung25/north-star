"use client";

import React from "react";
import { Badge, Group } from "@mantine/core";
import { moneyTagConfig, type MoneyTagItem } from "./moneyTagConfig";

type Props = {
  tags: MoneyTagItem[];
};

export default function MoneyMetaTags({ tags }: Props) {
  if (tags.length === 0) {
    return null;
  }

  const sortedTags = [...tags].sort(
    (left, right) =>
      moneyTagConfig[left.kind].priority - moneyTagConfig[right.kind].priority
  );

  return (
    <Group gap={6} wrap="wrap">
      {sortedTags.map((tag) => {
        const config = moneyTagConfig[tag.kind];
        return (
          <Badge
            key={tag.key}
            size={config.size}
            variant={config.variant}
            radius={config.radius}
            color={config.color}
          >
            {`${config.prefix}: ${config.icon ? `${config.icon} ` : ""}${tag.label}`}
          </Badge>
        );
      })}
    </Group>
  );
}
