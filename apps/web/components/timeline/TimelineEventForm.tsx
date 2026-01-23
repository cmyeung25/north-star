"use client";

import {
  Button,
  Card,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { buildMonthRange, type EventField, type EventFieldKey } from "@north-star/engine";
import { useTranslations } from "next-intl";
import { normalizeEvent } from "../../src/features/timeline/schema";
import {
  isValidMonthStr,
  normalizeMonthInput,
  normalizeMonthStrict,
} from "../../src/utils/month";
import type { TimelineEvent } from "./types";
import type { ScenarioAssumptions, ScenarioMember } from "../../src/store/scenarioStore";
import { monthAtAge, monthsBetween } from "../../src/domain/members/age";
import { buildDefinitionFromTimelineEvent } from "../../src/domain/events/utils";
import { compileEventToMonthlyCashflowSeries } from "../../src/domain/events/compiler";
import { getEventMeta, getEventSign } from "../../src/events/eventCatalog";
import type {
  EventRule,
  EventRuleScheduleEntry,
  SalaryStep,
} from "../../src/domain/events/types";
import CashflowPreviewChart from "./CashflowPreviewChart";
import EndConditionPicker, { type EndConditionMode } from "../EndConditionPicker";
import DateOrAgeBasisPicker from "../DateOrAgeBasisPicker";

export type TimelineEventFormResult = {
  event: TimelineEvent;
  ruleMode: EventRule["mode"];
  schedule?: EventRuleScheduleEntry[];
  salarySteps?: SalaryStep[];
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
  salarySteps?: SalaryStep[];
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

const buildSalaryScheduleEntries = (params: {
  baseMonth: string;
  horizonMonths: number;
  eventStartMonth: string;
  eventEndMonth?: string | null;
  annualGrowthPct?: number;
  member?: ScenarioMember;
  steps: SalaryStep[];
  baseMonthlyAmount: number;
}): EventRuleScheduleEntry[] => {
  const {
    baseMonth,
    horizonMonths,
    eventStartMonth,
    eventEndMonth,
    annualGrowthPct = 0,
    member,
    steps,
    baseMonthlyAmount,
  } = params;
  const normalizedBase = normalizeMonthStrict(baseMonth);
  const normalizedStart = normalizeMonthStrict(eventStartMonth);
  if (!normalizedBase.ok || !normalizedStart.ok || horizonMonths <= 0) {
    return [];
  }
  const normalizedEnd = eventEndMonth ? normalizeMonthStrict(eventEndMonth) : null;
  const effectiveEnd = normalizedEnd?.ok ? normalizedEnd.month : null;
  const months = buildMonthRange(normalizedBase.month, horizonMonths);
  const monthlyFactor = Math.pow(1 + annualGrowthPct / 100, 1 / 12);
  const resolvedSteps = steps.flatMap((step) => {
    if (step.basis === "month") {
      const normalized = normalizeMonthStrict(step.startMonth ?? "");
      if (!normalized.ok) {
        return [];
      }
      return [
        {
          id: step.id,
          startMonth: normalized.month,
          monthlyAmount: Math.abs(step.monthlyAmount ?? 0),
        },
      ];
    }
    if (!member) {
      return [];
    }
    const month = monthAtAge(member, step.startAgeYears ?? 0, normalizedBase.month);
    if (!month) {
      return [];
    }
    return [
      {
        id: step.id,
        startMonth: month,
        monthlyAmount: Math.abs(step.monthlyAmount ?? 0),
      },
    ];
  });

  const filteredSteps = resolvedSteps.filter(
    (step) => step.startMonth >= normalizedStart.month
  );
  const allSteps = [
    {
      id: "base",
      startMonth: normalizedStart.month,
      monthlyAmount: Math.abs(baseMonthlyAmount ?? 0),
    },
    ...filteredSteps,
  ].sort((a, b) => a.startMonth.localeCompare(b.startMonth));

  let stepIndex = 0;
  const schedule: EventRuleScheduleEntry[] = [];

  for (const month of months) {
    if (monthsBetween(normalizedStart.month, month) < 0) {
      continue;
    }
    if (effectiveEnd && monthsBetween(month, effectiveEnd) > 0) {
      break;
    }
    while (
      stepIndex + 1 < allSteps.length &&
      monthsBetween(allSteps[stepIndex + 1].startMonth, month) <= 0
    ) {
      stepIndex += 1;
    }
    const step = allSteps[stepIndex];
    const monthsSinceStart = monthsBetween(step.startMonth, month);
    if (monthsSinceStart < 0) {
      continue;
    }
    const amount = step.monthlyAmount * Math.pow(monthlyFactor, monthsSinceStart);
    schedule.push({ month, amount: Math.round(amount) });
  }

  return schedule;
};

export default function TimelineEventForm({
  event,
  baseCurrency,
  members,
  assumptions,
  fields,
  showMember = true,
  ruleMode: initialRuleMode = "params",
  schedule,
  salarySteps: initialSalarySteps,
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
  const [startMonthInput, setStartMonthInput] = useState(event?.startMonth ?? "");
  const [endMonthInput, setEndMonthInput] = useState(event?.endMonth ?? "");
  const [endConditionMode, setEndConditionMode] = useState<EndConditionMode>(
    event?.endAtAgeYears ? "age" : "month"
  );
  const [cashflowMode, setCashflowMode] = useState<"view" | "edit">("view");
  const [scheduleDraft, setScheduleDraft] = useState<Record<string, number>>({});
  const [ruleMode, setRuleMode] = useState<EventRule["mode"]>(initialRuleMode);
  const [salarySteps, setSalarySteps] = useState<SalaryStep[]>(
    initialSalarySteps ?? []
  );
  const [salaryStepErrors, setSalaryStepErrors] = useState<
    Record<string, { startMonth?: string; startAgeYears?: string; monthlyAmount?: string }>
  >({});
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<number>(0);
  const [endAtAgeError, setEndAtAgeError] = useState<string | null>(null);
  const lastManualEndMonthRef = useRef<string>("");

  useEffect(() => {
    setFormValues(event);
    setErrors({});
    setStartMonthInput(event?.startMonth ?? "");
    setEndMonthInput(event?.endMonth ?? "");
    setEndConditionMode(event?.endAtAgeYears ? "age" : "month");
    setCashflowMode("view");
    setRuleMode(initialRuleMode ?? "params");
    setScheduleDraft(buildScheduleMap(schedule));
    setSalarySteps(initialSalarySteps ?? []);
    setSalaryStepErrors({});
    setEndAtAgeError(null);
    lastManualEndMonthRef.current = event?.endMonth ?? "";
  }, [event, initialRuleMode, schedule, initialSalarySteps]);

  const fieldKeys = fields?.map((field) => field.key) ?? [];
  const shouldShowField = (key: EventFieldKey) =>
    fieldKeys.length === 0 || fieldKeys.includes(key);

  const updateField = useCallback(
    <K extends keyof TimelineEvent>(key: K, value: TimelineEvent[K]) => {
      setFormValues((current) =>
        current
          ? {
              ...current,
              [key]: value,
            }
          : current
      );
    },
    []
  );

  const handleNormalizeMonth = (key: "startMonth" | "endMonth", value: string) => {
    if (!formValues) {
      return;
    }

    const normalized = normalizeMonthStrict(value);
    if (normalized.ok) {
      if (key === "startMonth") {
        setStartMonthInput(normalized.month);
        updateField("startMonth", normalized.month as TimelineEvent["startMonth"]);
      } else {
        setEndMonthInput(normalized.month);
        updateField("endMonth", normalized.month as TimelineEvent["endMonth"]);
      }
      setErrors((current) => ({ ...current, [key]: undefined }));
      return;
    }

    if (value.trim() === "") {
      if (key === "startMonth") {
        updateField("startMonth", "" as TimelineEvent["startMonth"]);
      } else {
        updateField("endMonth", null as TimelineEvent["endMonth"]);
      }
      setErrors((current) => ({ ...current, [key]: undefined }));
      return;
    }

    setErrors((current) => ({ ...current, [key]: validation("useYearMonth") }));
  };

  const handleSave = () => {
    if (!formValues) {
      return;
    }

    const normalizedStartMonth = normalizeMonthStrict(startMonthInput);
    const normalizedEndMonth =
      endConditionMode === "month" && endMonthInput.trim() !== ""
        ? normalizeMonthStrict(endMonthInput)
        : null;
    const nextErrors: { startMonth?: string; endMonth?: string } = {};

    if (
      shouldShowField("startMonth") &&
      !normalizedStartMonth.ok
    ) {
      nextErrors.startMonth = validation("useYearMonth");
    }

    if (shouldShowField("endMonth") && endConditionMode === "month") {
      if (endMonthInput.trim() !== "") {
        if (!normalizedEndMonth?.ok) {
          nextErrors.endMonth = validation("useYearMonth");
        } else if (
          normalizedStartMonth.ok &&
          normalizedEndMonth.month < normalizedStartMonth.month
        ) {
          nextErrors.endMonth = validation("endMonthAfterStart");
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!normalizedStartMonth.ok) {
      return;
    }

    if (endConditionMode === "age" && formValues.endAtAgeYears && endAtAgeError) {
      return;
    }

    if (isSalaryEvent && salarySteps.length > 0) {
      const nextStepErrors: Record<
        string,
        { startMonth?: string; startAgeYears?: string; monthlyAmount?: string }
      > = {};
      salarySteps.forEach((step) => {
        if (!step.monthlyAmount || step.monthlyAmount <= 0) {
          nextStepErrors[step.id] = {
            ...nextStepErrors[step.id],
            monthlyAmount: validation("amountRequired"),
          };
        }
        if (step.basis === "month") {
          const normalized = normalizeMonthStrict(step.startMonth ?? "");
          if (!normalized.ok) {
            nextStepErrors[step.id] = {
              ...nextStepErrors[step.id],
              startMonth: validation("useYearMonth"),
            };
          }
        } else {
          if (!selectedMember) {
            nextStepErrors[step.id] = {
              ...nextStepErrors[step.id],
              startAgeYears: t("salaryStepsMissingMember"),
            };
          } else if (typeof step.startAgeYears !== "number" || step.startAgeYears < 0) {
            nextStepErrors[step.id] = {
              ...nextStepErrors[step.id],
              startAgeYears: t("salaryStepAgeRequired"),
            };
          }
        }
      });
      if (Object.keys(nextStepErrors).length > 0) {
        setSalaryStepErrors(nextStepErrors);
        return;
      }
      setSalaryStepErrors({});
    }

    const resolvedEndMonth =
      endConditionMode === "age"
        ? computedEndMonth
        : normalizedEndMonth?.ok
          ? normalizedEndMonth.month
          : null;

    const normalizedEvent = normalizeEvent(
      {
        ...formValues,
        incomeSubtype:
          getEventMeta(formValues.type).group === "income"
            ? formValues.incomeSubtype ?? "salary"
            : formValues.incomeSubtype,
        startMonth: normalizedStartMonth.ok
          ? normalizedStartMonth.month
          : formValues.startMonth,
        endMonth: resolvedEndMonth ?? null,
        endAtAgeYears: endConditionMode === "age" ? formValues.endAtAgeYears : undefined,
      },
      { baseCurrency }
    );

    let normalizedSchedule: EventRuleScheduleEntry[] | undefined;
    if (isSalaryEvent && salarySteps.length > 0) {
      normalizedSchedule = buildSalaryScheduleEntries({
        baseMonth: assumptions.baseMonth ?? normalizedStartMonth.month,
        horizonMonths: assumptions.horizonMonths ?? 0,
        eventStartMonth: normalizedStartMonth.month,
        eventEndMonth: resolvedEndMonth ?? null,
        annualGrowthPct: normalizedEvent.annualGrowthPct ?? 0,
        member: selectedMember,
        steps: salarySteps,
        baseMonthlyAmount: normalizedEvent.monthlyAmount ?? 0,
      });
    } else if (ruleMode === "schedule") {
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
      ruleMode: isSalaryEvent && salarySteps.length > 0 ? "schedule" : ruleMode,
      schedule: normalizedSchedule,
      salarySteps: salarySteps.length > 0 ? salarySteps : undefined,
    });
  };

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

  const isIncomeEvent = formValues
    ? getEventMeta(formValues.type).group === "income"
    : false;
  const isSalaryEvent = formValues?.type === "salary";
  const selectedMember = formValues
    ? members.find((member) => member.id === formValues.memberId)
    : undefined;
  const canUseEndAtAge = Boolean(
    formValues && isIncomeEvent && selectedMember?.kind === "person"
  );
  const handleEndConditionModeChange = (nextMode: EndConditionMode) => {
    setEndConditionMode(nextMode);
    if (nextMode === "age") {
      lastManualEndMonthRef.current = endMonthInput;
      setEndMonthInput("");
      updateField("endMonth", null as TimelineEvent["endMonth"]);
      setErrors((current) => ({ ...current, endMonth: undefined }));
    } else {
      updateField("endAtAgeYears", undefined);
      setEndAtAgeError(null);
      const restored = lastManualEndMonthRef.current;
      setEndMonthInput(restored);
      const normalized = normalizeMonthInput(restored);
      if (normalized.status === "valid" && normalized.month) {
        updateField("endMonth", normalized.month as TimelineEvent["endMonth"]);
      } else if (normalized.status === "empty") {
        updateField("endMonth", null as TimelineEvent["endMonth"]);
      }
    }
  };

  useEffect(() => {
    if (!canUseEndAtAge && endConditionMode === "age") {
      setEndConditionMode("month");
      updateField("endAtAgeYears", undefined);
    }
  }, [canUseEndAtAge, endConditionMode, updateField]);

  const computedEndMonth = useMemo(() => {
    if (!formValues?.endAtAgeYears || !canUseEndAtAge) {
      return null;
    }
    if (!assumptions.baseMonth || !selectedMember) {
      return null;
    }
    return monthAtAge(selectedMember, formValues.endAtAgeYears, assumptions.baseMonth);
  }, [
    assumptions.baseMonth,
    canUseEndAtAge,
    formValues?.endAtAgeYears,
    selectedMember,
  ]);

  useEffect(() => {
    if (endConditionMode !== "age") {
      setEndAtAgeError(null);
      return;
    }
    if (!formValues?.endAtAgeYears) {
      updateField("endMonth", null as TimelineEvent["endMonth"]);
      setEndAtAgeError(null);
      return;
    }
    if (!assumptions.baseMonth || !selectedMember) {
      updateField("endMonth", null as TimelineEvent["endMonth"]);
      setEndAtAgeError(t("endAtAgeMissingBase"));
      return;
    }
    if (!computedEndMonth) {
      updateField("endMonth", null as TimelineEvent["endMonth"]);
      setEndAtAgeError(t("endAtAgeMissingBirth"));
      return;
    }
    setEndAtAgeError(null);
    updateField("endMonth", computedEndMonth as TimelineEvent["endMonth"]);
  }, [
    assumptions.baseMonth,
    computedEndMonth,
    endConditionMode,
    formValues?.endAtAgeYears,
    selectedMember,
    t,
    updateField,
  ]);

  useEffect(() => {
    if (!selectedMember || !formValues) {
      setSalarySteps((current) =>
        current.map((step) =>
          step.basis === "age"
            ? {
                ...step,
                basis: "month",
                startMonth: formValues?.startMonth ?? step.startMonth,
                startAgeYears: undefined,
              }
            : step
        )
      );
    }
  }, [formValues, selectedMember]);

  const salaryScheduleEntries = useMemo(() => {
    if (!formValues || !isSalaryEvent || salarySteps.length === 0) {
      return [];
    }
    if (!assumptions.baseMonth || !isValidMonthStr(assumptions.baseMonth)) {
      return [];
    }

    const resolvedEndMonth =
      endConditionMode === "age"
        ? computedEndMonth
        : formValues.endMonth ?? null;

    return buildSalaryScheduleEntries({
      baseMonth: assumptions.baseMonth,
      horizonMonths: assumptions.horizonMonths ?? 0,
      eventStartMonth: formValues.startMonth,
      eventEndMonth: resolvedEndMonth,
      annualGrowthPct: formValues.annualGrowthPct ?? 0,
      member: selectedMember,
      steps: salarySteps,
      baseMonthlyAmount: formValues.monthlyAmount ?? 0,
    });
  }, [
    assumptions.baseMonth,
    assumptions.horizonMonths,
    computedEndMonth,
    endConditionMode,
    formValues,
    isSalaryEvent,
    salarySteps,
    selectedMember,
  ]);

  const baseMonth = assumptions.baseMonth ?? null;
  const fallbackMonth = isValidMonthStr(formValues?.startMonth ?? "")
    ? formValues?.startMonth ?? null
    : null;
  const previewBaseMonth = isValidMonthStr(baseMonth ?? "") ? baseMonth : fallbackMonth;
  const horizonMonths = assumptions.horizonMonths ?? 0;
  const horizonMonthsList = useMemo(
    () =>
      previewBaseMonth && horizonMonths > 0
        ? buildMonthRange(previewBaseMonth, horizonMonths)
        : [],
    [previewBaseMonth, horizonMonths]
  );
  const scheduleEntries = useMemo(
    () => buildScheduleEntries(scheduleDraft),
    [scheduleDraft]
  );
  const effectiveRuleMode =
    isSalaryEvent && salarySteps.length > 0 ? "schedule" : ruleMode;
  const effectiveScheduleEntries =
    isSalaryEvent && salarySteps.length > 0
      ? salaryScheduleEntries
      : effectiveRuleMode === "schedule"
        ? scheduleEntries
        : undefined;

  const previewSeries = useMemo(() => {
    if (!formValues) {
      return [];
    }
    if (!assumptions.baseMonth || !isValidMonthStr(assumptions.baseMonth)) {
      return [];
    }

    const definition = buildDefinitionFromTimelineEvent(formValues);
    try {
      return compileEventToMonthlyCashflowSeries({
        definition: {
          ...definition,
          rule: {
            ...definition.rule,
            mode: effectiveRuleMode,
            schedule:
              effectiveRuleMode === "schedule" ? effectiveScheduleEntries : undefined,
          },
        },
        ref: { refId: definition.id, enabled: formValues.enabled },
        assumptions,
        signByType: getEventSign,
      });
    } catch {
      return [];
    }
  }, [assumptions, effectiveRuleMode, effectiveScheduleEntries, formValues]);

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
    (shouldShowField("monthlyAmount") || shouldShowField("oneTimeAmount")) &&
    salarySteps.length === 0;

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
  const incomeSubtypeOptions = [
    { value: "salary", label: t("incomeSubtypeSalary") },
    { value: "bonus", label: t("incomeSubtypeBonus") },
    { value: "freelance", label: t("incomeSubtypeFreelance") },
    { value: "rental", label: t("incomeSubtypeRental") },
    { value: "dividend", label: t("incomeSubtypeDividend") },
    { value: "interest", label: t("incomeSubtypeInterest") },
    { value: "other", label: t("incomeSubtypeOther") },
  ];

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
      {isIncomeEvent && (
        <Select
          label={t("incomeSubtypeLabel")}
          data={incomeSubtypeOptions}
          value={formValues.incomeSubtype ?? "salary"}
          onChange={(value) =>
            updateField(
              "incomeSubtype",
              (value ?? "salary") as TimelineEvent["incomeSubtype"]
            )
          }
        />
      )}
      {shouldShowField("startMonth") && (
        <TextInput
          label={t("eventFormStartMonth")}
          placeholder={common("yearMonthPlaceholder")}
          value={startMonthInput}
          error={errors.startMonth}
          onChange={(eventChange) => {
            const nextValue = eventChange.target.value;
            setStartMonthInput(nextValue);
            const normalized = normalizeMonthInput(nextValue);
            if (normalized.status === "valid" && normalized.month) {
              updateField("startMonth", normalized.month as TimelineEvent["startMonth"]);
            } else if (normalized.status === "empty") {
              updateField("startMonth", "" as TimelineEvent["startMonth"]);
            } else {
              updateField("startMonth", "" as TimelineEvent["startMonth"]);
            }
            if (errors.startMonth) {
              setErrors((current) => ({ ...current, startMonth: undefined }));
            }
          }}
          onBlur={(eventChange) =>
            handleNormalizeMonth("startMonth", eventChange.target.value)
          }
        />
      )}
      {shouldShowField("endMonth") &&
        (canUseEndAtAge ? (
          <EndConditionPicker
            mode={endConditionMode}
            onModeChange={handleEndConditionModeChange}
            monthLabel={t("eventFormEndMonth")}
            monthPlaceholder={common("yearMonthOptionalPlaceholder")}
            monthValue={endMonthInput}
            monthError={errors.endMonth}
            onMonthChange={(value) => {
              setEndMonthInput(value);
              const normalized = normalizeMonthInput(value);
              if (normalized.status === "valid" && normalized.month) {
                updateField("endMonth", normalized.month as TimelineEvent["endMonth"]);
              } else if (normalized.status === "empty") {
                updateField("endMonth", null as TimelineEvent["endMonth"]);
              } else {
                updateField("endMonth", null as TimelineEvent["endMonth"]);
              }
              if (errors.endMonth) {
                setErrors((current) => ({ ...current, endMonth: undefined }));
              }
              lastManualEndMonthRef.current = value;
            }}
            onMonthBlur={() => handleNormalizeMonth("endMonth", endMonthInput)}
            ageLabel={t("endAtAgeLabel")}
            ageValue={formValues.endAtAgeYears ?? ""}
            ageError={endAtAgeError ?? undefined}
            onAgeChange={(value) => {
              if (typeof value === "number") {
                updateField("endAtAgeYears", value);
              } else {
                updateField("endAtAgeYears", undefined);
                setEndAtAgeError(null);
              }
            }}
            monthOptionLabel={t("endConditionMonth")}
            ageOptionLabel={t("endConditionAge")}
            computedMonthLabel={t("endConditionComputed")}
            computedMonthValue={computedEndMonth}
          />
        ) : (
          <TextInput
            label={t("eventFormEndMonth")}
            placeholder={common("yearMonthOptionalPlaceholder")}
            value={endMonthInput}
            error={errors.endMonth}
            onChange={(eventChange) => {
              const nextValue = eventChange.target.value;
              setEndMonthInput(nextValue);
              const normalized = normalizeMonthInput(nextValue);
              if (normalized.status === "valid" && normalized.month) {
                updateField("endMonth", normalized.month as TimelineEvent["endMonth"]);
              } else if (normalized.status === "empty") {
                updateField("endMonth", null as TimelineEvent["endMonth"]);
              } else {
                updateField("endMonth", null as TimelineEvent["endMonth"]);
              }
              if (errors.endMonth) {
                setErrors((current) => ({ ...current, endMonth: undefined }));
              }
            }}
            onBlur={(eventChange) =>
              handleNormalizeMonth("endMonth", eventChange.target.value)
            }
          />
        ))}
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
      {isSalaryEvent && (
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text fw={600}>{t("salaryStepsTitle")}</Text>
            <Button
              size="xs"
              variant="light"
              onClick={() =>
                setSalarySteps((current) => [
                  ...current,
                  {
                    id: nanoid(),
                    basis: selectedMember ? "age" : "month",
                    startMonth: formValues.startMonth,
                    startAgeYears: selectedMember ? 0 : undefined,
                    monthlyAmount: Math.max(formValues.monthlyAmount ?? 0, 0),
                  },
                ])
              }
              disabled={!formValues.enabled}
            >
              {t("salaryStepsAdd")}
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            {t("salaryStepsHint")}
          </Text>
          {salarySteps.length === 0 ? (
            <Text size="xs" c="dimmed">
              {t("salaryStepsEmpty")}
            </Text>
          ) : (
            <Stack gap="sm">
              {salarySteps.map((step) => {
                const disableAge = !selectedMember;
                return (
                  <Card key={step.id} withBorder radius="md" padding="sm">
                    <Stack gap="xs">
                      <Group justify="space-between" align="center">
                        <Text fw={500}>{t("salaryStepLabel")}</Text>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() =>
                            setSalarySteps((current) =>
                              current.filter((entry) => entry.id !== step.id)
                            )
                          }
                        >
                          {common("actionRemove")}
                        </Button>
                      </Group>
                      <DateOrAgeBasisPicker
                        value={disableAge ? "month" : step.basis}
                        onChange={(value) => {
                          setSalarySteps((current) =>
                            current.map((entry) =>
                              entry.id === step.id
                                ? {
                                    ...entry,
                                    basis: value,
                                    startMonth:
                                      value === "month"
                                        ? formValues.startMonth
                                        : undefined,
                                    startAgeYears:
                                      value === "age" ? entry.startAgeYears ?? 0 : undefined,
                                  }
                                : entry
                            )
                          );
                        }}
                        monthLabel={t("basisMonth")}
                        ageLabel={t("basisAge")}
                        disableAge={disableAge}
                      />
                      <Group grow>
                        {step.basis === "month" ? (
                          <TextInput
                            label={t("salaryStepStartMonth")}
                            placeholder={common("yearMonthPlaceholder")}
                            value={step.startMonth ?? ""}
                            error={salaryStepErrors[step.id]?.startMonth}
                            onChange={(eventChange) => {
                              const nextValue = eventChange.target.value;
                              setSalarySteps((current) =>
                                current.map((entry) =>
                                  entry.id === step.id
                                    ? { ...entry, startMonth: nextValue }
                                    : entry
                                )
                              );
                            }}
                          />
                        ) : (
                          <NumberInput
                            label={t("salaryStepStartAge")}
                            value={step.startAgeYears ?? ""}
                            min={0}
                            step={0.5}
                            decimalScale={2}
                            error={salaryStepErrors[step.id]?.startAgeYears}
                            onChange={(value) =>
                              setSalarySteps((current) =>
                                current.map((entry) =>
                                  entry.id === step.id
                                    ? {
                                        ...entry,
                                        startAgeYears:
                                          typeof value === "number" ? value : undefined,
                                      }
                                    : entry
                                )
                              )
                            }
                          />
                        )}
                        <NumberInput
                          label={t("salaryStepMonthlyAmount")}
                          value={step.monthlyAmount ?? 0}
                          min={0}
                          thousandSeparator=","
                          error={salaryStepErrors[step.id]?.monthlyAmount}
                          onChange={(value) =>
                            setSalarySteps((current) =>
                              current.map((entry) =>
                                entry.id === step.id
                                  ? {
                                      ...entry,
                                      monthlyAmount: Math.max(Number(value ?? 0), 0),
                                    }
                                  : entry
                              )
                            )
                          }
                        />
                      </Group>
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
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
