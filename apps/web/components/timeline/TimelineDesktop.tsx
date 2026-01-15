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
import { useMemo, useState } from "react";
import { getEventGroup, getEventMeta, type EventGroup } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { defaultCurrency } from "../../lib/i18n";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import TimelineEventForm from "./TimelineEventForm";
import HomeDetailsForm from "./HomeDetailsForm";
import TimelineAddEventDrawer from "./TimelineAddEventDrawer";
import type { TimelineEvent } from "./types";
import {
  createHomePositionFromTemplate,
  getEventFilterOptions,
  getEventGroupLabel,
  getEventImpactHint,
  getEventLabel,
  formatCurrency,
  formatHomeSummary,
  iconMap,
} from "./utils";
import type { HomePositionDraft } from "../../src/store/scenarioStore";
import { Link } from "../../src/i18n/navigation";

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
  const t = useTranslations("timeline");
  const common = useTranslations("common");
  const homes = useTranslations("homes");
  const locale = useLocale();
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
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("subtitleDesktop")}
          </Text>
          {process.env.NODE_ENV === "development" && (
            <Text c="dimmed" size="xs">
              {t("devHint")}
            </Text>
          )}
        </div>
        <Button onClick={() => setAddEventOpen(true)}>
          {t("addEvent")}
        </Button>
      </Group>

      <SegmentedControl
        data={getEventFilterOptions(t)}
        value={activeGroup}
        onChange={(value) => setActiveGroup(value as "all" | EventGroup)}
      />

      {homeToastOpen && (
        <Notification color="teal" onClose={() => setHomeToastOpen(false)}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm">
              {t("homeToast")}
            </Text>
            <Button component={Link} href={overviewUrl} size="xs" variant="light">
              {t("goToOverview")}
            </Button>
          </Group>
        </Notification>
      )}

      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Text fw={600}>{homes("title")}</Text>
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              onHomePositionAdd(createHomePositionFromTemplate({ baseMonth }));
              setHomeToastOpen(true);
            }}
          >
            {homes("addHome")}
          </Button>
        </Group>
        {homePositions.length === 0 ? (
          <Text c="dimmed" size="sm">
            {homes("empty")}
          </Text>
        ) : (
          homePositions.map((home, index) => (
            <Card key={home.id} withBorder padding="md" radius="md">
              <Group justify="space-between" align="center" wrap="wrap">
                <div>
                  <Text fw={600}>
                    {homes("homeLabel", { index: index + 1 })}
                  </Text>
                  <Text size="sm">
                    {formatHomeSummary(homes, home, baseCurrency, locale)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {(home.mode ?? "new_purchase") === "existing"
                      ? `${homes("existingAsOfMonth")}: ${home.existing?.asOfMonth ?? "--"}`
                      : `${homes("purchaseMonth")}: ${home.purchaseMonth ?? "--"}`}
                  </Text>
                </div>
                <Group gap="sm">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setEditingHomeId(home.id)}
                  >
                    {common("actionEdit")}
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={() => onHomePositionRemove(home.id)}
                    disabled={homePositions.length <= 1}
                  >
                    {homes("removeHome")}
                  </Button>
                </Group>
              </Group>
            </Card>
          ))
        )}
      </Stack>

      {sortedEvents.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t("emptyAll")}
        </Text>
      ) : filteredEvents.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t("emptyGroup")}
        </Text>
      ) : (
        <Table striped highlightOnHover withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("tableEnabled")}</Table.Th>
              <Table.Th>{t("tableGroup")}</Table.Th>
              <Table.Th>{t("tableType")}</Table.Th>
              <Table.Th>{t("tableName")}</Table.Th>
              <Table.Th>{t("tableStart")}</Table.Th>
              <Table.Th>{t("tableEnd")}</Table.Th>
              <Table.Th>{t("tableImpact")}</Table.Th>
              <Table.Th>{t("tableMonthly")}</Table.Th>
              <Table.Th>{t("tableOneTime")}</Table.Th>
              <Table.Th>{t("tableGrowth")}</Table.Th>
              <Table.Th>{t("tableCurrency")}</Table.Th>
              <Table.Th>{t("tableActions")}</Table.Th>
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
                    {getEventGroupLabel(t, event.type)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {iconMap[event.type]} {getEventLabel(t, event.type)}
                </Table.Td>
                <Table.Td>{event.name}</Table.Td>
                <Table.Td>{event.startMonth}</Table.Td>
                <Table.Td>{event.endMonth ?? t("tablePlaceholder")}</Table.Td>
                <Table.Td>{getEventImpactHint(t, event.type)}</Table.Td>
                <Table.Td>
                  {event.monthlyAmount !== 0
                    ? formatCurrency(event.monthlyAmount, event.currency, locale)
                    : t("tablePlaceholder")}
                </Table.Td>
                <Table.Td>
                  {event.oneTimeAmount !== 0
                    ? formatCurrency(event.oneTimeAmount, event.currency, locale)
                    : t("tablePlaceholder")}
                </Table.Td>
                <Table.Td>
                  {event.annualGrowthPct && event.annualGrowthPct > 0
                    ? `${event.annualGrowthPct}%`
                    : t("tablePlaceholder")}
                </Table.Td>
                <Table.Td>{event.currency ?? defaultCurrency}</Table.Td>
                <Table.Td>
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => setEditingEvent(event)}
                  >
                    {common("actionEdit")}
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
            ? t("editTitle", {
                type: getEventLabel(t, editingEvent.type),
              })
            : common("actionEdit")
        }
      >
        <TimelineEventForm
          event={editingEvent}
          baseCurrency={baseCurrency}
          fields={editingEvent ? getEventMeta(editingEvent.type).fields : undefined}
          onCancel={() => setEditingEvent(null)}
          onSave={handleSave}
          submitLabel={common("actionSaveChanges")}
        />
      </Drawer>

      <Drawer
        opened={Boolean(editingHome)}
        onClose={() => setEditingHomeId(null)}
        position="right"
        size="md"
        title={homes("title")}
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
