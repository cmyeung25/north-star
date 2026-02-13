"use client";
import React from "react";
import {
  Button,
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import MonthField from "../../components/MonthField";
import { compareMonthKey, isValidMonthKey } from "../../src/utils/monthKey";
import type { AdjustmentEvent, CashflowEvent } from "../../src/domain/scenarioV2/events";
import type { ScenarioMember } from "../../src/store/scenarioStore";
import { resolveYearlyStartMonthKey } from "../../src/features/moneyFlow/yearlyCadence";
import { addMonths } from "../../src/domain/members/age";
import { ageToMonth, formatFriendlyMonth, monthToAge } from "./ageMonth";
import {
  resolveCashflowAssumptionRate,
  resolveCashflowGrowthAssumption,
  type CashflowGrowthAssumptions,
} from "./growthMode";

export type CashflowEventDraft = {
  id?: string;
  label: string;
  kind: CashflowEvent["kind"];
  cadence: CashflowEvent["cadence"];
  amount: string;
  growthMode: NonNullable<CashflowEvent["growthMode"]>;
  customGrowthRatePct?: string;
  startMonth: string;
  endMonth: string;
  occurrenceMonth: string;
  everyNMonths: string;
  memberId: string;
  startTimingMode?: "month" | "age";
  endTimingMode?: "month" | "age";
  startAgeYears?: number;
  startAgeMonths?: number;
  endAgeYears?: number;
  endAgeMonths?: number;
  tags?: string[];
  growthSource?: CashflowEvent["growthSource"];
};

export type AdjustmentEventDraft = {
  id?: string;
  label: string;
  kind: AdjustmentEvent["kind"];
  amount: string;
  month: string;
  memberId: string;
  tags?: string[];
};

export type ScenarioEventDraft =
  | ({ type: "cashflow" } & CashflowEventDraft)
  | ({ type: "adjustment" } & AdjustmentEventDraft);

type CashflowEventDrawerProps = {
  opened: boolean;
  mode: "create" | "edit";
  baseCurrency: string;
  scenarioStartMonth?: string | null;
  incomeGrowthPct?: number | null;
  inflationPct?: number | null;
  rentGrowthPct?: number | null;
  members: ScenarioMember[];
  scenarioHorizonMonths?: number | null;
  event: CashflowEvent | AdjustmentEvent | null;
  defaultKind?: CashflowEvent["kind"];
  initialCashflowDraft?: Partial<CashflowEventDraft>;
  initialAdjustmentDraft?: Partial<AdjustmentEventDraft>;
  onClose: () => void;
  onSave: (draft: ScenarioEventDraft) => void;
};

const applyDraftOverrides = <T,>(draft: T, overrides?: Partial<T>): T => {
  if (!overrides) {
    return draft;
  }
  const definedEntries = Object.entries(overrides).filter(([, value]) => value !== undefined);
  return {
    ...draft,
    ...Object.fromEntries(definedEntries),
  };
};

const buildCashflowDraft = (
  event: CashflowEvent | null,
  defaultKind: CashflowEvent["kind"] = "income"
): CashflowEventDraft => {
  if (!event) {
    return {
      id: undefined,
      label: "",
      kind: defaultKind,
      cadence: "monthly",
      amount: "",
      growthMode: defaultKind === "income" ? "assumption" : "none",
      customGrowthRatePct: "",
      startMonth: "",
      endMonth: "",
      occurrenceMonth: "",
      everyNMonths: "",
      memberId: "",
      startTimingMode: "month",
      endTimingMode: "month",
      tags: undefined,
      growthSource: undefined,
    };
  }

  return {
    id: event.id,
    label: event.label ?? "",
    kind: event.kind,
    cadence: event.cadence,
    amount: Number.isFinite(event.amount) ? String(event.amount) : "",
    growthMode: event.growthMode ?? "none",
    customGrowthRatePct:
      typeof event.customGrowthRatePct === "number"
        ? String(event.customGrowthRatePct)
        : "",
    startMonth: event.startMonth ?? "",
    endMonth: event.endMonth ?? "",
    occurrenceMonth: event.occurrenceMonth ?? "",
    everyNMonths: event.everyNMonths ? String(event.everyNMonths) : "",
    memberId: event.memberId ?? "",
    startTimingMode: "month",
    endTimingMode: "month",
    tags: event.tags ? [...event.tags] : undefined,
    growthSource: event.growthSource,
  };
};

const buildAdjustmentDraft = (event: AdjustmentEvent | null): AdjustmentEventDraft => {
  if (!event) {
    return {
      id: undefined,
      label: "",
      kind: "cash",
      amount: "",
      month: "",
      memberId: "",
      tags: undefined,
    };
  }

  return {
    id: event.id,
    label: event.label ?? "",
    kind: event.kind,
    amount: Number.isFinite(event.amount) ? String(event.amount) : "",
    month: event.month ?? "",
    memberId: event.memberId ?? "",
    tags: event.tags ? [...event.tags] : undefined,
  };
};

export default function CashflowEventDrawer({
  opened,
  mode,
  baseCurrency,
  scenarioStartMonth,
  incomeGrowthPct,
  inflationPct,
  rentGrowthPct,
  members,
  scenarioHorizonMonths,
  event,
  defaultKind,
  initialCashflowDraft,
  initialAdjustmentDraft,
  onClose,
  onSave,
}: CashflowEventDrawerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [eventType, setEventType] = useState<"cashflow" | "adjustment">(
    event?.type === "adjustment" ? "adjustment" : "cashflow"
  );
  const [cashflowDraft, setCashflowDraft] = useState<CashflowEventDraft>(() =>
    applyDraftOverrides(
      buildCashflowDraft(event?.type === "cashflow" ? event : null, defaultKind),
      initialCashflowDraft
    )
  );
  const [adjustmentDraft, setAdjustmentDraft] = useState<AdjustmentEventDraft>(() =>
    applyDraftOverrides(
      buildAdjustmentDraft(event?.type === "adjustment" ? event : null),
      initialAdjustmentDraft
    )
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const growthAssumptions = useMemo<CashflowGrowthAssumptions>(
    () => ({
      salaryGrowthRate: incomeGrowthPct,
      inflationRate: inflationPct,
      rentAnnualGrowthPct: rentGrowthPct,
    }),
    [incomeGrowthPct, inflationPct, rentGrowthPct]
  );

  const growthAssumptionKey = useMemo(
    () => resolveCashflowGrowthAssumption(cashflowDraft),
    [cashflowDraft]
  );
  const assumptionRate = useMemo(
    () => resolveCashflowAssumptionRate(cashflowDraft, growthAssumptions),
    [cashflowDraft, growthAssumptions]
  );
  const formattedAssumptionPct = useMemo(() => {
    if (!Number.isFinite(assumptionRate ?? NaN)) {
      return null;
    }
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
      assumptionRate ?? 0
    );
  }, [assumptionRate]);
  const isAssumptionUnavailable =
    growthAssumptionKey === "rentAnnualGrowthPct" && !Number.isFinite(assumptionRate ?? NaN);

  useEffect(() => {
    setEventType(event?.type === "adjustment" ? "adjustment" : "cashflow");
    setCashflowDraft(
      applyDraftOverrides(
        buildCashflowDraft(event?.type === "cashflow" ? event : null, defaultKind),
        event?.type ? undefined : initialCashflowDraft
      )
    );
    setAdjustmentDraft(
      applyDraftOverrides(
        buildAdjustmentDraft(event?.type === "adjustment" ? event : null),
        event?.type ? undefined : initialAdjustmentDraft
      )
    );
    setErrors({});
  }, [event, initialAdjustmentDraft, initialCashflowDraft, opened, defaultKind]);

  const memberOptions = useMemo(
    () => [
      { value: "", label: t("ledgerEventMemberHousehold") },
      ...members.map((member) => ({ value: member.id, label: member.name })),
    ],
    [members, t]
  );

  const cadenceOptions = useMemo(
    () => [
      { value: "monthly", label: t("ledgerEventCadenceMonthly") },
      { value: "quarterly", label: t("ledgerEventCadenceQuarterly") },
      { value: "yearly", label: t("ledgerEventCadenceYearly") },
      { value: "everyNMonths", label: t("ledgerEventCadenceEveryN") },
      { value: "oneOff", label: t("ledgerEventCadenceOneOff") },
    ],
    [t]
  );

  const yearlyMonthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = String(index + 1);
        return { value: month, label: month };
      }),
    []
  );

  const growthModeOptions = useMemo(
    () => [
      {
        value: "assumption",
        label:
          formattedAssumptionPct === null
            ? t("ledgerEventGrowthModeAssumptionUnset")
            : t("ledgerEventGrowthModeAssumption", {
                pct: formattedAssumptionPct,
              }),
        disabled: isAssumptionUnavailable,
      },
      { value: "custom", label: t("ledgerEventGrowthModeCustom") },
      { value: "none", label: t("ledgerEventGrowthModeNone") },
    ],
    [formattedAssumptionPct, isAssumptionUnavailable, t]
  );

  const yearlyMonthValue = useMemo(() => {
    if (!isValidMonthKey(cashflowDraft.startMonth)) {
      return "";
    }
    const [, month] = cashflowDraft.startMonth.split("-");
    return String(Number(month));
  }, [cashflowDraft.startMonth]);

  const canUseDOM = typeof document !== "undefined";
  const selectedMember = useMemo(
    () => members.find((member) => member.id === cashflowDraft.memberId),
    [cashflowDraft.memberId, members]
  );
  const canUseAgeMode = Boolean(selectedMember?.birthMonth);
  const scenarioEndMonth = useMemo(() => {
    if (!scenarioStartMonth || !scenarioHorizonMonths || scenarioHorizonMonths <= 0) {
      return null;
    }
    return addMonths(scenarioStartMonth, scenarioHorizonMonths - 1);
  }, [scenarioHorizonMonths, scenarioStartMonth]);

  useEffect(() => {
    if (!selectedMember?.birthMonth) {
      setCashflowDraft((current) => {
        if (current.startTimingMode !== "age" && current.endTimingMode !== "age") {
          return current;
        }
        return {
          ...current,
          startTimingMode: "month",
          endTimingMode: "month",
        };
      });
      return;
    }

    setCashflowDraft((current) => {
      const startAge = monthToAge(selectedMember.birthMonth, current.startMonth);
      const endAge = monthToAge(selectedMember.birthMonth, current.endMonth);
      return {
        ...current,
        startAgeYears: startAge?.years ?? current.startAgeYears ?? 0,
        startAgeMonths: startAge?.months ?? current.startAgeMonths ?? 0,
        endAgeYears: endAge?.years ?? current.endAgeYears,
        endAgeMonths: endAge?.months ?? current.endAgeMonths,
      };
    });
  }, [selectedMember?.birthMonth]);

  const resolvedStartMonth =
    cashflowDraft.startTimingMode === "age"
      ? ageToMonth(
          selectedMember?.birthMonth,
          cashflowDraft.startAgeYears,
          cashflowDraft.startAgeMonths
        ) ?? ""
      : cashflowDraft.startMonth;
  const resolvedEndMonth =
    cashflowDraft.endTimingMode === "age"
      ? ageToMonth(selectedMember?.birthMonth, cashflowDraft.endAgeYears, cashflowDraft.endAgeMonths)
      : cashflowDraft.endMonth || null;

  const timelineWarning = useMemo(() => {
    if (!resolvedStartMonth) {
      return null;
    }
    if (scenarioStartMonth && compareMonthKey(resolvedStartMonth, scenarioStartMonth) < 0) {
      return t("ledgerEventMonthBeforeScenarioWarning");
    }
    if (scenarioEndMonth && compareMonthKey(resolvedStartMonth, scenarioEndMonth) > 0) {
      return t("ledgerEventMonthBeyondHorizonWarning");
    }
    if (resolvedEndMonth && scenarioEndMonth && compareMonthKey(resolvedEndMonth, scenarioEndMonth) > 0) {
      return t("ledgerEventMonthBeyondHorizonWarning");
    }
    return null;
  }, [resolvedEndMonth, resolvedStartMonth, scenarioEndMonth, scenarioStartMonth, t]);

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (eventType === "adjustment") {
      const amountValue = Number(adjustmentDraft.amount);
      if (!Number.isFinite(amountValue) || amountValue === 0) {
        nextErrors.amount = t("ledgerEventAmountRequired");
      }
      if (!isValidMonthKey(adjustmentDraft.month)) {
        nextErrors.month = t("ledgerEventOccurrenceRequired");
      }
      setErrors(nextErrors);
      return Object.keys(nextErrors).length === 0;
    }

    const amountValue = Number(cashflowDraft.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      nextErrors.amount = t("ledgerEventAmountRequired");
    }

    if (cashflowDraft.cadence === "oneOff") {
      if (!isValidMonthKey(cashflowDraft.occurrenceMonth)) {
        nextErrors.occurrenceMonth = t("ledgerEventOccurrenceRequired");
      }
    } else {
      if (!isValidMonthKey(cashflowDraft.startMonth)) {
        if (!isValidMonthKey(resolvedStartMonth)) {
          nextErrors.startMonth = t("ledgerEventStartRequired");
        }
      } else if (!isValidMonthKey(resolvedStartMonth)) {
        nextErrors.startMonth = t("ledgerEventStartRequired");
      }
      if (resolvedEndMonth) {
        if (!isValidMonthKey(resolvedEndMonth)) {
          nextErrors.endMonth = t("ledgerEventEndInvalid");
        } else if (
          isValidMonthKey(resolvedStartMonth) &&
          compareMonthKey(resolvedStartMonth, resolvedEndMonth) > 0
        ) {
          nextErrors.endMonth = t("ledgerEventEndInvalid");
        }
      }
    }

    if (cashflowDraft.cadence === "everyNMonths") {
      const everyNValue = Number(cashflowDraft.everyNMonths);
      if (!Number.isFinite(everyNValue) || everyNValue < 1) {
        nextErrors.everyNMonths = t("ledgerEventEveryNRequired");
      }
    }

    if (cashflowDraft.cadence !== "oneOff" && cashflowDraft.growthMode === "custom") {
      const customGrowthValue = Number(cashflowDraft.customGrowthRatePct ?? "");
      if (!Number.isFinite(customGrowthValue) || customGrowthValue < 0) {
        nextErrors.customGrowthRatePct = t("ledgerEventGrowthCustomInvalid");
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }
    if (eventType === "adjustment") {
      onSave({
        type: "adjustment",
        ...adjustmentDraft,
      });
      return;
    }
    onSave({
      type: "cashflow",
      ...cashflowDraft,
      startMonth: resolvedStartMonth,
      endMonth: resolvedEndMonth ?? "",
    });
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      withinPortal={canUseDOM}
      title={
        mode === "edit" ? t("ledgerEventEditTitle") : t("ledgerEventCreateTitle")
      }
    >
      <Stack gap="sm">
        {eventType === "cashflow" ? (
          <>
            <TextInput
              label={t("ledgerEventLabel")}
              placeholder={t("ledgerEventLabelPlaceholder")}
              value={cashflowDraft.label}
              onChange={(eventValue) =>
                setCashflowDraft((current) => ({
                  ...current,
                  label: eventValue.currentTarget.value,
                }))
              }
            />
            <Select
              label={t("ledgerEventKind")}
              data={[
                { value: "income", label: t("ledgerEventKindIncome") },
                { value: "expense", label: t("ledgerEventKindExpense") },
              ]}
              value={cashflowDraft.kind}
              onChange={(value) =>
                setCashflowDraft((current) => ({
                  ...current,
                  kind: (value ?? "income") as CashflowEvent["kind"],
                  growthMode: current.cadence === "oneOff" ? "none" : current.growthMode,
                }))
              }
            />
            <Select
              label={t("ledgerEventCadence")}
              data={cadenceOptions}
              value={cashflowDraft.cadence}
              onChange={(value) =>
                setCashflowDraft((current) => ({
                  ...current,
                  cadence: (value ?? "monthly") as CashflowEvent["cadence"],
                  growthMode:
                    value === "oneOff" ? "none" : current.growthMode,
                }))
              }
            />
            {cashflowDraft.cadence === "everyNMonths" && (
              <NumberInput
                label={t("ledgerEventEveryNLabel")}
                value={cashflowDraft.everyNMonths}
                onChange={(value) =>
                  setCashflowDraft((current) => ({
                    ...current,
                    everyNMonths:
                      value === "" || value === undefined ? "" : String(value),
                  }))
                }
                error={errors.everyNMonths}
                min={1}
              />
            )}
            <NumberInput
              label={t("ledgerEventAmount", { currency: baseCurrency })}
              value={cashflowDraft.amount}
              onChange={(value) =>
                setCashflowDraft((current) => ({
                  ...current,
                  amount: value === "" || value === undefined ? "" : String(value),
                }))
              }
              error={errors.amount}
              min={0}
              allowNegative={false}
            />
            <Select
              label={t("ledgerEventMember")}
              data={memberOptions}
              value={cashflowDraft.memberId}
              onChange={(value) =>
                setCashflowDraft((current) => ({
                  ...current,
                  memberId: value ?? "",
                }))
              }
            />
            {cashflowDraft.cadence !== "oneOff" && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  {t("ledgerEventGrowthModeTitle")}
                </Text>
                <SegmentedControl
                  data={growthModeOptions}
                  value={cashflowDraft.growthMode}
                  onChange={(value) =>
                    setCashflowDraft((current) => {
                      const nextMode =
                        (value ?? "none") as NonNullable<CashflowEvent["growthMode"]>;
                      return {
                        ...current,
                        growthMode:
                          nextMode === "assumption" && isAssumptionUnavailable
                            ? "none"
                            : nextMode,
                      };
                    })
                  }
                />
                {isAssumptionUnavailable && (
                  <Text size="xs" c="dimmed">
                    {t("ledgerEventGrowthModeAssumptionUnavailableHint")}
                  </Text>
                )}
                {cashflowDraft.growthMode === "custom" && (
                  <NumberInput
                    label={t("ledgerEventGrowthCustomLabel")}
                    value={cashflowDraft.customGrowthRatePct ?? ""}
                    onChange={(value) =>
                      setCashflowDraft((current) => ({
                        ...current,
                        customGrowthRatePct:
                          value === "" || value === undefined ? "" : String(value),
                      }))
                    }
                    error={errors.customGrowthRatePct}
                    min={0}
                    step={0.1}
                    decimalScale={2}
                  />
                )}
                {cashflowDraft.growthMode === "assumption" && (
                  <Text size="xs" c="dimmed">
                    {t("ledgerEventIncomeGrowthHint")}
                  </Text>
                )}
              </Stack>
            )}

            {cashflowDraft.cadence === "oneOff" ? (
              <MonthField
                label={t("ledgerEventOccurrenceMonth")}
                value={cashflowDraft.occurrenceMonth}
                onChange={(value) =>
                  setCashflowDraft((current) => ({
                    ...current,
                    occurrenceMonth: value,
                  }))
                }
                error={errors.occurrenceMonth}
              />
            ) : (
              <>
                {cashflowDraft.cadence === "yearly" ? (
                  <Select
                    label={t("ledgerEventYearlyMonth")}
                    data={yearlyMonthOptions}
                    value={yearlyMonthValue}
                    onChange={(value) =>
                      setCashflowDraft((current) => ({
                        ...current,
                        startMonth: resolveYearlyStartMonthKey(
                          value,
                          scenarioStartMonth ?? null
                        ),
                      }))
                    }
                    error={errors.startMonth}
                  />
                ) : (
                  <Stack gap={4}>
                    <Group justify="space-between" align="flex-end">
                      <Text size="sm" fw={500}>
                        {t("ledgerEventStartMonth")}
                      </Text>
                      <SegmentedControl
                        data={[
                          { value: "month", label: t("ledgerEventTimingModeMonth") },
                          {
                            value: "age",
                            label: t("ledgerEventTimingModeAge"),
                            disabled: !canUseAgeMode,
                          },
                        ]}
                        value={cashflowDraft.startTimingMode ?? "month"}
                        onChange={(value) =>
                          setCashflowDraft((current) => ({
                            ...current,
                            startTimingMode: value as "month" | "age",
                          }))
                        }
                      />
                    </Group>
                    {(cashflowDraft.startTimingMode ?? "month") === "month" ? (
                      <MonthField
                        value={cashflowDraft.startMonth}
                        onChange={(value) =>
                          setCashflowDraft((current) => ({
                            ...current,
                            startMonth: value,
                          }))
                        }
                        error={errors.startMonth}
                      />
                    ) : (
                      <Group grow align="end">
                        <NumberInput
                          label={t("ledgerEventAgeYears")}
                          value={cashflowDraft.startAgeYears ?? 0}
                          min={0}
                          step={1}
                          decimalScale={0}
                          onChange={(value) =>
                            setCashflowDraft((current) => ({
                              ...current,
                              startAgeYears: Number(value) || 0,
                            }))
                          }
                        />
                        <NumberInput
                          label={t("ledgerEventAgeMonths")}
                          value={cashflowDraft.startAgeMonths ?? 0}
                          min={0}
                          max={11}
                          step={1}
                          decimalScale={0}
                          onChange={(value) =>
                            setCashflowDraft((current) => ({
                              ...current,
                              startAgeMonths: Math.max(0, Math.min(11, Number(value) || 0)),
                            }))
                          }
                          error={errors.startMonth}
                        />
                      </Group>
                    )}
                    {!canUseAgeMode && (
                      <Text size="xs" c="dimmed">
                        {t("ledgerEventAgeModeDisabledHint")}
                      </Text>
                    )}
                    {resolvedStartMonth && (cashflowDraft.startTimingMode ?? "month") === "age" && (
                      <Text size="xs" c="dimmed">
                        {t("ledgerEventAgePreview", {
                          month: formatFriendlyMonth(resolvedStartMonth),
                          monthKey: resolvedStartMonth,
                          member: selectedMember?.name ?? "",
                        })}
                      </Text>
                    )}
                  </Stack>
                )}
                <Stack gap={4}>
                  <Group justify="space-between" align="flex-end">
                    <Text size="sm" fw={500}>
                      {t("ledgerEventEndMonth")}
                    </Text>
                    <SegmentedControl
                      data={[
                        { value: "month", label: t("ledgerEventTimingModeMonth") },
                        {
                          value: "age",
                          label: t("ledgerEventTimingModeAge"),
                          disabled: !canUseAgeMode,
                        },
                      ]}
                      value={cashflowDraft.endTimingMode ?? "month"}
                      onChange={(value) =>
                        setCashflowDraft((current) => ({
                          ...current,
                          endTimingMode: value as "month" | "age",
                        }))
                      }
                    />
                  </Group>
                  {(cashflowDraft.endTimingMode ?? "month") === "month" ? (
                    <MonthField
                      value={cashflowDraft.endMonth}
                      onChange={(value) =>
                        setCashflowDraft((current) => ({
                          ...current,
                          endMonth: value,
                        }))
                      }
                      error={errors.endMonth}
                    />
                  ) : (
                    <Group grow align="end">
                      <NumberInput
                        label={t("ledgerEventAgeYears")}
                        value={cashflowDraft.endAgeYears ?? ""}
                        min={0}
                        step={1}
                        decimalScale={0}
                        onChange={(value) =>
                          setCashflowDraft((current) => ({
                            ...current,
                            endAgeYears:
                              value === "" || value === undefined ? undefined : Number(value),
                          }))
                        }
                      />
                      <NumberInput
                        label={t("ledgerEventAgeMonths")}
                        value={cashflowDraft.endAgeMonths ?? ""}
                        min={0}
                        max={11}
                        step={1}
                        decimalScale={0}
                        onChange={(value) =>
                          setCashflowDraft((current) => ({
                            ...current,
                            endAgeMonths:
                              value === "" || value === undefined
                                ? undefined
                                : Math.max(0, Math.min(11, Number(value))),
                          }))
                        }
                        error={errors.endMonth}
                      />
                    </Group>
                  )}
                  {resolvedEndMonth && (cashflowDraft.endTimingMode ?? "month") === "age" && (
                    <Text size="xs" c="dimmed">
                      {t("ledgerEventAgePreview", {
                        month: formatFriendlyMonth(resolvedEndMonth),
                        monthKey: resolvedEndMonth,
                        member: selectedMember?.name ?? "",
                      })}
                    </Text>
                  )}
                </Stack>
              </>
            )}

            <Text size="xs" c="dimmed">
              {cashflowDraft.cadence === "yearly"
                ? t("ledgerEventMonthHintYearly")
                : t("ledgerEventMonthHint")}
            </Text>
            {timelineWarning && (
              <Text size="xs" c="yellow.8">
                {timelineWarning}
              </Text>
            )}
          </>
        ) : (
          <>
            <TextInput
              label={t("ledgerEventLabel")}
              placeholder={t("ledgerEventLabelPlaceholder")}
              value={adjustmentDraft.label}
              onChange={(eventValue) =>
                setAdjustmentDraft((current) => ({
                  ...current,
                  label: eventValue.currentTarget.value,
                }))
              }
            />
            <Select
              label={t("ledgerEventAdjustmentKind")}
              data={[
                { value: "cash", label: t("ledgerEventAdjustmentCash") },
                { value: "asset", label: t("ledgerEventAdjustmentAsset") },
                { value: "liability", label: t("ledgerEventAdjustmentLiability") },
              ]}
              value={adjustmentDraft.kind}
              onChange={(value) =>
                setAdjustmentDraft((current) => ({
                  ...current,
                  kind: (value ?? "cash") as AdjustmentEvent["kind"],
                }))
              }
            />
            <NumberInput
              label={t("ledgerEventAmount", { currency: baseCurrency })}
              value={adjustmentDraft.amount}
              onChange={(value) =>
                setAdjustmentDraft((current) => ({
                  ...current,
                  amount: value === "" || value === undefined ? "" : String(value),
                }))
              }
              error={errors.amount}
              allowNegative
            />
            <Select
              label={t("ledgerEventMember")}
              data={memberOptions}
              value={adjustmentDraft.memberId}
              onChange={(value) =>
                setAdjustmentDraft((current) => ({
                  ...current,
                  memberId: value ?? "",
                }))
              }
            />
            <MonthField
              label={t("ledgerEventOccurrenceMonth")}
              value={adjustmentDraft.month}
              onChange={(value) =>
                setAdjustmentDraft((current) => ({ ...current, month: value }))
              }
              error={errors.month}
            />
            <Text size="xs" c="dimmed">
              {t("ledgerEventAdjustmentHint")}
            </Text>
          </>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            {common("actionCancel")}
          </Button>
          <Button onClick={handleSave}>{common("actionSave")}</Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
