"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Notification,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { getEventGroup, getEventMeta, type EventGroup } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import TimelineEventForm from "./TimelineEventForm";
import HomeDetailsForm from "./HomeDetailsForm";
import TimelineAddEventDrawer from "./TimelineAddEventDrawer";
import type { TimelineEvent } from "./types";
import {
  createEventId,
  createHomePositionFromTemplate,
  getEventFilterOptions,
  getEventGroupLabel,
  getEventImpactHint,
  getEventLabel,
  formatCurrency,
  formatDateRange,
  formatHomeSummary,
  iconMap,
} from "./utils";
import type { HomePositionDraft } from "../../src/store/scenarioStore";
import { Link } from "../../src/i18n/navigation";

const floatingButtonStyle = {
  position: "fixed" as const,
  right: 20,
  bottom: 92,
  zIndex: 10,
};

interface TimelineMobileProps {
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

export default function TimelineMobile({
  events,
  homePositions,
  baseCurrency,
  baseMonth,
  scenarioId,
  onEventsChange,
  onHomePositionAdd,
  onHomePositionUpdate,
  onHomePositionRemove,
}: TimelineMobileProps) {
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

  const handleDuplicate = (event: TimelineEvent) => {
    const copy = {
      ...event,
      id: createEventId(),
      name: t("copyName", { name: event.name }),
    };
    onEventsChange([copy, ...events]);
  };

  const handleDelete = (eventId: string) => {
    onEventsChange(events.filter((event) => event.id !== eventId));
  };

  const overviewUrl = buildScenarioUrl("/overview", scenarioId);
  const editingHome =
    homePositions.find((home) => home.id === editingHomeId) ?? null;

  return (
    <Stack gap="lg" pb={120}>
      <Group justify="space-between">
        <div>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("subtitleMobile")}
          </Text>
          {process.env.NODE_ENV === "development" && (
            <Text c="dimmed" size="xs">
              {t("devHint")}
            </Text>
          )}
        </div>
      </Group>

      <SegmentedControl
        data={getEventFilterOptions(t)}
        value={activeGroup}
        onChange={(value) => setActiveGroup(value as "all" | EventGroup)}
      />

      {homeToastOpen && (
        <Notification color="teal" onClose={() => setHomeToastOpen(false)}>
          <Stack gap="xs">
            <Text size="sm">
              {t("homeToast")}
            </Text>
            <Button component={Link} href={overviewUrl} size="xs" variant="light">
              {t("goToOverview")}
            </Button>
          </Stack>
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
            <Card key={home.id} withBorder shadow="sm" radius="md" padding="md">
              <Stack gap="sm">
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
              </Stack>
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
        <Stack gap="md">
          {filteredEvents.map((event) => (
            <Card key={event.id} withBorder shadow="sm" radius="md" padding="md">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Group gap="sm">
                    <Text size="xl">{iconMap[event.type]}</Text>
                    <div>
                      <Badge variant="light" color="gray" size="sm">
                        {getEventGroupLabel(t, event.type)}
                      </Badge>
                      <Text fw={600}>{event.name}</Text>
                      <Text size="xs" c="dimmed">
                        {getEventLabel(t, event.type)}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {formatDateRange(t, event.startMonth, event.endMonth ?? null)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {getEventImpactHint(t, event.type)}
                      </Text>
                    </div>
                  </Group>
                  <Switch
                    checked={event.enabled}
                    onChange={(eventChange) =>
                      handleToggle(event.id, eventChange.currentTarget.checked)
                    }
                    label={t("tableEnabled")}
                  />
                </Group>

                <Group gap="xs">
                  {event.monthlyAmount !== 0 && (
                    <Badge variant="light" color="indigo">
                      {t("monthlyLabel")}{" "}
                      {formatCurrency(event.monthlyAmount, event.currency, locale)}
                    </Badge>
                  )}
                  {event.oneTimeAmount !== 0 && (
                    <Badge variant="light" color="grape">
                      {t("oneTimeLabel")}{" "}
                      {formatCurrency(event.oneTimeAmount, event.currency, locale)}
                    </Badge>
                  )}
                  {event.monthlyAmount === 0 && event.oneTimeAmount === 0 && (
                    <Badge variant="outline">{t("noAmounts")}</Badge>
                  )}
                </Group>

                <Group justify="space-between">
                  <Button size="xs" onClick={() => setEditingEvent(event)}>
                    {common("actionEdit")}
                  </Button>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      aria-label={t("duplicateAria", { name: event.name })}
                      onClick={() => handleDuplicate(event)}
                    >
                      ⧉
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={t("deleteAria", { name: event.name })}
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
      )}

      <Button style={floatingButtonStyle} onClick={() => setAddEventOpen(true)}>
        {t("addEvent")}
      </Button>

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

      <Modal
        opened={Boolean(editingEvent)}
        onClose={() => setEditingEvent(null)}
        title={
          editingEvent
            ? t("editTitle", {
                type: getEventLabel(t, editingEvent.type),
              })
            : common("actionEdit")
        }
        fullScreen
      >
        <TimelineEventForm
          event={editingEvent}
          baseCurrency={baseCurrency}
          fields={editingEvent ? getEventMeta(editingEvent.type).fields : undefined}
          onCancel={() => setEditingEvent(null)}
          onSave={handleSave}
          submitLabel={common("actionSaveChanges")}
        />
      </Modal>

      <Modal
        opened={Boolean(editingHome)}
        onClose={() => setEditingHomeId(null)}
        title={homes("title")}
        fullScreen
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
      </Modal>
    </Stack>
  );
}
