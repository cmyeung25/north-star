"use client";

import {
  Button,
  Checkbox,
  Drawer,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { getEventMeta, type EventField, type EventGroup, type EventType } from "@north-star/engine";
import { useTranslations } from "next-intl";
import type { EventDefinition, ScenarioEventRef, ScenarioEventView } from "./types";
import {
  buildDefinitionFromTimelineEvent,
  buildTimelineEventFromDefinition,
  resolveEventRule,
} from "../../src/domain/events/utils";
import type { ScenarioMember } from "../../src/store/scenarioStore";
import InsuranceProductForm from "./InsuranceProductForm";
import TimelineEventForm, { type TimelineEventFormResult } from "./TimelineEventForm";
import {
  createEventDefinitionFromTemplate,
  createGroupDefinition,
  getEventFilterOptions,
  getEventLabel,
  iconMap,
  listEventTypesForGroup,
} from "./utils";

type AddEventStep = "group" | "type" | "details" | "groupDetails";

type TimelineEventDrawerBaseProps = {
  opened: boolean;
  onClose: () => void;
  baseCurrency: string;
  baseMonth?: string | null;
  assumptions: { baseMonth: string | null; horizonMonths: number };
  members: ScenarioMember[];
  parentGroupOptions: Array<{ value: string; label: string }>;
};

type TimelineEventDrawerCreateProps = TimelineEventDrawerBaseProps & {
  mode: "create";
  scenarioOptions: Array<{ value: string; label: string }>;
  defaultScenarioId: string;
  defaultMonth?: string | null;
  onAddDefinition: (definition: EventDefinition, scenarioIds: string[]) => void;
  onAddHomePosition: () => void;
  onCreateComplete?: (startMonth?: string | null) => void;
};

type TimelineEventDrawerEditProps = TimelineEventDrawerBaseProps & {
  mode: "edit";
  editingEvent: ScenarioEventView | null;
  onUpdateDefinition: (id: string, patch: Partial<EventDefinition>) => void;
  onUpdateEventRef: (refId: string, patch: Partial<ScenarioEventRef>) => void;
};

type TimelineEventDrawerProps =
  | TimelineEventDrawerCreateProps
  | TimelineEventDrawerEditProps;

export default function TimelineEventDrawer(props: TimelineEventDrawerProps) {
  const t = useTranslations("timeline");
  const common = useTranslations("common");

  const [step, setStep] = useState<AddEventStep>("group");
  const [selectedGroup, setSelectedGroup] = useState<EventGroup | null>(null);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [draftDefinition, setDraftDefinition] = useState<EventDefinition | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [editScope, setEditScope] = useState<"shared" | "scenario">("shared");
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [editingGroupTitle, setEditingGroupTitle] = useState("");

  const scenarioRule =
    props.mode === "edit" && props.editingEvent
      ? resolveEventRule(props.editingEvent.definition, props.editingEvent.ref)
      : null;

  const defaultScenarioId =
    props.mode === "create" ? props.defaultScenarioId : "";
  const editingEvent = props.mode === "edit" ? props.editingEvent : null;

  useEffect(() => {
    if (!props.opened) {
      setStep("group");
      setSelectedGroup(null);
      setSelectedType(null);
      setDraftDefinition(null);
      setParentId(null);
      setGroupTitle("");
      if (props.mode === "create") {
        setSelectedScenarioIds([defaultScenarioId]);
      }
    }
  }, [defaultScenarioId, props.mode, props.opened]);

  useEffect(() => {
    if (props.mode !== "edit" || !editingEvent) {
      return;
    }
    setEditScope("shared");
    setEditingParentId(editingEvent.definition.parentId ?? null);
    setEditingGroupTitle(editingEvent.definition.title);
  }, [editingEvent, props.mode]);

  const eventGroupOptions = getEventFilterOptions(t).filter(
    (option) => option.value !== "all"
  );
  const typeOptions = useMemo(
    () => (selectedGroup ? listEventTypesForGroup(selectedGroup) : []),
    [selectedGroup]
  );

  const parentOptions = useMemo(
    () => [{ value: "", label: t("groupNone") }, ...props.parentGroupOptions],
    [props.parentGroupOptions, t]
  );

  const draftEvent = draftDefinition
    ? buildTimelineEventFromDefinition(
        draftDefinition,
        { refId: draftDefinition.id, enabled: true },
        {
          baseCurrency: props.baseCurrency,
          fallbackMonth: props.baseMonth,
        }
      )
    : null;

  const handleSelectGroup = (group: EventGroup) => {
    setSelectedGroup(group);
    setStep("type");
  };

  const handleSelectType = (type: EventType) => {
    if (props.mode !== "create") {
      return;
    }
    if (type === "buy_home") {
      props.onAddHomePosition();
      props.onClose();
      return;
    }

    setSelectedType(type);
    setDraftDefinition(
      createEventDefinitionFromTemplate(type, t, {
        baseCurrency: props.baseCurrency,
        baseMonth: props.defaultMonth ?? props.baseMonth,
        memberId: props.members[0]?.id,
      })
    );
    setStep("details");
  };

  const handleSaveCreate = (result: TimelineEventFormResult) => {
    if (props.mode !== "create") {
      return;
    }
    const baseDefinition = buildDefinitionFromTimelineEvent(result.event);
    const targets =
      selectedScenarioIds.length > 0 ? selectedScenarioIds : [defaultScenarioId];
    props.onAddDefinition(
      {
        ...baseDefinition,
        parentId: parentId ?? undefined,
      },
      targets
    );
    props.onCreateComplete?.(result.event.startMonth ?? null);
    props.onClose();
  };

  const handleSaveGroup = () => {
    if (props.mode !== "create") {
      return;
    }
    if (!groupTitle.trim()) {
      return;
    }

    const targets =
      selectedScenarioIds.length > 0 ? selectedScenarioIds : [defaultScenarioId];
    props.onAddDefinition(
      createGroupDefinition(groupTitle.trim(), { parentId: parentId ?? undefined }),
      targets
    );
    props.onClose();
  };

  const handleSaveShared = ({
    event: updated,
    ruleMode,
    schedule,
  }: TimelineEventFormResult) => {
    if (props.mode !== "edit" || !editingEvent) {
      return;
    }
    const nextDefinition = buildDefinitionFromTimelineEvent(updated);
    const nextRule = {
      ...nextDefinition.rule,
      mode: ruleMode,
      schedule: ruleMode === "schedule" ? schedule : undefined,
    };
    props.onUpdateDefinition(editingEvent.definition.id, {
      title: nextDefinition.title,
      type: nextDefinition.type,
      rule: nextRule,
      currency: nextDefinition.currency,
      memberId: nextDefinition.memberId,
      templateId: nextDefinition.templateId,
      templateParams: nextDefinition.templateParams,
      parentId: editingParentId ?? undefined,
    });
    props.onClose();
  };

  const handleSaveOverride = ({
    event: updated,
    ruleMode,
    schedule,
  }: TimelineEventFormResult) => {
    if (props.mode !== "edit" || !editingEvent) {
      return;
    }
    props.onUpdateEventRef(editingEvent.ref.refId, {
      overrides: {
        startMonth: updated.startMonth,
        endMonth: updated.endMonth,
        monthlyAmount: updated.monthlyAmount,
        oneTimeAmount: updated.oneTimeAmount,
        annualGrowthPct: updated.annualGrowthPct,
        mode: ruleMode,
        schedule: ruleMode === "schedule" ? schedule : undefined,
      },
    });
    props.onClose();
  };

  const title =
    props.mode === "create"
      ? t("addEvent")
      : editingEvent
        ? editingEvent.definition.kind === "group"
          ? t("groupEditTitle")
          : t("editTitle", {
              type: getEventLabel(t, editingEvent.definition.type),
            })
        : common("actionEdit");

  return (
    <Drawer
      opened={props.opened}
      onClose={props.onClose}
      position="right"
      size="md"
      title={title}
    >
      {props.mode === "create" && (
        <>
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
                  <Button
                    key={type}
                    variant="light"
                    onClick={() => handleSelectType(type)}
                  >
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
              <Stack gap="xs">
                <Text fw={600}>{t("applyToLabel")}</Text>
                <Text size="xs" c="dimmed">
                  {t("applyToHint")}
                </Text>
                <Checkbox.Group
                  value={selectedScenarioIds}
                  onChange={(value) => setSelectedScenarioIds(value)}
                >
                  <Stack gap={4}>
                    {props.scenarioOptions.map((option) => (
                      <Checkbox
                        key={option.value}
                        value={option.value}
                        label={option.label}
                      />
                    ))}
                  </Stack>
                </Checkbox.Group>
              </Stack>
              {selectedType === "insurance_product" ? (
                <InsuranceProductForm
                  event={draftEvent}
                  baseCurrency={props.baseCurrency}
                  members={props.members}
                  onCancel={() => setStep("type")}
                  onSave={(event) => handleSaveCreate({ event, ruleMode: "params" })}
                  submitLabel={t("addEvent")}
                />
              ) : (
                <TimelineEventForm
                  event={draftEvent}
                  baseCurrency={props.baseCurrency}
                  assumptions={props.assumptions}
                  members={props.members}
                  fields={getEventMeta(selectedType).fields}
                  showMember
                  onCancel={() => setStep("type")}
                  onSave={handleSaveCreate}
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
                <Button variant="subtle" onClick={props.onClose}>
                  {common("actionCancel")}
                </Button>
                <Button onClick={handleSaveGroup}>{t("addGroup")}</Button>
              </Group>
            </Stack>
          )}
        </>
      )}

      {props.mode === "edit" && editingEvent && (
        <>
          {editingEvent.definition.kind === "group" ? (
            <Stack gap="md">
              <TextInput
                label={t("groupName")}
                value={editingGroupTitle}
                onChange={(eventChange) => setEditingGroupTitle(eventChange.target.value)}
              />
              <Select
                label={t("groupParent")}
                data={[
                  { value: "", label: t("groupNone") },
                  ...props.parentGroupOptions.filter(
                    (option) => option.value !== editingEvent.definition.id
                  ),
                ]}
                value={editingParentId ?? ""}
                onChange={(value) => setEditingParentId(value || null)}
              />
              <Group justify="flex-end">
                <Button variant="subtle" onClick={props.onClose}>
                  {common("actionCancel")}
                </Button>
                <Button
                  onClick={() => {
                    props.onUpdateDefinition(editingEvent.definition.id, {
                      title:
                        editingGroupTitle.trim() ||
                        editingEvent.definition.title,
                      parentId: editingParentId ?? undefined,
                    });
                    props.onClose();
                  }}
                >
                  {common("actionSaveChanges")}
                </Button>
              </Group>
            </Stack>
          ) : (
            <Stack gap="md">
              <SegmentedControl
                data={[
                  { value: "shared", label: t("editShared") },
                  { value: "scenario", label: t("editScenario") },
                ]}
                value={editScope}
                onChange={(value) => setEditScope(value as "shared" | "scenario")}
              />
              {editScope === "shared" && (
                <Select
                  label={t("groupParent")}
                  data={[
                    { value: "", label: t("groupNone") },
                    ...props.parentGroupOptions.filter(
                      (option) => option.value !== props.editingEvent?.definition.id
                    ),
                  ]}
                  value={editingParentId ?? ""}
                  onChange={(value) => setEditingParentId(value || null)}
                />
              )}
              {editScope === "shared" ? (
                editingEvent.definition.type === "insurance_product" ? (
                  <InsuranceProductForm
                    event={buildTimelineEventFromDefinition(
                      editingEvent.definition,
                      editingEvent.ref,
                      {
                        baseCurrency: props.baseCurrency,
                        fallbackMonth: props.baseMonth,
                      }
                    )}
                    baseCurrency={props.baseCurrency}
                    members={props.members}
                    onCancel={props.onClose}
                    onSave={(event) => handleSaveShared({ event, ruleMode: "params" })}
                    submitLabel={common("actionSaveChanges")}
                  />
                ) : (
                  <TimelineEventForm
                    event={buildTimelineEventFromDefinition(
                      editingEvent.definition,
                      editingEvent.ref,
                      {
                        baseCurrency: props.baseCurrency,
                        fallbackMonth: props.baseMonth,
                      }
                    )}
                    baseCurrency={props.baseCurrency}
                    assumptions={props.assumptions}
                    members={props.members}
                    fields={getEventMeta(editingEvent.definition.type).fields}
                    showMember
                    ruleMode={editingEvent.definition.rule.mode}
                    schedule={editingEvent.definition.rule.schedule}
                    allowCashflowEdit
                    onCancel={props.onClose}
                    onSave={handleSaveShared}
                    submitLabel={common("actionSaveChanges")}
                  />
                )
              ) : (
                <TimelineEventForm
                  event={buildTimelineEventFromDefinition(
                    editingEvent.definition,
                    editingEvent.ref,
                    {
                      baseCurrency: props.baseCurrency,
                      fallbackMonth: props.baseMonth,
                    }
                  )}
                  baseCurrency={props.baseCurrency}
                  assumptions={props.assumptions}
                  members={props.members}
                  ruleMode={scenarioRule?.mode}
                  schedule={scenarioRule?.schedule}
                  fields={[
                    { key: "startMonth", input: "month" },
                    { key: "endMonth", input: "month" },
                    { key: "monthlyAmount", input: "number" },
                    { key: "oneTimeAmount", input: "number" },
                    { key: "annualGrowthPct", input: "percent" },
                  ] satisfies EventField[]}
                  showMember={false}
                  allowCashflowEdit
                  onCancel={props.onClose}
                  onSave={handleSaveOverride}
                  submitLabel={t("saveOverride")}
                />
              )}
            </Stack>
          )}
        </>
      )}
    </Drawer>
  );
}
