"use client";

import {
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Notification,
  SegmentedControl,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getEventGroup, getEventMeta, type EventGroup } from "@north-star/engine";
import { defaultCurrency, t } from "../../lib/i18n";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import TimelineEventForm from "./TimelineEventForm";
import HomeDetailsForm from "./HomeDetailsForm";
import TimelineAddEventDrawer from "./TimelineAddEventDrawer";
import type { TimelineEvent } from "./types";
import {
  createHomePositionFromTemplate,
  eventFilterOptions,
  getEventGroupLabel,
  getEventImpactHint,
  getEventLabel,
  formatCurrency,
  formatHomeSummary,
  iconMap,
} from "./utils";
import type { HomePositionDraft } from "../../src/store/scenarioStore";

interface TimelineDesktopProps {
  events: TimelineEvent[];
  homePositions: HomePositionDraft[];
  baseCurrency: string;
  baseMonth?: string | null;
  scenarioId: string;
  onEventsChange: (events: TimelineEvent[]) => void;
  onHomePositionAdd: (home: HomePositionDraft) => void;
  onHomePositionUpdate: (home: HomePositionDraft) => void;
  onHomePositionRemove: (homeId: string) => void;
}

export default function TimelineDesktop({
  events,
  homePositions,
  baseCurrency,
  baseMonth,
  scenarioId,
  onEventsChange,
  onHomePositionAdd,
  onHomePositionUpdate,
  onHomePositionRemove,
}: TimelineDesktopProps) {
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<"all" | EventGroup>("all");
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null);
  const [homeToastOpen, setHomeToastOpen] = useState(false);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.startMonth.localeCompare(b.startMonth)),
    [events]
  );
  const filteredEvents = useMemo(() => {
    if (activeGroup === "all") {
      return sortedEvents;
    }
    return sortedEvents.filter((event) => getEventGroup(event.type) === activeGroup);
  }, [activeGroup, sortedEvents]);

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

  const overviewUrl = buildScenarioUrl("/overview", scenarioId);
  const editingHome =
    homePositions.find((home) => home.id === editingHomeId) ?? null;

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
        <Button onClick={() => setAddEventOpen(true)}>
          {t("timelineAddEvent")}
        </Button>
      </Group>

      <SegmentedControl
        data={eventFilterOptions}
        value={activeGroup}
        onChange={(value) => setActiveGroup(value as "all" | EventGroup)}
      />

      {homeToastOpen && (
        <Notification color="teal" onClose={() => setHomeToastOpen(false)}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm">
              Home position added. Check Overview for net worth impact.
            </Text>
            <Button component={Link} href={overviewUrl} size="xs" variant="light">
              Open Overview
            </Button>
          </Group>
        </Notification>
      )}

      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600}>{t("homeDetailsTitle")}</Text>
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              onHomePositionAdd(createHomePositionFromTemplate({ baseMonth }));
              setHomeToastOpen(true);
            }}
          >
            {t("homeDetailsAddHome")}
          </Button>
        </Group>
        {homePositions.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t("homeDetailsEmpty")}
          </Text>
        ) : (
          homePositions.map((home, index) => (
            <Card key={home.id} withBorder padding="md" radius="md">
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Text fw={600}>
                    {t("homeDetailsHomeLabel", { index: index + 1 })}
                  </Text>
                  <Text size="sm">{formatHomeSummary(home, baseCurrency)}</Text>
                  <Text size="xs" c="dimmed">
                    {(home.mode ?? "new_purchase") === "existing"
                      ? `${t("homeDetailsExistingAsOfMonth")}: ${home.existing?.asOfMonth ?? "--"}`
                      : `${t("homeDetailsPurchaseMonth")}: ${home.purchaseMonth ?? "--"}`}
                  </Text>
                </div>
                <Group gap="sm">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setEditingHomeId(home.id)}
                  >
                    {t("timelineEdit")}
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={() => onHomePositionRemove(home.id)}
                    disabled={homePositions.length <= 1}
                  >
                    {t("homeDetailsRemoveHome")}
                  </Button>
                </Group>
              </Group>
            </Card>
          ))
        )}
      </Stack>

      {sortedEvents.length === 0 ? (
        <Text c="dimmed" size="sm">
          Add your first event to start shaping the plan.
        </Text>
      ) : filteredEvents.length === 0 ? (
        <Text c="dimmed" size="sm">
          No events in this group yet.
        </Text>
      ) : (
        <Table striped highlightOnHover withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("timelineTableEnabled")}</Table.Th>
              <Table.Th>Group</Table.Th>
              <Table.Th>{t("timelineTableType")}</Table.Th>
              <Table.Th>{t("timelineTableName")}</Table.Th>
              <Table.Th>{t("timelineTableStart")}</Table.Th>
              <Table.Th>{t("timelineTableEnd")}</Table.Th>
              <Table.Th>Impact</Table.Th>
              <Table.Th>{t("timelineTableMonthly")}</Table.Th>
              <Table.Th>{t("timelineTableOneTime")}</Table.Th>
              <Table.Th>{t("timelineTableGrowth")}</Table.Th>
              <Table.Th>{t("timelineTableCurrency")}</Table.Th>
              <Table.Th>{t("timelineTableActions")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredEvents.map((event) => (
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
                  <Badge variant="light" color="gray">
                    {getEventGroupLabel(event.type)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {iconMap[event.type]} {getEventLabel(event.type)}
                </Table.Td>
                <Table.Td>{event.name}</Table.Td>
                <Table.Td>{event.startMonth}</Table.Td>
                <Table.Td>{event.endMonth ?? "—"}</Table.Td>
                <Table.Td>{getEventImpactHint(event.type)}</Table.Td>
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

      <TimelineAddEventDrawer
        opened={addEventOpen}
        onClose={() => setAddEventOpen(false)}
        baseCurrency={baseCurrency}
        baseMonth={baseMonth}
        onAddEvent={(event) => onEventsChange([event, ...events])}
        onAddHomePosition={() => {
          onHomePositionAdd(createHomePositionFromTemplate({ baseMonth }));
          setHomeToastOpen(true);
        }}
      />

      <Drawer
        opened={Boolean(editingEvent)}
        onClose={() => setEditingEvent(null)}
        position="right"
        size="md"
        title={
          editingEvent
            ? t("timelineEditTitle", {
                type: getEventLabel(editingEvent.type),
              })
            : t("timelineEdit")
        }
      >
        <TimelineEventForm
          event={editingEvent}
          baseCurrency={baseCurrency}
          fields={editingEvent ? getEventMeta(editingEvent.type).fields : undefined}
          onCancel={() => setEditingEvent(null)}
          onSave={handleSave}
        />
      </Drawer>

      <Drawer
        opened={Boolean(editingHome)}
        onClose={() => setEditingHomeId(null)}
        position="right"
        size="md"
        title={t("homeDetailsTitle")}
      >
        {editingHome && (
          <HomeDetailsForm
            home={editingHome}
            onCancel={() => setEditingHomeId(null)}
            onSave={(updated) => {
              onHomePositionUpdate(updated);
              setEditingHomeId(null);
            }}
          />
        )}
      </Drawer>
    </Stack>
  );
}
