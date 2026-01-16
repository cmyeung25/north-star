"use client";

import {
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { buildMonthRange, type EventField, type EventFieldKey } from "@north-star/engine";
import { useTranslations } from "next-intl";
import { normalizeEvent, normalizeMonth } from "../../src/features/timeline/schema";
import type { TimelineEvent } from "./types";
import type { ScenarioAssumptions, ScenarioMember } from "../../src/store/scenarioStore";
import { buildDefinitionFromTimelineEvent } from "../../src/domain/events/utils";
import { compileEventToMonthlyCashflowSeries } from "../../src/domain/events/compiler";
import { getEventSign } from "../../src/events/eventCatalog";
import type { EventRule, EventRuleScheduleEntry } from "../../src/domain/events/types";
import CashflowPreviewChart from "./CashflowPreviewChart";

export type TimelineEventFormResult = {
  event: TimelineEvent;
  ruleMode: EventRule["mode"];
  schedule?: EventRuleScheduleEntry[];
};

interface TimelineEventFormProps {
  event: TimelineEvent | null;
  baseCurrency: string;
  members: ScenarioMember[];
  assumptions: Pick<ScenarioAssumptions, "baseMonth" | "horizonMonths">;
  fields?: readonly EventField[];
  showMember?: boolean;
  ruleMode?: EventRule["mode"];
  schedule?: EventRuleScheduleEntry[];
  allowCashflowEdit?: boolean;
  onCancel: () => void;
  onSave: (result: TimelineEventFormResult) => void;
  submitLabel?: string;
}

const buildScheduleMap = (schedule?: EventRuleScheduleEntry[]) =>
  (schedule ?? []).reduce<Record<string, number>>((result, entry) => {
    result[entry.month] = Math.abs(entry.amount ?? 0);
    return result;
  }, {});

const buildScheduleEntries = (schedule: Record<string, number>) =>
  Object.entries(schedule).map(([month, amount]) => ({
    month,
    amount: Math.abs(amount ?? 0),
  }));

const buildScheduleFromSeries = (series: Array<{ month: string; amount: number }>) =>
  series.reduce<Record<string, number>>((result, point) => {
    const absAmount = Math.abs(point.amount ?? 0);
    if (absAmount > 0) {
      result[point.month] = absAmount;
    }
    return result;
  }, {});

export default function TimelineEventForm({
  event,
  baseCurrency,
  members,
  assumptions,
  fields,
  showMember = true,
  ruleMode: initialRuleMode = "params",
  schedule,
  allowCashflowEdit = false,
  onCancel,
  onSave,
  submitLabel,
}: TimelineEventFormProps) {
  const t = useTranslations("timeline");
  const common = useTranslations("common");
  const validation = useTranslations("validation");
  const [formValues, setFormValues] = useState<TimelineEvent | null>(event);
  const [errors, setErrors] = useState<{ startMonth?: string; endMonth?: string }>(
    {}
  );
  const [cashflowMode, setCashflowMode] = useState<"view" | "edit">("view");
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, number>>({});
  const [ruleMode, setRuleMode] = useState<EventRule["mode"]>(initialRuleMode);
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<number>(0);

  useEffect(() => {
    setFormValues(event);
    setErrors({});
    setCashflowMode("view");
    setRuleMode(initialRuleMode ?? "params");
    setScheduleDraft(buildScheduleMap(schedule));
  }, [event, initialRuleMode, schedule]);

  const fieldKeys = fields?.map((field) => field.key) ?? [];
  const shouldShowField = (key: EventFieldKey) =>
    fieldKeys.length === 0 || fieldKeys.includes(key);

  const updateField = <K extends keyof TimelineEvent>(
    key: K,
    value: TimelineEvent[K]
  ) => {
    setFormValues((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current
    );
  };

  const handleNormalizeMonth = (
    key: "startMonth" | "endMonth",
    value: string | null
  ) => {
    if (!formValues) {
      return;
    }
    const normalized = value ? normalizeMonth(value) : null;
    if (!normalized && value) {
      return;
    }
    if (key === "startMonth") {
      updateField("startMonth", (normalized ?? value ?? "") as TimelineEvent["startMonth"]);
      return;
    }
    updateField("endMonth", (normalized ?? null) as TimelineEvent["endMonth"]);
  };

  const handleSave = () => {
    if (!formValues) {
      return;
    }

    const normalizedStartMonth = normalizeMonth(formValues.startMonth);
    const normalizedEndMonth = formValues.endMonth
      ? normalizeMonth(formValues.endMonth)
      : null;
    const nextErrors: { startMonth?: string; endMonth?: string } = {};

    if (shouldShowField("startMonth") && !normalizedStartMonth) {
      nextErrors.startMonth = validation("useYearMonth");
    }

    if (shouldShowField("endMonth") && formValues.endMonth) {
      if (!normalizedEndMonth) {
        nextErrors.endMonth = validation("useYearMonth");
      } else if (
        normalizedStartMonth &&
        normalizedEndMonth < normalizedStartMonth
      ) {
        nextErrors.endMonth = validation("endMonthAfterStart");
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const normalizedEvent = normalizeEvent(
      {
        ...formValues,
        startMonth: normalizedStartMonth ?? formValues.startMonth,
        endMonth: normalizedEndMonth,
      },
      { baseCurrency }
    );

    let normalizedSchedule: EventRuleScheduleEntry[] | undefined;
    if (ruleMode === "schedule") {
      const entries = buildScheduleEntries(scheduleDraft);
      if (horizonMonthsList.length > 0) {
        const allowedMonths = new Set(horizonMonthsList);
        normalizedSchedule = entries.filter((entry) => allowedMonths.has(entry.month));
      } else {
        normalizedSchedule = entries;
      }
    }

    onSave({
      event: normalizedEvent,
      ruleMode,
      schedule: normalizedSchedule,
    });
  };

  const baseMonth = assumptions.baseMonth ?? formValues?.startMonth ?? null;
  const horizonMonths = assumptions.horizonMonths ?? 0;
  const horizonMonthsList = useMemo(
    () =>
      baseMonth && horizonMonths > 0 ? buildMonthRange(baseMonth, horizonMonths) : [],
    [baseMonth, horizonMonths]
  );
  const scheduleEntries = useMemo(
    () => buildScheduleEntries(scheduleDraft),
    [scheduleDraft]
  );

  const previewSeries = useMemo(() => {
    if (!formValues || !assumptions.baseMonth) {
      return [];
    }

    const definition = buildDefinitionFromTimelineEvent(formValues);
    return compileEventToMonthlyCashflowSeries({
      definition: {
        ...definition,
        rule: {
          ...definition.rule,
          mode: ruleMode,
          schedule: ruleMode === "schedule" ? scheduleEntries : undefined,
        },
      },
      ref: { refId: definition.id, enabled: formValues.enabled },
      assumptions,
      signByType: getEventSign,
    });
  }, [assumptions, formValues, ruleMode, scheduleEntries]);

  const editableSeries = useMemo(() => {
    if (!formValues || horizonMonthsList.length === 0) {
      return [];
    }
    const sign = getEventSign(formValues.type);
    return horizonMonthsList.map((month) => ({
      month,
      amount: sign * (scheduleDraft[month] ?? 0),
    }));
  }, [formValues, horizonMonthsList, scheduleDraft]);

  const canEditCashflow =
    allowCashflowEdit &&
    (shouldShowField("monthlyAmount") || shouldShowField("oneTimeAmount"));

  const handleEditMonth = (month: string, amount: number) => {
    setEditingMonth(month);
    setEditingAmount(Math.abs(amount ?? 0));
  };

  const handleSaveEditMonth = () => {
    if (!editingMonth) {
      return;
    }

    const nextAmount = Math.max(editingAmount, 0);
    setScheduleDraft((current) => {
      const next = { ...current };
      if (nextAmount === 0) {
        delete next[editingMonth];
      } else {
        next[editingMonth] = nextAmount;
      }
      return next;
    });
    setEditingMonth(null);
  };

  if (!formValues) {
    return null;
  }

  const currencyOptions = [
    { value: baseCurrency, label: baseCurrency },
  ];
  const memberOptions = [
    { value: "household", label: t("memberHousehold") },
    ...members.map((member) => ({
      value: member.id,
      label: member.name,
    })),
  ];
  const memberValue = formValues.memberId ?? "household";

  return (
    <Stack gap="md">
      {shouldShowField("name") && (
        <TextInput
          label={t("eventFormName")}
          value={formValues.name}
          onChange={(eventChange) => updateField("name", eventChange.target.value)}
        />
      )}
      {showMember && (
        <Select
          label={t("memberLabel")}
          data={memberOptions}
          value={memberValue}
          onChange={(value) =>
            updateField(
              "memberId",
              value === "household" ? undefined : value ?? undefined
            )
          }
        />
      )}
      {shouldShowField("startMonth") && (
        <TextInput
          label={t("eventFormStartMonth")}
          placeholder={common("yearMonthPlaceholder")}
          value={formValues.startMonth}
          error={errors.startMonth}
          onChange={(eventChange) =>
            updateField("startMonth", eventChange.target.value)
          }
          onBlur={(eventChange) =>
            handleNormalizeMonth("startMonth", eventChange.target.value)
          }
        />
      )}
      {shouldShowField("endMonth") && (
        <TextInput
          label={t("eventFormEndMonth")}
          placeholder={common("yearMonthOptionalPlaceholder")}
          value={formValues.endMonth ?? ""}
          error={errors.endMonth}
          onChange={(eventChange) =>
            updateField("endMonth", eventChange.target.value || null)
          }
          onBlur={(eventChange) =>
            handleNormalizeMonth("endMonth", eventChange.target.value)
          }
        />
      )}
      {shouldShowField("monthlyAmount") && (
        <NumberInput
          label={t("eventFormMonthlyAmount")}
          value={formValues.monthlyAmount}
          onChange={(value) => updateField("monthlyAmount", Number(value ?? 0))}
          thousandSeparator=","
          min={0}
        />
      )}
      {shouldShowField("oneTimeAmount") && (
        <NumberInput
          label={t("eventFormOneTimeAmount")}
          value={formValues.oneTimeAmount}
          onChange={(value) => updateField("oneTimeAmount", Number(value ?? 0))}
          thousandSeparator=","
          min={0}
        />
      )}
      {shouldShowField("annualGrowthPct") && (
        <NumberInput
          label={t("eventFormAnnualGrowth")}
          value={formValues.annualGrowthPct}
          onChange={(value) => {
            const nextValue = Math.min(Math.max(Number(value ?? 0), 0), 100);
            updateField("annualGrowthPct", nextValue);
          }}
          min={0}
          max={100}
          decimalScale={2}
          suffix="%"
        />
      )}
      {(shouldShowField("monthlyAmount") || shouldShowField("oneTimeAmount")) && (
        <Stack gap="xs">
          {canEditCashflow && (
            <Group justify="space-between" align="center" wrap="wrap">
              <SegmentedControl
                data={[
                  { value: "view", label: t("cashflowViewMode") },
                  { value: "edit", label: t("cashflowEditMode") },
                ]}
                value={cashflowMode}
                onChange={(value) => {
                  const nextValue = value as "view" | "edit";
                  setCashflowMode(nextValue);
                  if (nextValue === "edit" && ruleMode === "params") {
                    setRuleMode("schedule");
                    setScheduleDraft(buildScheduleFromSeries(previewSeries));
                  }
                }}
              />
              {ruleMode === "schedule" && (
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    setRuleMode("params");
                    setScheduleDraft({});
                    setCashflowMode("view");
                  }}
                >
                  {t("cashflowRevertToParams")}
                </Button>
              )}
            </Group>
          )}
          {cashflowMode === "edit" && canEditCashflow ? (
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                {t("cashflowEditHint")}
              </Text>
              <CashflowPreviewChart
                series={editableSeries}
                currency={formValues.currency ?? baseCurrency}
                disabled={!formValues.enabled}
                onSelectMonth={({ month, amount }) => handleEditMonth(month, amount)}
              />
            </Stack>
          ) : (
            <CashflowPreviewChart
              series={previewSeries}
              currency={formValues.currency ?? baseCurrency}
              disabled={!formValues.enabled}
            />
          )}
        </Stack>
      )}
      {shouldShowField("currency") && (
        <Select
          label={t("eventFormCurrency")}
          data={currencyOptions}
          value={formValues.currency}
          onChange={(value) => updateField("currency", value ?? baseCurrency)}
        />
      )}
      {shouldShowField("enabled") && (
        <Switch
          label={t("eventFormEnabled")}
          checked={formValues.enabled}
          onChange={(eventChange) =>
            updateField("enabled", eventChange.currentTarget.checked)
          }
        />
      )}
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          {common("actionCancel")}
        </Button>
        <Button onClick={handleSave}>{submitLabel ?? common("actionSave")}</Button>
      </Group>
      <Modal
        opened={Boolean(editingMonth)}
        onClose={() => setEditingMonth(null)}
        title={t("cashflowEditTitle")}
        centered
      >
        <Stack gap="md">
          <Text size="sm">{editingMonth}</Text>
          <NumberInput
            label={t("cashflowEditAmount")}
            value={editingAmount}
            onChange={(value) => setEditingAmount(Number(value ?? 0))}
            thousandSeparator=","
            min={0}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setEditingMonth(null)}>
              {common("actionCancel")}
            </Button>
            <Button onClick={handleSaveEditMonth}>
              {common("actionSave")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
