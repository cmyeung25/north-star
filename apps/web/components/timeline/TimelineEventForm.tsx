"use client";

import {
  Alert,
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
import { monthAtAge } from "../../src/domain/members/age";
import { buildDefinitionFromTimelineEvent } from "../../src/domain/events/utils";
import { compileEventToMonthlyCashflowSeries } from "../../src/domain/events/compiler";
import {
  buildSalaryScheduleEntries,
  normalizeSalarySteps,
} from "../../src/domain/events/salary";
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

  const isIncomeEvent = formValues
    ? getEventMeta(formValues.type).group === "income"
    : false;
  const isSalaryEvent = formValues?.type === "salary";
  const isSalarySubtype = (formValues?.incomeSubtype ?? "salary") === "salary";
  const hasActiveSalarySteps = Boolean(
    isSalaryEvent && isSalarySubtype && salarySteps.length > 0
  );
  const selectedMember = formValues
    ? members.find((member) => member.id === formValues.memberId)
    : undefined;

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

    const resolvedEndMonth =
      endConditionMode === "age"
        ? computedEndMonth
        : normalizedEndMonth?.ok
          ? normalizedEndMonth.month
          : null;

    if (hasActiveSalarySteps) {
      const nextStepErrors: Record<
        string,
        { startMonth?: string; startAgeYears?: string; monthlyAmount?: string }
      > = {};
      const normalizedBaseMonth = assumptions.baseMonth
        ? normalizeMonthStrict(assumptions.baseMonth)
        : null;
      const resolvedStepMonths: Array<{
        id: string;
        basis: SalaryStep["basis"];
        month: string;
      }> = [];
      const setStepError = (
        stepId: string,
        key: "startMonth" | "startAgeYears" | "monthlyAmount",
        message: string
      ) => {
        nextStepErrors[stepId] = {
          ...nextStepErrors[stepId],
          [key]: message,
        };
      };
      salarySteps.forEach((step) => {
        if (!step.monthlyAmount || step.monthlyAmount <= 0) {
          setStepError(step.id, "monthlyAmount", validation("amountRequired"));
        }
        if (step.basis === "month") {
          const normalized = normalizeMonthStrict(step.startMonth ?? "");
          if (!normalized.ok) {
            setStepError(step.id, "startMonth", validation("useYearMonth"));
          } else {
            resolvedStepMonths.push({
              id: step.id,
              basis: step.basis,
              month: normalized.month,
            });
          }
        } else {
          if (!selectedMember || selectedMember.kind !== "person") {
            setStepError(step.id, "startAgeYears", t("salaryStepsMissingPerson"));
          } else if (!normalizedBaseMonth?.ok) {
            setStepError(step.id, "startAgeYears", t("salaryStepMissingBaseMonth"));
          } else if (typeof step.startAgeYears !== "number" || step.startAgeYears < 0) {
            setStepError(step.id, "startAgeYears", t("salaryStepAgeRequired"));
          } else {
            const resolvedMonth = monthAtAge(
              selectedMember,
              step.startAgeYears,
              normalizedBaseMonth.month
            );
            if (!resolvedMonth) {
              setStepError(step.id, "startAgeYears", t("salaryStepMissingBirth"));
            } else {
              resolvedStepMonths.push({
                id: step.id,
                basis: step.basis,
                month: resolvedMonth,
              });
            }
          }
        }
      });

      resolvedStepMonths.forEach(({ id, basis, month }) => {
        if (month < normalizedStartMonth.month) {
          setStepError(
            id,
            basis === "month" ? "startMonth" : "startAgeYears",
            t("salaryStepBeforeStart")
          );
          return;
        }
        if (resolvedEndMonth && month > resolvedEndMonth) {
          setStepError(
            id,
            basis === "month" ? "startMonth" : "startAgeYears",
            t("salaryStepAfterEnd")
          );
        }
      });

      const monthToSteps = new Map<string, Array<{ id: string; basis: SalaryStep["basis"] }>>();
      resolvedStepMonths.forEach(({ id, basis, month }) => {
        const list = monthToSteps.get(month) ?? [];
        list.push({ id, basis });
        monthToSteps.set(month, list);
      });
      monthToSteps.forEach((entries) => {
        if (entries.length <= 1) {
          return;
        }
        entries.forEach(({ id, basis }) => {
          setStepError(
            id,
            basis === "month" ? "startMonth" : "startAgeYears",
            t("salaryStepDuplicateMonth")
          );
        });
      });

      if (Object.keys(nextStepErrors).length > 0) {
        setSalaryStepErrors(nextStepErrors);
        return;
      }
      setSalaryStepErrors({});
    }

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
    const normalizedSalarySteps = hasActiveSalarySteps
      ? normalizeSalarySteps(salarySteps)
      : salarySteps;
    if (hasActiveSalarySteps) {
      normalizedSchedule = buildSalaryScheduleEntries({
        baseMonth: assumptions.baseMonth ?? normalizedStartMonth.month,
        horizonMonths: assumptions.horizonMonths ?? 0,
        eventStartMonth: normalizedStartMonth.month,
        eventEndMonth: resolvedEndMonth ?? null,
        annualGrowthPct: normalizedEvent.annualGrowthPct ?? 0,
        member: selectedMember,
        steps: normalizedSalarySteps ?? [],
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
      ruleMode: hasActiveSalarySteps ? "schedule" : ruleMode,
      schedule: normalizedSchedule,
      salarySteps: salarySteps.length > 0 ? normalizedSalarySteps : undefined,
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
    if (!selectedMember || selectedMember.kind !== "person" || !formValues) {
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
    if (!formValues || !hasActiveSalarySteps) {
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
    hasActiveSalarySteps,
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
  const effectiveRuleMode = hasActiveSalarySteps ? "schedule" : ruleMode;
  const effectiveScheduleEntries =
    hasActiveSalarySteps
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
    !hasActiveSalarySteps;

  const showSalaryStepsDisabled =
    Boolean(isSalaryEvent && !isSalarySubtype && salarySteps.length > 0);

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
      {showSalaryStepsDisabled && (
        <Alert
          color="yellow"
          title={t("salaryStepsTitle")}
          variant="light"
        >
          <Stack gap="xs">
            <Text size="sm">{t("salaryStepsDisabled")}</Text>
            <Button
              size="xs"
              variant="default"
              onClick={() => {
                setSalarySteps([]);
                setSalaryStepErrors({});
              }}
            >
              {t("salaryStepsClear")}
            </Button>
          </Stack>
        </Alert>
      )}
      {isSalaryEvent && isSalarySubtype && (
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
                    basis: selectedMember?.kind === "person" ? "age" : "month",
                    startMonth: formValues.startMonth,
                    startAgeYears: selectedMember?.kind === "person" ? 0 : undefined,
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
          {(!selectedMember || selectedMember.kind !== "person") && (
            <Text size="xs" c="dimmed">
              {t("salaryStepsMissingPerson")}
            </Text>
          )}
          {salarySteps.length === 0 ? (
            <Text size="xs" c="dimmed">
              {t("salaryStepsEmpty")}
            </Text>
          ) : (
            <Stack gap="sm">
              {salarySteps.map((step) => {
                const disableAge = !selectedMember || selectedMember.kind !== "person";
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
