"use client";

import { Button, Drawer, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { getEventMeta, type EventGroup, type EventType } from "@north-star/engine";
import { useTranslations } from "next-intl";
import type { EventDefinition, TimelineEvent } from "./types";
import {
  buildDefinitionFromTimelineEvent,
  buildTimelineEventFromDefinition,
} from "../../src/domain/events/utils";
import type { ScenarioMember } from "../../src/store/scenarioStore";
import InsuranceProductForm from "./InsuranceProductForm";
import TimelineEventForm from "./TimelineEventForm";
import {
  createEventDefinitionFromTemplate,
  createGroupDefinition,
  getEventFilterOptions,
  getEventLabel,
  iconMap,
  listEventTypesForGroup,
} from "./utils";

type AddEventStep = "group" | "type" | "details" | "groupDetails";

interface TimelineAddEventDrawerProps {
  opened: boolean;
  onClose: () => void;
  baseCurrency: string;
  baseMonth?: string | null;
  members: ScenarioMember[];
  parentGroupOptions: Array<{ value: string; label: string }>;
  onAddDefinition: (definition: EventDefinition) => void;
  onAddHomePosition: () => void;
}

export default function TimelineAddEventDrawer({
  opened,
  onClose,
  baseCurrency,
  baseMonth,
  members,
  parentGroupOptions,
  onAddDefinition,
  onAddHomePosition,
}: TimelineAddEventDrawerProps) {
  const t = useTranslations("timeline");
  const common = useTranslations("common");
  const [step, setStep] = useState<AddEventStep>("group");
  const [selectedGroup, setSelectedGroup] = useState<EventGroup | null>(null);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [draftDefinition, setDraftDefinition] = useState<EventDefinition | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [groupTitle, setGroupTitle] = useState("");

  useEffect(() => {
    if (!opened) {
      setStep("group");
      setSelectedGroup(null);
      setSelectedType(null);
      setDraftDefinition(null);
      setParentId(null);
      setGroupTitle("");
    }
  }, [opened]);

  const eventGroupOptions = getEventFilterOptions(t).filter(
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
    setDraftDefinition(
      createEventDefinitionFromTemplate(type, t, {
        baseCurrency,
        baseMonth,
        memberId: members[0]?.id,
      })
    );
    setStep("details");
  };

  const handleSave = (event: TimelineEvent) => {
    const baseDefinition = buildDefinitionFromTimelineEvent(event);
    onAddDefinition({
      ...baseDefinition,
      parentId: parentId ?? undefined,
    });
    onClose();
  };

  const handleSaveGroup = () => {
    if (!groupTitle.trim()) {
      return;
    }

    onAddDefinition(
      createGroupDefinition(groupTitle.trim(), { parentId: parentId ?? undefined })
    );
    onClose();
  };

  const parentOptions = useMemo(
    () => [{ value: "", label: t("groupNone") }, ...parentGroupOptions],
    [parentGroupOptions, t]
  );

  const draftEvent = draftDefinition
    ? buildTimelineEventFromDefinition(
        draftDefinition,
        { refId: draftDefinition.id, enabled: true },
        {
          baseCurrency,
          fallbackMonth: baseMonth,
        }
      )
    : null;

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
            {eventGroupOptions.map((option) => (
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
            <Button variant="subtle" onClick={() => setStep("groupDetails")}>
              {t("addGroup")}
            </Button>
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
          <Select
            label={t("groupParent")}
            data={parentOptions}
            value={parentId ?? ""}
            onChange={(value) => setParentId(value || null)}
          />
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
              showMember
              onCancel={() => setStep("type")}
              onSave={handleSave}
              submitLabel={t("addEvent")}
            />
          )}
        </Stack>
      )}

      {step === "groupDetails" && (
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Text fw={600}>{t("groupTitle")}</Text>
            <Button variant="subtle" size="xs" onClick={() => setStep("group")}>
              {common("actionBack")}
            </Button>
          </Group>
          <TextInput
            label={t("groupName")}
            value={groupTitle}
            onChange={(eventChange) => setGroupTitle(eventChange.target.value)}
          />
          <Select
            label={t("groupParent")}
            data={parentOptions}
            value={parentId ?? ""}
            onChange={(value) => setParentId(value || null)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              {common("actionCancel")}
            </Button>
            <Button onClick={handleSaveGroup}>{t("addGroup")}</Button>
          </Group>
        </Stack>
      )}
    </Drawer>
  );
}
