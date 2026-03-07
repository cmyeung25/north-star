"use client";

import {
  Badge,
  Button,
  Card,
  Group,
  Notification,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { scenarioMoneyPath } from "../../lib/routes/appRoutes";
import type {
  MilestoneEvent,
  MilestoneEventTemplateType,
} from "../../src/domain/milestoneEvents/types";
import { Link } from "../../src/i18n/navigation";
import {
  type Scenario,
  type ScenarioMember,
  useScenarioStore,
} from "../../src/store/scenarioStore";
import { normalizeMonthStrict } from "../../src/utils/month";
import MonthField from "../MonthField";

type MilestoneMarkerDraft = {
  id?: string;
  label: string;
  effectiveMonth: string;
  memberId: string;
  templateType: MilestoneEventTemplateType;
};

type MilestoneTemplateFilter = "all" | MilestoneEventTemplateType;
type MilestoneSource = "manual" | "system";
type MilestoneSourceFilter = "all" | MilestoneSource;
type MilestoneStatus = "upcoming" | "expired" | "completed";
type MilestoneStatusFilter = "all" | MilestoneStatus;

type MilestoneToastState = {
  color: "teal" | "red" | "orange";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type ManagedMilestoneItem = {
  id: string;
  label: string;
  month: string;
  memberId: string;
  memberName: string;
  templateType: MilestoneEventTemplateType;
  source: MilestoneSource;
  status: MilestoneStatus;
  diffMonths: number | null;
  isSystemDerived: boolean;
};

type PendingDeletedMilestone = {
  scenarioId: string;
  id: string;
  templateType: MilestoneEventTemplateType;
  memberId?: string;
  effectiveMonth: string;
  notes?: string;
};

type MilestoneManagementPanelProps = {
  caseId?: string;
  scenario: Scenario;
  members: ScenarioMember[];
};

const SYSTEM_MILESTONE_ID_PREFIX = "legacy-member-milestone:";

const createMilestoneDraft = (
  baseMonth: string,
  memberId: string
): MilestoneMarkerDraft => ({
  label: "",
  effectiveMonth: baseMonth,
  memberId,
  templateType: "custom",
});

const isSystemMilestoneEvent = (event: Pick<MilestoneEvent, "id" | "templateType">) =>
  event.id.startsWith(SYSTEM_MILESTONE_ID_PREFIX) ||
  event.templateType === "member_retirement";

const monthToIndex = (month: string): number | null => {
  const normalized = normalizeMonthStrict(month);
  if (!normalized.ok) {
    return null;
  }
  const [year, monthNum] = normalized.month.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(monthNum)) {
    return null;
  }
  return year * 12 + (monthNum - 1);
};

const getMonthDiff = (targetMonth: string, baseMonth: string): number | null => {
  const targetIndex = monthToIndex(targetMonth);
  const baseIndex = monthToIndex(baseMonth);
  if (targetIndex === null || baseIndex === null) {
    return null;
  }
  return targetIndex - baseIndex;
};

const resolveMilestoneStatus = (
  targetMonth: string,
  baseMonth: string
): MilestoneStatus => {
  const diff = getMonthDiff(targetMonth, baseMonth);
  if (diff === null || diff >= 0) {
    return "upcoming";
  }
  if (diff >= -6) {
    return "expired";
  }
  return "completed";
};

export default function MilestoneManagementPanel({
  caseId,
  scenario,
  members,
}: MilestoneManagementPanelProps) {
  const moneyT = useTranslations("money");
  const common = useTranslations("common");
  const membersText = useTranslations("members");
  const applyMilestoneEvent = useScenarioStore((state) => state.applyMilestoneEvent);
  const removeMilestoneEvent = useScenarioStore((state) => state.removeMilestoneEvent);

  const scenarioMembers = useMemo(() => {
    const scenarioMemberIdSet = new Set((scenario.members ?? []).map((member) => member.id));
    return members.filter((member) => scenarioMemberIdSet.has(member.id));
  }, [members, scenario.members]);

  const defaultMilestoneMonth = scenario.assumptions.baseMonth ?? "";
  const defaultMilestoneMemberId = scenarioMembers[0]?.id ?? "";
  const [milestoneDraft, setMilestoneDraft] = useState<MilestoneMarkerDraft>(() =>
    createMilestoneDraft(defaultMilestoneMonth, defaultMilestoneMemberId)
  );
  const [milestoneSearchQuery, setMilestoneSearchQuery] = useState("");
  const [milestoneMemberFilter, setMilestoneMemberFilter] = useState("all");
  const [milestoneTemplateFilter, setMilestoneTemplateFilter] =
    useState<MilestoneTemplateFilter>("all");
  const [milestoneSourceFilter, setMilestoneSourceFilter] =
    useState<MilestoneSourceFilter>("all");
  const [milestoneStatusFilter, setMilestoneStatusFilter] =
    useState<MilestoneStatusFilter>("all");
  const [milestoneMonthFrom, setMilestoneMonthFrom] = useState("");
  const [milestoneMonthTo, setMilestoneMonthTo] = useState("");
  const [milestoneToast, setMilestoneToast] = useState<MilestoneToastState | null>(null);
  const [pendingDeletedMilestone, setPendingDeletedMilestone] =
    useState<PendingDeletedMilestone | null>(null);
  const milestoneToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const milestoneUndoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolveMilestoneTemplateLabel = useCallback(
    (templateType: MilestoneEventTemplateType) => {
      switch (templateType) {
        case "member_birth":
          return moneyT("milestoneManagerTemplateBirth");
        case "member_school_start":
          return moneyT("milestoneManagerTemplateSchoolStart");
        case "member_retirement":
          return moneyT("milestoneManagerTemplateRetirement");
        default:
          return moneyT("milestoneManagerTemplateCustom");
      }
    },
    [moneyT]
  );

  const markerMilestoneEvents = useMemo(
    () =>
      [...(scenario.milestoneEvents ?? [])]
        .filter((event) => event.mode !== "impact")
        .sort((left, right) => left.effectiveMonth.localeCompare(right.effectiveMonth)),
    [scenario.milestoneEvents]
  );

  const normalizedMilestoneFilterFrom = milestoneMonthFrom
    ? normalizeMonthStrict(milestoneMonthFrom)
    : null;
  const normalizedMilestoneFilterTo = milestoneMonthTo
    ? normalizeMonthStrict(milestoneMonthTo)
    : null;
  const milestoneMonthFromError =
    milestoneMonthFrom && !normalizedMilestoneFilterFrom?.ok
      ? moneyT("monthFieldError")
      : undefined;
  const milestoneMonthToError =
    milestoneMonthTo && !normalizedMilestoneFilterTo?.ok ? moneyT("monthFieldError") : undefined;
  const milestoneMonthRangeInvalid =
    normalizedMilestoneFilterFrom?.ok &&
    normalizedMilestoneFilterTo?.ok &&
    normalizedMilestoneFilterFrom.month > normalizedMilestoneFilterTo.month;

  const managedMilestoneItems = useMemo<ManagedMilestoneItem[]>(() => {
    const baseMonth = scenario.assumptions.baseMonth ?? defaultMilestoneMonth;
    return markerMilestoneEvents.map((event) => {
      const templateType = event.templateType ?? "custom";
      const memberId = event.memberId ?? "";
      const memberName = scenarioMembers.find((member) => member.id === memberId)?.name ?? "";
      const source: MilestoneSource = isSystemMilestoneEvent(event) ? "system" : "manual";
      const status = resolveMilestoneStatus(event.effectiveMonth, baseMonth);
      const templateLabel = resolveMilestoneTemplateLabel(templateType);
      const label = event.notes?.trim() || templateLabel;
      return {
        id: event.id,
        label,
        month: event.effectiveMonth,
        memberId,
        memberName,
        templateType,
        source,
        status,
        diffMonths: getMonthDiff(event.effectiveMonth, baseMonth),
        isSystemDerived: source === "system",
      };
    });
  }, [defaultMilestoneMonth, markerMilestoneEvents, resolveMilestoneTemplateLabel, scenario.assumptions.baseMonth, scenarioMembers]);

  const filteredMilestoneItems = useMemo(() => {
    const keyword = milestoneSearchQuery.trim().toLowerCase();

    const list = managedMilestoneItems.filter((item) => {
      if (keyword) {
        const searchable = [
          item.label,
          item.memberName,
          item.month,
          resolveMilestoneTemplateLabel(item.templateType),
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(keyword)) {
          return false;
        }
      }

      if (milestoneMemberFilter !== "all" && item.memberId !== milestoneMemberFilter) {
        return false;
      }

      if (milestoneTemplateFilter !== "all" && item.templateType !== milestoneTemplateFilter) {
        return false;
      }

      if (milestoneSourceFilter !== "all" && item.source !== milestoneSourceFilter) {
        return false;
      }

      if (milestoneStatusFilter !== "all" && item.status !== milestoneStatusFilter) {
        return false;
      }

      if (normalizedMilestoneFilterFrom?.ok && item.month < normalizedMilestoneFilterFrom.month) {
        return false;
      }

      if (normalizedMilestoneFilterTo?.ok && item.month > normalizedMilestoneFilterTo.month) {
        return false;
      }

      if (milestoneMonthRangeInvalid) {
        return false;
      }

      return true;
    });

    const groupWeight = (item: ManagedMilestoneItem) => {
      if (item.status === "upcoming") {
        return 0;
      }
      if (item.status === "expired") {
        return 1;
      }
      return 2;
    };

    return list.sort((left, right) => {
      if (left.status !== right.status) {
        return groupWeight(left) - groupWeight(right);
      }
      if (left.diffMonths !== null && right.diffMonths !== null) {
        return left.diffMonths - right.diffMonths;
      }
      return left.month.localeCompare(right.month) || left.label.localeCompare(right.label);
    });
  }, [
    managedMilestoneItems,
    milestoneMemberFilter,
    milestoneMonthRangeInvalid,
    milestoneSearchQuery,
    milestoneSourceFilter,
    milestoneStatusFilter,
    milestoneTemplateFilter,
    normalizedMilestoneFilterFrom,
    normalizedMilestoneFilterTo,
    resolveMilestoneTemplateLabel,
  ]);

  const milestoneHasActiveFilters = Boolean(
    milestoneSearchQuery.trim() ||
      milestoneMemberFilter !== "all" ||
      milestoneTemplateFilter !== "all" ||
      milestoneSourceFilter !== "all" ||
      milestoneStatusFilter !== "all" ||
      milestoneMonthFrom ||
      milestoneMonthTo
  );

  const showMilestoneToast = useCallback((nextToast: MilestoneToastState) => {
    if (milestoneToastTimeoutRef.current) {
      clearTimeout(milestoneToastTimeoutRef.current);
    }
    setMilestoneToast(nextToast);
    milestoneToastTimeoutRef.current = setTimeout(() => {
      setMilestoneToast(null);
      milestoneToastTimeoutRef.current = null;
    }, 6000);
  }, []);

  useEffect(
    () => () => {
      if (milestoneToastTimeoutRef.current) {
        clearTimeout(milestoneToastTimeoutRef.current);
      }
      if (milestoneUndoTimeoutRef.current) {
        clearTimeout(milestoneUndoTimeoutRef.current);
      }
    },
    []
  );

  const handleOpenMilestoneCreate = useCallback(() => {
    const nextDraft = createMilestoneDraft(defaultMilestoneMonth, defaultMilestoneMemberId);
    setMilestoneDraft(nextDraft);
  }, [defaultMilestoneMemberId, defaultMilestoneMonth]);

  const handleClearMilestoneFilters = useCallback(() => {
    setMilestoneSearchQuery("");
    setMilestoneMemberFilter("all");
    setMilestoneTemplateFilter("all");
    setMilestoneSourceFilter("all");
    setMilestoneStatusFilter("all");
    setMilestoneMonthFrom("");
    setMilestoneMonthTo("");
    showMilestoneToast({
      color: "teal",
      message: moneyT("milestoneManagerFiltersClearedToast"),
    });
  }, [moneyT, showMilestoneToast]);

  const handleOpenMilestoneEdit = useCallback(
    (eventId: string) => {
      const target = markerMilestoneEvents.find((event) => event.id === eventId);
      if (!target) {
        return;
      }

      if (isSystemMilestoneEvent(target)) {
        showMilestoneToast({
          color: "orange",
          message: moneyT("milestoneManagerSystemLocked"),
        });
        return;
      }

      const nextDraft: MilestoneMarkerDraft = {
        id: target.id,
        label: target.notes ?? "",
        effectiveMonth: target.effectiveMonth,
        memberId: target.memberId ?? "",
        templateType: target.templateType ?? "custom",
      };
      setMilestoneDraft(nextDraft);
    },
    [markerMilestoneEvents, moneyT, showMilestoneToast]
  );

  useEffect(() => {
    setMilestoneDraft((current) =>
      current.id
        ? current
        : {
            ...current,
            effectiveMonth: defaultMilestoneMonth,
            memberId: current.memberId || defaultMilestoneMemberId,
          }
    );
  }, [defaultMilestoneMemberId, defaultMilestoneMonth]);

  const normalizedMilestoneDraftMonth = normalizeMonthStrict(milestoneDraft.effectiveMonth);
  const milestoneMonthError =
    milestoneDraft.effectiveMonth && !normalizedMilestoneDraftMonth.ok
      ? moneyT("monthFieldError")
      : undefined;

  const selectedDraftMilestone = useMemo(
    () => markerMilestoneEvents.find((event) => event.id === milestoneDraft.id),
    [markerMilestoneEvents, milestoneDraft.id]
  );
  const isEditingSystemMilestone =
    selectedDraftMilestone ? isSystemMilestoneEvent(selectedDraftMilestone) : false;

  const duplicateMilestoneEvent = useMemo(() => {
    if (!normalizedMilestoneDraftMonth.ok) {
      return null;
    }
    return markerMilestoneEvents.find((event) => {
      if (event.id === milestoneDraft.id) {
        return false;
      }
      if (event.effectiveMonth !== normalizedMilestoneDraftMonth.month) {
        return false;
      }
      const memberId = event.memberId ?? "";
      if (memberId !== milestoneDraft.memberId) {
        return false;
      }
      const templateType = event.templateType ?? "custom";
      return templateType === milestoneDraft.templateType;
    });
  }, [
    markerMilestoneEvents,
    milestoneDraft.id,
    milestoneDraft.memberId,
    milestoneDraft.templateType,
    normalizedMilestoneDraftMonth,
  ]);

  const handleUndoDeleteMilestone = useCallback(() => {
    if (!pendingDeletedMilestone || pendingDeletedMilestone.scenarioId !== scenario.id) {
      return;
    }

    const result = applyMilestoneEvent(scenario.id, {
      mode: "marker",
      id: pendingDeletedMilestone.id,
      templateType: pendingDeletedMilestone.templateType,
      memberId: pendingDeletedMilestone.memberId,
      effectiveMonth: pendingDeletedMilestone.effectiveMonth,
      notes: pendingDeletedMilestone.notes,
    });
    if (Object.keys(result.fieldErrors).length > 0) {
      showMilestoneToast({
        color: "red",
        message: moneyT("milestoneManagerSaveFailed"),
      });
      return;
    }

    setPendingDeletedMilestone(null);
    showMilestoneToast({
      color: "teal",
      message: moneyT("milestoneManagerUndoToast"),
    });
  }, [applyMilestoneEvent, moneyT, pendingDeletedMilestone, scenario.id, showMilestoneToast]);

  const handleSaveMilestone = useCallback(() => {
    if (!normalizedMilestoneDraftMonth.ok) {
      return;
    }

    if (isEditingSystemMilestone) {
      showMilestoneToast({
        color: "orange",
        message: moneyT("milestoneManagerSystemLocked"),
      });
      return;
    }

    if (duplicateMilestoneEvent) {
      showMilestoneToast({
        color: "orange",
        message: moneyT("milestoneManagerDuplicateError"),
      });
      return;
    }

    const result = applyMilestoneEvent(scenario.id, {
      mode: "marker",
      id: milestoneDraft.id,
      templateType: milestoneDraft.templateType,
      memberId: milestoneDraft.memberId || undefined,
      effectiveMonth: normalizedMilestoneDraftMonth.month,
      notes: milestoneDraft.label.trim() || undefined,
    });
    if (Object.keys(result.fieldErrors).length > 0) {
      showMilestoneToast({
        color: "red",
        message: moneyT("milestoneManagerSaveFailed"),
      });
      return;
    }

    const nextDraft = createMilestoneDraft(
      normalizedMilestoneDraftMonth.month,
      milestoneDraft.memberId
    );
    setMilestoneDraft(nextDraft);
    showMilestoneToast({
      color: "teal",
      message: moneyT("milestoneManagerSavedToast"),
    });
  }, [
    applyMilestoneEvent,
    duplicateMilestoneEvent,
    isEditingSystemMilestone,
    milestoneDraft.id,
    milestoneDraft.label,
    milestoneDraft.memberId,
    milestoneDraft.templateType,
    moneyT,
    normalizedMilestoneDraftMonth,
    scenario.id,
    showMilestoneToast,
  ]);

  const handleDeleteMilestone = useCallback(
    (eventId: string) => {
      const target = markerMilestoneEvents.find((event) => event.id === eventId);
      if (!target) {
        return;
      }

      const isSystem = isSystemMilestoneEvent(target);
      const confirmMessage = isSystem
        ? moneyT("milestoneManagerDeleteConfirmSystem")
        : moneyT("milestoneManagerDeleteConfirm");

      if (!window.confirm(confirmMessage)) {
        return;
      }

      removeMilestoneEvent(scenario.id, eventId);

      const pending: PendingDeletedMilestone = {
        scenarioId: scenario.id,
        id: target.id,
        templateType: target.templateType ?? "custom",
        memberId: target.memberId,
        effectiveMonth: target.effectiveMonth,
        notes: target.notes,
      };
      setPendingDeletedMilestone(pending);
      if (milestoneUndoTimeoutRef.current) {
        clearTimeout(milestoneUndoTimeoutRef.current);
      }
      milestoneUndoTimeoutRef.current = setTimeout(() => {
        setPendingDeletedMilestone((current) =>
          current?.id === target.id ? null : current
        );
        milestoneUndoTimeoutRef.current = null;
      }, 8000);

      if (milestoneDraft.id === eventId) {
        const resetDraft = createMilestoneDraft(defaultMilestoneMonth, defaultMilestoneMemberId);
        setMilestoneDraft(resetDraft);
      }

      showMilestoneToast({
        color: "teal",
        message: isSystem
          ? moneyT("milestoneManagerDeleteSystemToast")
          : moneyT("milestoneManagerDeletedToast"),
        actionLabel: moneyT("milestoneManagerUndoAction"),
        onAction: handleUndoDeleteMilestone,
      });
    },
    [
      defaultMilestoneMemberId,
      defaultMilestoneMonth,
      handleUndoDeleteMilestone,
      markerMilestoneEvents,
      milestoneDraft.id,
      moneyT,
      removeMilestoneEvent,
      scenario.id,
      showMilestoneToast,
    ]
  );

  const moneyTimelineHref =
    caseId && scenario.id ? `${scenarioMoneyPath(caseId, scenario.id)}?tab=timeline` : "#";

  return (
    <Stack gap="md">
      {milestoneToast && (
        <Notification color={milestoneToast.color} onClose={() => setMilestoneToast(null)}>
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm">{milestoneToast.message}</Text>
            {milestoneToast.actionLabel && milestoneToast.onAction ? (
              <Button size="compact-xs" variant="light" onClick={milestoneToast.onAction}>
                {milestoneToast.actionLabel}
              </Button>
            ) : null}
          </Group>
        </Notification>
      )}

      <Group justify="space-between" align="center" wrap="wrap">
        <Text fw={600}>{moneyT("milestoneManagerTitle")}</Text>
        <Button size="xs" variant="light" onClick={handleOpenMilestoneCreate}>
          {moneyT("milestoneEventCreate")}
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        {moneyT("milestoneManagerHint")}
      </Text>

      <Card withBorder radius="md" padding="sm">
        <Stack gap="xs">
          <TextInput
            label={moneyT("milestoneManagerSearch")}
            placeholder={moneyT("milestoneManagerSearchPlaceholder")}
            value={milestoneSearchQuery}
            onChange={(event) => setMilestoneSearchQuery(event.currentTarget.value)}
          />
          <Group grow align="flex-end" wrap="wrap">
            <Select
              label={moneyT("milestoneMember")}
              value={milestoneMemberFilter}
              data={[
                { value: "all", label: moneyT("milestoneManagerFilterAll") },
                { value: "", label: membersText("householdCardTitle") },
                ...scenarioMembers.map((member) => ({
                  value: member.id,
                  label: member.name,
                })),
              ]}
              onChange={(value) => setMilestoneMemberFilter(value ?? "all")}
            />
            <Select
              label={moneyT("milestoneManagerTemplate")}
              value={milestoneTemplateFilter}
              data={[
                { value: "all", label: moneyT("milestoneManagerFilterAll") },
                { value: "custom", label: resolveMilestoneTemplateLabel("custom") },
                { value: "member_birth", label: resolveMilestoneTemplateLabel("member_birth") },
                {
                  value: "member_school_start",
                  label: resolveMilestoneTemplateLabel("member_school_start"),
                },
                {
                  value: "member_retirement",
                  label: resolveMilestoneTemplateLabel("member_retirement"),
                },
              ]}
              onChange={(value) =>
                setMilestoneTemplateFilter((value as MilestoneTemplateFilter) ?? "all")
              }
            />
            <Select
              label={moneyT("milestoneManagerSource")}
              value={milestoneSourceFilter}
              data={[
                { value: "all", label: moneyT("milestoneManagerFilterAll") },
                { value: "manual", label: moneyT("milestoneManagerSourceManual") },
                { value: "system", label: moneyT("milestoneManagerSourceSystem") },
              ]}
              onChange={(value) =>
                setMilestoneSourceFilter((value as MilestoneSourceFilter) ?? "all")
              }
            />
            <Select
              label={moneyT("milestoneManagerStatus")}
              value={milestoneStatusFilter}
              data={[
                { value: "all", label: moneyT("milestoneManagerFilterAll") },
                { value: "upcoming", label: moneyT("milestoneManagerStatusUpcoming") },
                { value: "expired", label: moneyT("milestoneManagerStatusExpired") },
                { value: "completed", label: moneyT("milestoneManagerStatusCompleted") },
              ]}
              onChange={(value) =>
                setMilestoneStatusFilter((value as MilestoneStatusFilter) ?? "all")
              }
            />
          </Group>
          <Group grow align="flex-end" wrap="wrap">
            <MonthField
              label={moneyT("milestoneManagerMonthFrom")}
              value={milestoneMonthFrom}
              onChange={setMilestoneMonthFrom}
              error={milestoneMonthFromError}
            />
            <MonthField
              label={moneyT("milestoneManagerMonthTo")}
              value={milestoneMonthTo}
              onChange={setMilestoneMonthTo}
              error={
                milestoneMonthToError ??
                (milestoneMonthRangeInvalid
                  ? moneyT("milestoneManagerMonthRangeInvalid")
                  : undefined)
              }
            />
            <Button
              variant="default"
              onClick={handleClearMilestoneFilters}
              disabled={!milestoneHasActiveFilters}
            >
              {moneyT("milestoneManagerClearFilters")}
            </Button>
          </Group>
        </Stack>
      </Card>

      {filteredMilestoneItems.length === 0 ? (
        <Text size="sm" c="dimmed">
          {moneyT("milestoneManagerEmptyFiltered")}
        </Text>
      ) : (
        <Stack gap="xs">
          {filteredMilestoneItems.map((item) => (
            <Card key={item.id} withBorder padding="xs" radius="sm">
              <Stack gap={6}>
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2}>
                    <Text size="sm" fw={600}>
                      {item.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {item.month}
                      {item.memberName ? ` (${item.memberName})` : ""}
                    </Text>
                  </Stack>
                  <Group gap={4}>
                    {item.isSystemDerived ? (
                      <Button component={Link} href={moneyTimelineHref} size="compact-xs" variant="light">
                        {moneyT("milestoneManagerGoToSource")}
                      </Button>
                    ) : (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => handleOpenMilestoneEdit(item.id)}
                      >
                        {common("actionEdit")}
                      </Button>
                    )}
                    <Button
                      size="compact-xs"
                      color="red"
                      variant="subtle"
                      onClick={() => handleDeleteMilestone(item.id)}
                    >
                      {common("actionDelete")}
                    </Button>
                  </Group>
                </Group>
                <Group gap={6}>
                  <Badge variant="light" color={item.source === "system" ? "indigo" : "gray"}>
                    {item.source === "system"
                      ? moneyT("milestoneManagerSourceSystem")
                      : moneyT("milestoneManagerSourceManual")}
                  </Badge>
                  <Badge variant="light" color="teal">
                    {resolveMilestoneTemplateLabel(item.templateType)}
                  </Badge>
                  <Badge
                    variant="light"
                    color={
                      item.status === "upcoming"
                        ? "blue"
                        : item.status === "expired"
                          ? "orange"
                          : "gray"
                    }
                  >
                    {item.status === "upcoming"
                      ? moneyT("milestoneManagerStatusUpcoming")
                      : item.status === "expired"
                        ? moneyT("milestoneManagerStatusExpired")
                        : moneyT("milestoneManagerStatusCompleted")}
                  </Badge>
                </Group>
                {item.isSystemDerived ? (
                  <Text size="xs" c="dimmed">
                    {moneyT("milestoneManagerSystemHint")}
                  </Text>
                ) : null}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}

      <Card withBorder radius="md" padding="sm">
        <Stack gap="xs">
          <Text fw={600}>{moneyT("milestoneManagerEditorTitle")}</Text>
          {isEditingSystemMilestone ? (
            <Text size="xs" c="dimmed">
              {moneyT("milestoneManagerSystemLocked")}
            </Text>
          ) : null}
          <TextInput
            label={moneyT("milestoneNotes")}
            value={milestoneDraft.label}
            disabled={isEditingSystemMilestone}
            onChange={(event) =>
              setMilestoneDraft((current) => ({
                ...current,
                label: event.currentTarget.value,
              }))
            }
          />
          <Select
            label={moneyT("milestoneManagerTemplate")}
            value={milestoneDraft.templateType}
            disabled={isEditingSystemMilestone}
            data={[
              { value: "custom", label: resolveMilestoneTemplateLabel("custom") },
              { value: "member_birth", label: resolveMilestoneTemplateLabel("member_birth") },
              {
                value: "member_school_start",
                label: resolveMilestoneTemplateLabel("member_school_start"),
              },
              {
                value: "member_retirement",
                label: resolveMilestoneTemplateLabel("member_retirement"),
              },
            ]}
            onChange={(value) =>
              setMilestoneDraft((current) => ({
                ...current,
                templateType: (value as MilestoneEventTemplateType) ?? "custom",
              }))
            }
          />
          <MonthField
            label={moneyT("milestoneEffectiveMonth")}
            value={milestoneDraft.effectiveMonth}
            onChange={(value) =>
              setMilestoneDraft((current) => ({
                ...current,
                effectiveMonth: value,
              }))
            }
            error={milestoneMonthError}
            disabled={isEditingSystemMilestone}
          />
          <Select
            label={moneyT("milestoneMember")}
            value={milestoneDraft.memberId}
            disabled={isEditingSystemMilestone}
            data={[
              { value: "", label: membersText("householdCardTitle") },
              ...scenarioMembers.map((member) => ({
                value: member.id,
                label: member.name,
              })),
            ]}
            onChange={(value) =>
              setMilestoneDraft((current) => ({
                ...current,
                memberId: value ?? "",
              }))
            }
          />
          {duplicateMilestoneEvent ? (
            <Text size="xs" c="red">
              {moneyT("milestoneManagerDuplicateError")}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={handleOpenMilestoneCreate}>
              {common("actionClear")}
            </Button>
            <Button
              onClick={handleSaveMilestone}
              disabled={
                !normalizedMilestoneDraftMonth.ok ||
                Boolean(duplicateMilestoneEvent) ||
                isEditingSystemMilestone
              }
            >
              {common("actionSave")}
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="sm">
        <Stack gap={4}>
          <Text fw={600}>{moneyT("milestoneManagerCadenceTitle")}</Text>
          <Text size="xs" c="dimmed">
            {moneyT("milestoneManagerCadenceMonthly")}
          </Text>
          <Text size="xs" c="dimmed">
            {moneyT("milestoneManagerCadenceQuarterly")}
          </Text>
          <Text size="xs" c="dimmed">
            {moneyT("milestoneManagerCadenceAfterEvent")}
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}

