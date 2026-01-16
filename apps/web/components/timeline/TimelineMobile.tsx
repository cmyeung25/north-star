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
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { getEventMeta, type EventField, type EventGroup } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";
import TimelineEventForm from "./TimelineEventForm";
import InsuranceProductForm from "./InsuranceProductForm";
import HomeDetailsForm from "./HomeDetailsForm";
import TimelineAddEventDrawer from "./TimelineAddEventDrawer";
import type {
  EventDefinition,
  ScenarioEventRef,
  ScenarioEventView,
  TimelineEvent,
} from "./types";
import {
  buildEventTreeRows,
  createDefinitionCopy,
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
import type { HomePositionDraft, ScenarioMember } from "../../src/store/scenarioStore";
import { Link } from "../../src/i18n/navigation";
import {
  buildDefinitionFromTimelineEvent,
  buildTimelineEventFromDefinition,
} from "../../src/domain/events/utils";

const floatingButtonStyle = {
  position: "fixed" as const,
  right: 20,
  bottom: 92,
  zIndex: 10,
};

interface TimelineMobileProps {
  eventViews: ScenarioEventView[];
  eventLibrary: EventDefinition[];
  homePositions: HomePositionDraft[];
  members: ScenarioMember[];
  baseCurrency: string;
  baseMonth?: string | null;
  assumptions: { baseMonth: string | null; horizonMonths: number };
  scenarioId: string;
  onAddDefinition: (definition: EventDefinition) => void;
  onUpdateDefinition: (id: string, patch: Partial<EventDefinition>) => void;
  onUpdateEventRef: (refId: string, patch: Partial<ScenarioEventRef>) => void;
  onRemoveEventRef: (refId: string) => void;
  onHomePositionAdd: (home: HomePositionDraft) => void;
  onHomePositionUpdate: (home: HomePositionDraft) => void;
  onHomePositionRemove: (homeId: string) => void;
}

export default function TimelineMobile({
  eventViews,
  eventLibrary,
  homePositions,
  members,
  baseCurrency,
  baseMonth,
  assumptions,
  scenarioId,
  onAddDefinition,
  onUpdateDefinition,
  onUpdateEventRef,
  onRemoveEventRef,
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
  const [editingEvent, setEditingEvent] = useState<ScenarioEventView | null>(null);
  const [editScope, setEditScope] = useState<"shared" | "scenario">("shared");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null);
  const [homeToastOpen, setHomeToastOpen] = useState(false);

  const eventRows = useMemo(
    () => buildEventTreeRows(eventViews, activeGroup, collapsedGroups),
    [activeGroup, collapsedGroups, eventViews]
  );
  const hasEvents = eventViews.length > 0;

  const parentGroupOptions = useMemo(
    () =>
      eventLibrary
        .filter((definition) => definition.kind === "group")
        .map((definition) => ({
          value: definition.id,
          label: definition.title,
        })),
    [eventLibrary]
  );

  const handleSaveShared = (updated: TimelineEvent) => {
    if (!editingEvent) {
      return;
    }
    const nextDefinition = buildDefinitionFromTimelineEvent(updated);
    onUpdateDefinition(editingEvent.definition.id, {
      title: nextDefinition.title,
      type: nextDefinition.type,
      rule: nextDefinition.rule,
      currency: nextDefinition.currency,
      memberId: nextDefinition.memberId,
      templateId: nextDefinition.templateId,
      templateParams: nextDefinition.templateParams,
      parentId: editingParentId ?? undefined,
    });
    setEditingEvent(null);
  };

  const handleSaveOverride = (updated: TimelineEvent) => {
    if (!editingEvent) {
      return;
    }
    onUpdateEventRef(editingEvent.ref.refId, {
      overrides: {
        startMonth: updated.startMonth,
        endMonth: updated.endMonth,
        monthlyAmount: updated.monthlyAmount,
        oneTimeAmount: updated.oneTimeAmount,
        annualGrowthPct: updated.annualGrowthPct,
      },
    });
    setEditingEvent(null);
  };

  const handleToggle = (eventId: string, enabled: boolean) => {
    onUpdateEventRef(eventId, { enabled });
  };

  const handleDuplicate = (view: ScenarioEventView) => {
    const copy = createDefinitionCopy(
      view.definition,
      t("copyName", { name: view.definition.title })
    );
    onAddDefinition(copy);
  };

  const handleDelete = (eventId: string) => {
    onRemoveEventRef(eventId);
  };

  const handleEditOpen = (view: ScenarioEventView) => {
    setEditingEvent(view);
    setEditScope("shared");
    setEditingParentId(view.definition.parentId ?? null);
    setGroupTitle(view.definition.title);
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
                  >
                    {homes("removeHome")}
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))
        )}
      </Stack>

      {eventRows.length === 0 ? (
        <Text c="dimmed" size="sm">
          {hasEvents ? t("emptyGroup") : t("emptyAll")}
        </Text>
      ) : (
        <Stack gap="md">
          {eventRows.map(({ view, depth, hasChildren }) => {
            const rule = view.rule;
            const isGroup = view.definition.kind === "group";
            const eventCurrency = view.definition.currency ?? baseCurrency;
            const monthlyAmount = rule.monthlyAmount ?? 0;
            const oneTimeAmount = rule.oneTimeAmount ?? 0;
            const collapsed = collapsedGroups[view.definition.id] ?? false;

            return (
              <Card
                key={view.definition.id}
                withBorder
                shadow="sm"
                radius="md"
                padding="md"
              >
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Group gap="sm">
                      <Text size="xl">
                        {isGroup ? "📁" : iconMap[view.definition.type]}
                      </Text>
                      <div>
                        <Badge variant="light" color="gray" size="sm">
                          {isGroup
                            ? t("groupLabel")
                            : getEventGroupLabel(t, view.definition.type)}
                        </Badge>
                        <Text fw={600} style={{ paddingLeft: depth * 12 }}>
                          {view.definition.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {isGroup
                            ? t("groupNode")
                            : getEventLabel(t, view.definition.type)}
                        </Text>
                        {rule.startMonth ? (
                          <Text size="sm" c="dimmed">
                            {formatDateRange(t, rule.startMonth, rule.endMonth ?? null)}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">
                            {t("tablePlaceholder")}
                          </Text>
                        )}
                        {!isGroup && (
                          <Text size="xs" c="dimmed">
                            {getEventImpactHint(t, view.definition.type)}
                          </Text>
                        )}
                      </div>
                    </Group>
                    <Switch
                      checked={view.ref.enabled}
                      onChange={(eventChange) =>
                        handleToggle(
                          view.definition.id,
                          eventChange.currentTarget.checked
                        )
                      }
                      label={t("tableEnabled")}
                    />
                  </Group>

                  <Group gap="xs">
                    {!isGroup && monthlyAmount !== 0 && (
                      <Badge variant="light" color="indigo">
                        {t("monthlyLabel")}{" "}
                        {formatCurrency(monthlyAmount, eventCurrency, locale)}
                      </Badge>
                    )}
                    {!isGroup && oneTimeAmount !== 0 && (
                      <Badge variant="light" color="grape">
                        {t("oneTimeLabel")}{" "}
                        {formatCurrency(oneTimeAmount, eventCurrency, locale)}
                      </Badge>
                    )}
                    {(isGroup || (monthlyAmount === 0 && oneTimeAmount === 0)) && (
                      <Badge variant="outline">{t("noAmounts")}</Badge>
                    )}
                  </Group>

                  <Group justify="space-between">
                    <Group gap="xs" wrap="nowrap">
                      {isGroup && hasChildren && (
                        <ActionIcon
                          variant="subtle"
                          onClick={() =>
                            setCollapsedGroups((current) => ({
                              ...current,
                              [view.definition.id]: !collapsed,
                            }))
                          }
                          aria-label={collapsed ? t("expandGroup") : t("collapseGroup")}
                        >
                          {collapsed ? "▸" : "▾"}
                        </ActionIcon>
                      )}
                      <Button size="xs" onClick={() => handleEditOpen(view)}>
                        {common("actionEdit")}
                      </Button>
                    </Group>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        aria-label={t("duplicateAria", {
                          name: view.definition.title,
                        })}
                        onClick={() => handleDuplicate(view)}
                      >
                        ⧉
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={t("deleteAria", { name: view.definition.title })}
                        onClick={() => handleDelete(view.definition.id)}
                      >
                        🗑️
                      </ActionIcon>
                    </Group>
                  </Group>
                </Stack>
              </Card>
            );
          })}
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
        assumptions={assumptions}
        members={members}
        parentGroupOptions={parentGroupOptions}
        onAddDefinition={(definition) => onAddDefinition(definition)}
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
            ? editingEvent.definition.kind === "group"
              ? t("groupEditTitle")
              : t("editTitle", {
                  type: getEventLabel(t, editingEvent.definition.type),
                })
            : common("actionEdit")
        }
        fullScreen
      >
        {editingEvent && editingEvent.definition.kind === "group" ? (
          <Stack gap="md">
            <TextInput
              label={t("groupName")}
              value={groupTitle}
              onChange={(eventChange) => setGroupTitle(eventChange.target.value)}
            />
            <Select
              label={t("groupParent")}
              data={[
                { value: "", label: t("groupNone") },
                ...parentGroupOptions.filter(
                  (option) => option.value !== editingEvent.definition.id
                ),
              ]}
              value={editingParentId ?? ""}
              onChange={(value) => setEditingParentId(value || null)}
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setEditingEvent(null)}>
                {common("actionCancel")}
              </Button>
              <Button
                onClick={() => {
                  onUpdateDefinition(editingEvent.definition.id, {
                    title: groupTitle.trim() || editingEvent.definition.title,
                    parentId: editingParentId ?? undefined,
                  });
                  setEditingEvent(null);
                }}
              >
                {common("actionSaveChanges")}
              </Button>
            </Group>
          </Stack>
        ) : (
          editingEvent && (
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
                    ...parentGroupOptions.filter(
                      (option) => option.value !== editingEvent.definition.id
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
                        baseCurrency,
                        fallbackMonth: baseMonth,
                      }
                    )}
                    baseCurrency={baseCurrency}
                    members={members}
                    onCancel={() => setEditingEvent(null)}
                    onSave={handleSaveShared}
                    submitLabel={common("actionSaveChanges")}
                  />
                ) : (
                  <TimelineEventForm
                    event={buildTimelineEventFromDefinition(
                      editingEvent.definition,
                      editingEvent.ref,
                      {
                        baseCurrency,
                        fallbackMonth: baseMonth,
                      }
                    )}
                    baseCurrency={baseCurrency}
                    assumptions={assumptions}
                    members={members}
                    fields={getEventMeta(editingEvent.definition.type).fields}
                    showMember
                    onCancel={() => setEditingEvent(null)}
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
                      baseCurrency,
                      fallbackMonth: baseMonth,
                    }
                  )}
                  baseCurrency={baseCurrency}
                  assumptions={assumptions}
                  members={members}
                  fields={[
                    { key: "startMonth", input: "month" },
                    { key: "endMonth", input: "month" },
                    { key: "monthlyAmount", input: "number" },
                    { key: "oneTimeAmount", input: "number" },
                    { key: "annualGrowthPct", input: "percent" },
                  ] satisfies EventField[]}
                  showMember={false}
                  onCancel={() => setEditingEvent(null)}
                  onSave={handleSaveOverride}
                  submitLabel={t("saveOverride")}
                />
              )}
            </Stack>
          )
        )}
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
