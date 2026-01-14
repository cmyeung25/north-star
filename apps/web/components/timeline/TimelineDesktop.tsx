"use client";

import {
  Button,
  Drawer,
  Group,
  Modal,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { defaultCurrency, t } from "../../lib/i18n";
import TimelineEventForm from "./TimelineEventForm";
import type { TimelineEvent } from "./types";
import {
  createEventFromTemplate,
  eventTypeLabels,
  formatCurrency,
  iconMap,
  templateOptions,
} from "./utils";

interface TimelineDesktopProps {
  events: TimelineEvent[];
  baseCurrency: string;
  baseMonth?: string | null;
  onEventsChange: (events: TimelineEvent[]) => void;
}

export default function TimelineDesktop({
  events,
  baseCurrency,
  baseMonth,
  onEventsChange,
}: TimelineDesktopProps) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.startMonth.localeCompare(b.startMonth)),
    [events]
  );

  const handleSave = (updated: TimelineEvent) => {
    onEventsChange(
      events.map((event) => (event.id === updated.id ? updated : event))
    );
    setEditingEvent(null);
  };

  const handleToggle = (eventId: string, enabled: boolean) => {
    onEventsChange(
      events.map((event) =>
        event.id === eventId ? { ...event, enabled } : event
      )
    );
  };

  const handleTemplateSelect = (type: TimelineEvent["type"]) => {
    const newEvent = createEventFromTemplate(type, {
      baseCurrency,
      baseMonth,
    });
    onEventsChange([newEvent, ...events]);
    setTemplateOpen(false);
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>{t("timelineTitle")}</Title>
          <Text c="dimmed" size="sm">
            {t("timelineSubtitleDesktop")}
          </Text>
          {process.env.NODE_ENV === "development" && (
            <Text c="dimmed" size="xs">
              Changes affect projections in Overview immediately.
            </Text>
          )}
        </div>
        <Button onClick={() => setTemplateOpen(true)}>
          {t("timelineAddEvent")}
        </Button>
      </Group>

      {sortedEvents.length === 0 ? (
        <Text c="dimmed" size="sm">
          Add your first event to start shaping the plan.
        </Text>
      ) : (
        <Table striped highlightOnHover withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("timelineTableEnabled")}</Table.Th>
              <Table.Th>{t("timelineTableType")}</Table.Th>
              <Table.Th>{t("timelineTableName")}</Table.Th>
              <Table.Th>{t("timelineTableStart")}</Table.Th>
              <Table.Th>{t("timelineTableEnd")}</Table.Th>
              <Table.Th>{t("timelineTableMonthly")}</Table.Th>
              <Table.Th>{t("timelineTableOneTime")}</Table.Th>
              <Table.Th>{t("timelineTableGrowth")}</Table.Th>
              <Table.Th>{t("timelineTableCurrency")}</Table.Th>
              <Table.Th>{t("timelineTableActions")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedEvents.map((event) => (
              <Table.Tr key={event.id}>
                <Table.Td>
                  <Switch
                    checked={event.enabled}
                    onChange={(eventChange) =>
                      handleToggle(event.id, eventChange.currentTarget.checked)
                    }
                  />
                </Table.Td>
                <Table.Td>
                  {iconMap[event.type]} {eventTypeLabels[event.type]}
                </Table.Td>
                <Table.Td>{event.name}</Table.Td>
                <Table.Td>{event.startMonth}</Table.Td>
                <Table.Td>{event.endMonth ?? "—"}</Table.Td>
                <Table.Td>
                  {event.monthlyAmount !== 0
                    ? formatCurrency(event.monthlyAmount, event.currency)
                    : "—"}
                </Table.Td>
                <Table.Td>
                  {event.oneTimeAmount !== 0
                    ? formatCurrency(event.oneTimeAmount, event.currency)
                    : "—"}
                </Table.Td>
                <Table.Td>
                  {event.annualGrowthPct && event.annualGrowthPct > 0
                    ? `${event.annualGrowthPct}%`
                    : "—"}
                </Table.Td>
                <Table.Td>{event.currency ?? defaultCurrency}</Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setEditingEvent(event)}
                  >
                    {t("timelineEdit")}
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title={t("timelineChooseTemplate")}
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
      </Modal>

      <Drawer
        opened={Boolean(editingEvent)}
        onClose={() => setEditingEvent(null)}
        position="right"
        size="md"
        title={
          editingEvent
            ? t("timelineEditTitle", {
                type: eventTypeLabels[editingEvent.type],
              })
            : t("timelineEdit")
        }
      >
        <TimelineEventForm
          event={editingEvent}
          baseCurrency={baseCurrency}
          onCancel={() => setEditingEvent(null)}
          onSave={handleSave}
        />
      </Drawer>
    </Stack>
  );
}
