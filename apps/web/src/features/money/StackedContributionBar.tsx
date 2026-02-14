"use client";

import { Box, Card, Group, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { formatCurrency } from "../../../lib/i18n";
import type { ContributionByEvent } from "./incomeViewModels";

type Props = {
  title: string;
  data: ContributionByEvent[];
  currency: string;
  locale: string;
};

const palette = ["#4c6ef5", "#12b886", "#f59f00", "#e64980", "#15aabf", "#845ef7", "#fab005", "#fa5252"];

export default function StackedContributionBar({ title, data, currency, locale }: Props) {
  const withColor = useMemo(
    () => data.map((item, index) => ({ ...item, color: palette[index % palette.length] })),
    [data]
  );

  if (withColor.length === 0) {
    return null;
  }

  return (
    <Card withBorder radius="md" padding="sm">
      <Stack gap="xs">
        <Text fw={600}>{title}</Text>
        <Group gap={0} wrap="nowrap" style={{ borderRadius: 999, overflow: "hidden" }}>
          {withColor.map((item) => (
            <Box
              key={item.id}
              h={14}
              style={{ width: `${Math.max(item.share * 100, 2)}%`, backgroundColor: item.color }}
              title={`${item.label}: ${formatCurrency(item.amount, currency, locale)}`}
            />
          ))}
        </Group>
        <Stack gap={4}>
          {withColor.map((item) => (
            <Group key={`${item.id}-legend`} justify="space-between" wrap="nowrap">
              <Group gap={8} wrap="nowrap">
                <Box w={10} h={10} style={{ borderRadius: 999, backgroundColor: item.color }} />
                <Text size="sm" lineClamp={1}>{item.label}</Text>
              </Group>
              <Text size="sm" fw={600}>{formatCurrency(item.amount, currency, locale)} · {(item.share * 100).toFixed(1)}%</Text>
            </Group>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}
