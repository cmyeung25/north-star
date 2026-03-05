"use client";

import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { MilestoneEvent } from "../../src/domain/milestoneEvents/types";

const resolveEventLabel = (t: ReturnType<typeof useTranslations>, event: MilestoneEvent) => {
  switch (event.eventType) {
    case "income":
      return t("milestoneEventTypeIncome");
    case "expense":
      return t("milestoneEventTypeExpense");
    case "asset":
      return t("milestoneEventTypeAsset");
    case "liability":
      return t("milestoneEventTypeLiability");
    default:
      return event.eventType;
  }
};

type EventManagerProps = {
  events: MilestoneEvent[];
  onCreate: () => void;
  onEdit: (event: MilestoneEvent) => void;
  onDelete: (eventId: string) => void;
  highlightedEventId?: string | null;
};

export default function EventManager({
  events,
  onCreate,
  onEdit,
  onDelete,
  highlightedEventId,
}: EventManagerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth)),
    [events]
  );

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={4}>
          <Title order={4}>{t("milestoneEventTitle")}</Title>
          <Text size="sm" c="dimmed">
            {t("milestoneEventHint")}
          </Text>
        </Stack>
        <Button size="xs" variant="light" onClick={onCreate}>
          {t("milestoneEventCreate")}
        </Button>
      </Group>

      {sortedEvents.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("milestoneEventEmpty")}
        </Text>
      ) : (
        <Stack gap="sm">
          {sortedEvents.map((event) => (
            <Card
              key={event.id}
              withBorder
              radius="md"
              padding="sm"
              style={{
                transition: "box-shadow 180ms ease, border-color 180ms ease",
                borderColor: event.id === highlightedEventId ? "var(--mantine-color-teal-5)" : undefined,
                boxShadow:
                  event.id === highlightedEventId
                    ? "0 0 0 2px color-mix(in srgb, var(--mantine-color-teal-4) 35%, transparent)"
                    : undefined,
              }}
            >
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <Stack gap={4}>
                  <Text fw={600}>{resolveEventLabel(t, event)}</Text>
                  <Text size="xs" c="dimmed">
                    {t("milestoneEventMeta", {
                      month: event.effectiveMonth,
                      note: event.notes || "--",
                    })}
                  </Text>
                </Stack>
                <Group gap="xs">
                  <Button size="xs" variant="light" onClick={() => onEdit(event)}>
                    {common("actionEdit")}
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => onDelete(event.id)}
                  >
                    {common("actionDelete")}
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
