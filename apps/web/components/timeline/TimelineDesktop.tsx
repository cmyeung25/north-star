"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Notification,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMemo, useState } from "react";
import { getEventMeta, type EventField, type EventGroup } from "@north-star/engine";
import { useLocale, useTranslations } from "next-intl";
import { defaultCurrency } from "../../lib/i18n";
import {
  buildDefinitionFromTimelineEvent,
  buildTimelineEventFromDefinition,
} from "../../src/domain/events/utils";
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
  createHomePositionFromTemplate,
  getEventFilterOptions,
  getEventGroupLabel,
  getEventImpactHint,
  getEventLabel,
  formatCurrency,
  formatHomeSummary,
  iconMap,
} from "./utils";
import type { HomePositionDraft, ScenarioMember } from "../../src/store/scenarioStore";
import { Link } from "../../src/i18n/navigation";

interface TimelineDesktopProps {
  eventViews: ScenarioEventView[];
  eventLibrary: EventDefinition[];
  homePositions: HomePositionDraft[];
  members: ScenarioMember[];
  baseCurrency: string;
  baseMonth?: string | null;
  scenarioId: string;
  onAddDefinition: (definition: EventDefinition) => void;
  onUpdateDefinition: (id: string, patch: Partial<EventDefinition>) => void;
  onUpdateEventRef: (refId: string, patch: Partial<ScenarioEventRef>) => void;
  onHomePositionAdd: (home: HomePositionDraft) => void;
  onHomePositionUpdate: (home: HomePositionDraft) => void;
  onHomePositionRemove: (homeId: string) => void;
}

export default function TimelineDesktop({
  eventViews,
  eventLibrary,
  homePositions,
  members,
  baseCurrency,
  baseMonth,
  scenarioId,
  onAddDefinition,
  onUpdateDefinition,
  onUpdateEventRef,
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
                  >
                    {homes("removeHome")}
                  </Button>
                </Group>
              </Group>
            </Card>
          ))
        )}
      </Stack>

      {eventRows.length === 0 ? (
        <Text c="dimmed" size="sm">
          {hasEvents ? t("emptyGroup") : t("emptyAll")}
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
            {eventRows.map(({ view, depth, hasChildren }) => {
              const rule = view.rule;
              const isGroup = view.definition.kind === "group";
              const monthlyAmount = rule.monthlyAmount ?? 0;
              const oneTimeAmount = rule.oneTimeAmount ?? 0;
              const annualGrowthPct = rule.annualGrowthPct ?? 0;
              const eventCurrency = view.definition.currency ?? defaultCurrency;
              const hasOverrides =
                Boolean(view.ref.overrides) &&
                Object.keys(view.ref.overrides ?? {}).length > 0;
              const collapsed = collapsedGroups[view.definition.id] ?? false;

              return (
                <Table.Tr key={view.definition.id}>
                  <Table.Td>
                    <Switch
                      checked={view.ref.enabled}
                      onChange={(eventChange) =>
                        handleToggle(
                          view.definition.id,
                          eventChange.currentTarget.checked
                        )
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="gray">
                      {isGroup
                        ? t("groupLabel")
                        : getEventGroupLabel(t, view.definition.type)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {isGroup
                      ? t("groupNode")
                      : `${iconMap[view.definition.type]} ${getEventLabel(
                          t,
                          view.definition.type
                        )}`}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" style={{ paddingLeft: depth * 16 }}>
                      <Text fw={isGroup ? 600 : undefined}>
                        {view.definition.title}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>{rule.startMonth ?? t("tablePlaceholder")}</Table.Td>
                  <Table.Td>{rule.endMonth ?? t("tablePlaceholder")}</Table.Td>
                  <Table.Td>
                    {isGroup
                      ? t("tablePlaceholder")
                      : getEventImpactHint(t, view.definition.type)}
                  </Table.Td>
                  <Table.Td>
                    {isGroup || monthlyAmount === 0
                      ? t("tablePlaceholder")
                      : formatCurrency(monthlyAmount, eventCurrency, locale)}
                  </Table.Td>
                  <Table.Td>
                    {isGroup || oneTimeAmount === 0
                      ? t("tablePlaceholder")
                      : formatCurrency(oneTimeAmount, eventCurrency, locale)}
                  </Table.Td>
                  <Table.Td>
                    {!isGroup && annualGrowthPct > 0
                      ? `${annualGrowthPct}%`
                      : t("tablePlaceholder")}
                  </Table.Td>
                  <Table.Td>{isGroup ? t("tablePlaceholder") : eventCurrency}</Table.Td>
                  <Table.Td>
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
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => handleEditOpen(view)}
                      >
                        {common("actionEdit")}
                      </Button>
                      {hasOverrides && !isGroup && (
                        <Badge variant="light" color="indigo">
                          {t("overrideBadge")}
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <TimelineAddEventDrawer
        opened={addEventOpen}
        onClose={() => setAddEventOpen(false)}
        baseCurrency={baseCurrency}
        baseMonth={baseMonth}
        members={members}
        parentGroupOptions={parentGroupOptions}
        onAddDefinition={(definition) => onAddDefinition(definition)}
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
            ? editingEvent.definition.kind === "group"
              ? t("groupEditTitle")
              : t("editTitle", {
                  type: getEventLabel(t, editingEvent.definition.type),
                })
            : common("actionEdit")
        }
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
