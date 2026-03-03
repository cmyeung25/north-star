"use client";

import React from "react";
import { Card, Group, Stack, Text } from "@mantine/core";

type Props = {
  title: string;
  primaryAmount: string;
  metaTags: React.ReactNode;
  monthRange: React.ReactNode;
  projectionSummary: React.ReactNode;
  adjustmentSummary: React.ReactNode;
  actions: React.ReactNode;
};

export default function MoneyEventCard({
  title,
  primaryAmount,
  metaTags,
  monthRange,
  projectionSummary,
  adjustmentSummary,
  actions,
}: Props) {
  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={4} flex={1}>
          <Stack gap={2} data-testid="money-event-card-section-title-amount">
            <Text fw={600}>{title}</Text>
            <Text fw={700}>{primaryAmount}</Text>
          </Stack>
          <div data-testid="money-event-card-section-meta-tags">{metaTags}</div>
          <div data-testid="money-event-card-section-month-range">{monthRange}</div>
          <div data-testid="money-event-card-section-projection-summary">{projectionSummary}</div>
          <div data-testid="money-event-card-section-adjustment-summary">{adjustmentSummary}</div>
        </Stack>
        <div data-testid="money-event-card-section-actions">{actions}</div>
      </Group>
    </Card>
  );
}
