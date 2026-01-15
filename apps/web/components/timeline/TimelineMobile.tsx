"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  Notification,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import { useMemo, useState } from "react";
import { t } from "../../lib/i18n";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import TimelineEventForm from "./TimelineEventForm";
import HomeDetailsForm from "./HomeDetailsForm";
import type { TimelineEvent } from "./types";
import {
  createEventId,
  createHomePositionFromTemplate,
  createEventFromTemplate,
  eventTypeLabels,
  formatCurrency,
  formatDateRange,
  formatHomeSummary,
  iconMap,
  templateOptions,
} from "./utils";
import type { HomePositionDraft } from "../../src/store/scenarioStore";

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
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null);
  const [homeToastOpen, setHomeToastOpen] = useState(false);

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

  const handleDuplicate = (event: TimelineEvent) => {
    const copy = {
      ...event,
      id: createEventId(),
      name: t("timelineCopyName", { name: event.name }),
    };
    onEventsChange([copy, ...events]);
  };

  const handleDelete = (eventId: string) => {
    onEventsChange(events.filter((event) => event.id !== eventId));
  };

  const handleTemplateSelect = (type: TimelineEvent["type"]) => {
    if (type === "buy_home") {
      onHomePositionAdd(createHomePositionFromTemplate({ baseMonth }));
      setHomeToastOpen(true);
      setTemplateOpen(false);
      return;
    }

    const newEvent = createEventFromTemplate(type, {
      baseCurrency,
      baseMonth,
    });
    onEventsChange([newEvent, ...events]);
    setTemplateOpen(false);
  };

  const overviewUrl = buildScenarioUrl("/overview", scenarioId);
  const editingHome =
    homePositions.find((home) => home.id === editingHomeId) ?? null;

  return (
    <Stack gap="lg" pb={120}>
      <Group justify="space-between">
        <div>
          <Title order={2}>{t("timelineTitle")}</Title>
          <Text c="dimmed" size="sm">
            {t("timelineSubtitleMobile")}
          </Text>
          {process.env.NODE_ENV === "development" && (
            <Text c="dimmed" size="xs">
              Changes affect projections in Overview immediately.
            </Text>
          )}
        </div>
      </Group>

      {homeToastOpen && (
        <Notification color="teal" onClose={() => setHomeToastOpen(false)}>
          <Stack gap="xs">
            <Text size="sm">
              Home position added. Check Overview for net worth impact.
            </Text>
            <Button component={Link} href={overviewUrl} size="xs" variant="light">
              Open Overview
            </Button>
          </Stack>
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
            <Card key={home.id} withBorder shadow="sm" radius="md" padding="md">
              <Stack gap="sm">
                <div>
                  <Text fw={600}>
                    {t("homeDetailsHomeLabel", { index: index + 1 })}
                  </Text>
                  <Text size="sm">{formatHomeSummary(home, baseCurrency)}</Text>
                  <Text size="xs" c="dimmed">
                    Purchase month: {home.purchaseMonth}
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
              </Stack>
            </Card>
          ))
        )}
      </Stack>

      {sortedEvents.length === 0 ? (
        <Text c="dimmed" size="sm">
          Add your first event to start shaping the plan.
        </Text>
      ) : (
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
                        {formatDateRange(event.startMonth, event.endMonth ?? null)}
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
                  {event.monthlyAmount !== 0 && (
                    <Badge variant="light" color="indigo">
                      {t("timelineMonthlyLabel")} {" "}
                      {formatCurrency(event.monthlyAmount, event.currency)}
                    </Badge>
                  )}
                  {event.oneTimeAmount !== 0 && (
                    <Badge variant="light" color="grape">
                      {t("timelineOneTimeLabel")} {" "}
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
      )}

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
          baseCurrency={baseCurrency}
          onCancel={() => setEditingEvent(null)}
          onSave={handleSave}
          submitLabel={t("timelineSaveChanges")}
        />
      </Modal>

      <Modal
        opened={Boolean(editingHome)}
        onClose={() => setEditingHomeId(null)}
        title={t("homeDetailsTitle")}
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
