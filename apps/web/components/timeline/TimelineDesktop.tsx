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
import TimelineEventForm from "./TimelineEventForm";
import type { TimelineEvent } from "./types";
import {
  createEventFromTemplate,
  eventTypeLabels,
  formatCurrency,
  iconMap,
  mockedEvents,
  templateOptions,
} from "./utils";

export default function TimelineDesktop() {
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

  const handleTemplateSelect = (type: TimelineEvent["type"]) => {
    const newEvent = createEventFromTemplate(type);
    setEvents((current) => [newEvent, ...current]);
    setTemplateOpen(false);
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Timeline</Title>
          <Text c="dimmed" size="sm">
            Review your events in a table view and edit in the side panel.
          </Text>
        </div>
        <Button onClick={() => setTemplateOpen(true)}>+ Add Event</Button>
      </Group>

      <Table striped highlightOnHover withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Enabled</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Start</Table.Th>
            <Table.Th>End</Table.Th>
            <Table.Th>Monthly</Table.Th>
            <Table.Th>One-time</Table.Th>
            <Table.Th>Growth</Table.Th>
            <Table.Th>Currency</Table.Th>
            <Table.Th>Actions</Table.Th>
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
                {event.monthlyAmount > 0
                  ? formatCurrency(event.monthlyAmount, event.currency)
                  : "—"}
              </Table.Td>
              <Table.Td>
                {event.oneTimeAmount > 0
                  ? formatCurrency(event.oneTimeAmount, event.currency)
                  : "—"}
              </Table.Td>
              <Table.Td>
                {event.annualGrowthPct > 0
                  ? `${event.annualGrowthPct}%`
                  : "—"}
              </Table.Td>
              <Table.Td>{event.currency}</Table.Td>
              <Table.Td>
                <Button size="xs" variant="light" onClick={() => setEditingEvent(event)}>
                  Edit
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal
        opened={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Choose a template"
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
        title={editingEvent ? `Edit ${eventTypeLabels[editingEvent.type]}` : "Edit"}
      >
        <TimelineEventForm
          event={editingEvent}
          onCancel={() => setEditingEvent(null)}
          onSave={handleSave}
        />
      </Drawer>
    </Stack>
  );
}
