"use client";

import {
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Text,
  Title,
  Transition,
} from "@mantine/core";
import { useMemo, useState } from "react";
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
  onDelete: (eventId: string) => Promise<boolean>;
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
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [removingEventId, setRemovingEventId] = useState<string | null>(null);
  const [confirmingEvent, setConfirmingEvent] = useState<MilestoneEvent | null>(null);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth)),
    [events]
  );

  const handleConfirmDelete = async () => {
    if (!confirmingEvent || deletingEventId) {
      return;
    }
    const eventId = confirmingEvent.id;
    setDeletingEventId(eventId);
    setRemovingEventId(eventId);
    setConfirmingEvent(null);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 180);
    });

    const deleted = await onDelete(eventId);
    if (!deleted) {
      setRemovingEventId(null);
    }
    setDeletingEventId(null);
  };

  return (
    <Stack gap="md">
      <Modal
        opened={Boolean(confirmingEvent)}
        onClose={() => (deletingEventId ? null : setConfirmingEvent(null))}
        title={t("milestoneEventDeleteConfirmTitle")}
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            {t("milestoneEventDeleteConfirmDescription", {
              label: confirmingEvent ? resolveEventLabel(t, confirmingEvent) : "",
            })}
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmingEvent(null)}>
              {common("actionCancel")}
            </Button>
            <Button color="red" loading={Boolean(deletingEventId)} onClick={handleConfirmDelete}>
              {common("actionDelete")}
            </Button>
          </Group>
        </Stack>
      </Modal>
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
            <Transition
              key={event.id}
              mounted={removingEventId !== event.id}
              transition="fade-down"
              duration={180}
              timingFunction="ease"
            >
              {(styles) => (
                <Card
                  withBorder
                  radius="md"
                  padding="sm"
                  style={{
                    ...styles,
                    transition: "box-shadow 180ms ease, border-color 180ms ease, opacity 180ms ease",
                    borderColor: event.id === highlightedEventId ? "var(--mantine-color-teal-5)" : undefined,
                    boxShadow:
                      event.id === highlightedEventId
                        ? "0 0 0 2px color-mix(in srgb, var(--mantine-color-teal-4) 35%, transparent)"
                        : undefined,
                    opacity: deletingEventId === event.id ? 0.6 : undefined,
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
                      <Button
                        size="xs"
                        variant="light"
                        disabled={Boolean(deletingEventId)}
                        onClick={() => onEdit(event)}
                      >
                        {common("actionEdit")}
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        loading={deletingEventId === event.id}
                        disabled={Boolean(deletingEventId)}
                        onClick={() => setConfirmingEvent(event)}
                      >
                        {common("actionDelete")}
                      </Button>
                    </Group>
                  </Group>
                </Card>
              )}
            </Transition>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
