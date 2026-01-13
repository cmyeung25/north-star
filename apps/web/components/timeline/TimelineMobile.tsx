"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { t } from "../../lib/i18n";
import TimelineEventForm from "./TimelineEventForm";
import type { TimelineEvent } from "./types";
import {
  createEventFromTemplate,
  eventTypeLabels,
  formatCurrency,
  formatDateRange,
  iconMap,
  mockedEvents,
  templateOptions,
} from "./utils";

const floatingButtonStyle = {
  position: "fixed" as const,
  right: 20,
  bottom: 92,
  zIndex: 10,
};

export default function TimelineMobile() {
  const [events, setEvents] = useState<TimelineEvent[]>(mockedEvents);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.startMonth.localeCompare(b.startMonth)),
    [events]
  );

  const handleSave = (updated: TimelineEvent) => {
    setEvents((current) =>
      current.map((event) => (event.id === updated.id ? updated : event))
    );
    setEditingEvent(null);
  };

  const handleToggle = (eventId: string, enabled: boolean) => {
    setEvents((current) =>
      current.map((event) =>
        event.id === eventId ? { ...event, enabled } : event
      )
    );
  };

  const handleDuplicate = (event: TimelineEvent) => {
    const copy = {
      ...event,
      id: createEventFromTemplate(event.type).id,
      name: t("timelineCopyName", { name: event.name }),
    };
    setEvents((current) => [copy, ...current]);
  };

  const handleDelete = (eventId: string) => {
    setEvents((current) => current.filter((event) => event.id !== eventId));
  };

  const handleTemplateSelect = (type: TimelineEvent["type"]) => {
    const newEvent = createEventFromTemplate(type);
    setEvents((current) => [newEvent, ...current]);
    setTemplateOpen(false);
  };

  return (
    <Stack gap="lg" pb={120}>
      <Group justify="space-between">
        <div>
          <Title order={2}>{t("timelineTitle")}</Title>
          <Text c="dimmed" size="sm">
            {t("timelineSubtitleMobile")}
          </Text>
        </div>
      </Group>

      <Stack gap="md">
        {sortedEvents.map((event) => (
          <Card key={event.id} withBorder shadow="sm" radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <Group gap="sm">
                  <Text size="xl">{iconMap[event.type]}</Text>
                  <div>
                    <Text fw={600}>{event.name}</Text>
                    <Text size="sm" c="dimmed">
                      {formatDateRange(event.startMonth, event.endMonth)}
                    </Text>
                  </div>
                </Group>
                <Switch
                  checked={event.enabled}
                  onChange={(eventChange) =>
                    handleToggle(event.id, eventChange.currentTarget.checked)
                  }
                />
              </Group>

              <Group gap="xs">
                {event.monthlyAmount > 0 && (
                  <Badge variant="light" color="indigo">
                    {t("timelineMonthlyLabel")}{" "}
                    {formatCurrency(event.monthlyAmount, event.currency)}
                  </Badge>
                )}
                {event.oneTimeAmount > 0 && (
                  <Badge variant="light" color="grape">
                    {t("timelineOneTimeLabel")}{" "}
                    {formatCurrency(event.oneTimeAmount, event.currency)}
                  </Badge>
                )}
                {event.monthlyAmount === 0 && event.oneTimeAmount === 0 && (
                  <Badge variant="outline">{t("timelineNoAmounts")}</Badge>
                )}
              </Group>

              <Group justify="space-between">
                <Button size="xs" onClick={() => setEditingEvent(event)}>
                  {t("timelineEdit")}
                </Button>
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    aria-label={t("timelineDuplicateAria", { name: event.name })}
                    onClick={() => handleDuplicate(event)}
                  >
                    ⧉
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={t("timelineDeleteAria", { name: event.name })}
                    onClick={() => handleDelete(event.id)}
                  >
                    🗑️
                  </ActionIcon>
                </Group>
              </Group>
            </Stack>
          </Card>
        ))}
      </Stack>

      <Button style={floatingButtonStyle} onClick={() => setTemplateOpen(true)}>
        {t("timelineAddEvent")}
      </Button>

      <Drawer
        opened={templateOpen}
        onClose={() => setTemplateOpen(false)}
        position="bottom"
        size="md"
        title={t("timelineChooseTemplate")}
        radius="md"
      >
        <Stack gap="sm">
          {templateOptions.map((template) => (
            <Button
              key={template.type}
              variant="light"
              onClick={() => handleTemplateSelect(template.type)}
            >
              {iconMap[template.type]} {template.label}
            </Button>
          ))}
        </Stack>
      </Drawer>

      <Modal
        opened={Boolean(editingEvent)}
        onClose={() => setEditingEvent(null)}
        title={
          editingEvent
            ? t("timelineEditTitle", {
                type: eventTypeLabels[editingEvent.type],
              })
            : t("timelineEdit")
        }
        fullScreen
      >
        <TimelineEventForm
          event={editingEvent}
          onCancel={() => setEditingEvent(null)}
          onSave={handleSave}
          submitLabel={t("timelineSaveChanges")}
        />
      </Modal>
    </Stack>
  );
}
