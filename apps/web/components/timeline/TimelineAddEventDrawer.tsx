"use client";

import { Button, Drawer, Group, Stack, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { getEventMeta, type EventGroup, type EventType } from "@north-star/engine";
import { useTranslations } from "next-intl";
import type { TimelineEvent } from "./types";
import type { ScenarioMember } from "../../src/store/scenarioStore";
import InsuranceProductForm from "./InsuranceProductForm";
import TimelineEventForm from "./TimelineEventForm";
import {
  createEventFromTemplate,
  getEventFilterOptions,
  getEventLabel,
  iconMap,
  listEventTypesForGroup,
} from "./utils";

type AddEventStep = "group" | "type" | "details";

interface TimelineAddEventDrawerProps {
  opened: boolean;
  onClose: () => void;
  baseCurrency: string;
  baseMonth?: string | null;
  members: ScenarioMember[];
  onAddEvent: (event: TimelineEvent) => void;
  onAddHomePosition: () => void;
}

export default function TimelineAddEventDrawer({
  opened,
  onClose,
  baseCurrency,
  baseMonth,
  members,
  onAddEvent,
  onAddHomePosition,
}: TimelineAddEventDrawerProps) {
  const t = useTranslations("timeline");
  const common = useTranslations("common");
  const [step, setStep] = useState<AddEventStep>("group");
  const [selectedGroup, setSelectedGroup] = useState<EventGroup | null>(null);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [draftEvent, setDraftEvent] = useState<TimelineEvent | null>(null);

  useEffect(() => {
    if (!opened) {
      setStep("group");
      setSelectedGroup(null);
      setSelectedType(null);
      setDraftEvent(null);
    }
  }, [opened]);

  const groupOptions = getEventFilterOptions(t).filter(
    (option) => option.value !== "all"
  );
  const typeOptions = useMemo(
    () => (selectedGroup ? listEventTypesForGroup(selectedGroup) : []),
    [selectedGroup]
  );

  const handleSelectGroup = (group: EventGroup) => {
    setSelectedGroup(group);
    setStep("type");
  };

  const handleSelectType = (type: EventType) => {
    if (type === "buy_home") {
      onAddHomePosition();
      onClose();
      return;
    }

    setSelectedType(type);
    setDraftEvent(
      createEventFromTemplate(type, t, {
        baseCurrency,
        baseMonth,
        memberId: members[0]?.id,
      })
    );
    setStep("details");
  };

  const handleSave = (event: TimelineEvent) => {
    onAddEvent(event);
    onClose();
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="md"
      title={t("addEvent")}
    >
      {step === "group" && (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {t("chooseGroupHint")}
          </Text>
          <Stack gap="xs">
            {groupOptions.map((option) => (
              <Button
                key={option.value}
                variant="light"
                onClick={() => handleSelectGroup(option.value as EventGroup)}
                disabled={
                  listEventTypesForGroup(option.value as EventGroup).length === 0
                }
              >
                {option.label}
              </Button>
            ))}
          </Stack>
        </Stack>
      )}

      {step === "type" && selectedGroup && (
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={600}>{t("chooseTemplate")}</Text>
            <Button variant="subtle" size="xs" onClick={() => setStep("group")}>
              {common("actionBack")}
            </Button>
          </Group>
          <Stack gap="xs">
            {typeOptions.map((type) => (
              <Button key={type} variant="light" onClick={() => handleSelectType(type)}>
                {iconMap[type]} {getEventLabel(t, type)}
              </Button>
            ))}
          </Stack>
        </Stack>
      )}

      {step === "details" && draftEvent && selectedType && (
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={600}>{getEventLabel(t, selectedType)}</Text>
            <Button variant="subtle" size="xs" onClick={() => setStep("type")}>
              {common("actionBack")}
            </Button>
          </Group>
          {selectedType === "insurance_product" ? (
            <InsuranceProductForm
              event={draftEvent}
              baseCurrency={baseCurrency}
              members={members}
              onCancel={() => setStep("type")}
              onSave={handleSave}
              submitLabel={t("addEvent")}
            />
          ) : (
            <TimelineEventForm
              event={draftEvent}
              baseCurrency={baseCurrency}
              members={members}
              fields={getEventMeta(selectedType).fields}
              onCancel={() => setStep("type")}
              onSave={handleSave}
              submitLabel={t("addEvent")}
            />
          )}
        </Stack>
      )}
    </Drawer>
  );
}
