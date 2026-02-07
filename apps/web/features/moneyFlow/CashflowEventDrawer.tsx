"use client";

import React from "react";
import {
  Button,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
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

export type CashflowEventDraft = {
  id?: string;
  label: string;
  kind: CashflowEvent["kind"];
  cadence: CashflowEvent["cadence"];
  amount: string;
  growthMode: NonNullable<CashflowEvent["growthMode"]>;
  startMonth: string;
  endMonth: string;
  occurrenceMonth: string;
  everyNMonths: string;
  memberId: string;
  tags?: string[];
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
  members: ScenarioMember[];
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
      startMonth: "",
      endMonth: "",
      occurrenceMonth: "",
      everyNMonths: "",
      memberId: "",
      tags: undefined,
    };
  }

  return {
    id: event.id,
    label: event.label ?? "",
    kind: event.kind,
    cadence: event.cadence,
    amount: Number.isFinite(event.amount) ? String(event.amount) : "",
    growthMode: event.kind === "income" ? event.growthMode ?? "none" : "none",
    startMonth: event.startMonth ?? "",
    endMonth: event.endMonth ?? "",
    occurrenceMonth: event.occurrenceMonth ?? "",
    everyNMonths: event.everyNMonths ? String(event.everyNMonths) : "",
    memberId: event.memberId ?? "",
    tags: event.tags ? [...event.tags] : undefined,
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
  members,
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

  const formattedIncomeGrowthPct = useMemo(() => {
    if (!Number.isFinite(incomeGrowthPct ?? NaN)) {
      return "0";
    }
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
      incomeGrowthPct ?? 0
    );
  }, [incomeGrowthPct]);

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

  const yearlyMonthValue = useMemo(() => {
    if (!isValidMonthKey(cashflowDraft.startMonth)) {
      return "";
    }
    const [, month] = cashflowDraft.startMonth.split("-");
    return String(Number(month));
  }, [cashflowDraft.startMonth]);

  const canUseDOM = typeof document !== "undefined";

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
        nextErrors.startMonth = t("ledgerEventStartRequired");
      }
      if (cashflowDraft.endMonth) {
        if (!isValidMonthKey(cashflowDraft.endMonth)) {
          nextErrors.endMonth = t("ledgerEventEndInvalid");
        } else if (
          isValidMonthKey(cashflowDraft.startMonth) &&
          compareMonthKey(cashflowDraft.startMonth, cashflowDraft.endMonth) > 0
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
                  growthMode:
                    (value ?? "income") === "income"
                      ? current.growthMode === "none"
                        ? "assumption"
                        : current.growthMode
                      : "none",
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
            {cashflowDraft.kind === "income" && (
              <Stack gap={4}>
                <Switch
                  label={t("ledgerEventIncomeGrowthLabel", {
                    pct: formattedIncomeGrowthPct,
                  })}
                  checked={cashflowDraft.growthMode === "assumption"}
                  disabled={cashflowDraft.cadence === "oneOff"}
                  onChange={(eventValue: any) => {
                    const checked =
                      typeof eventValue === "boolean"
                        ? eventValue
                        : !!(eventValue && eventValue.currentTarget && eventValue.currentTarget.checked);
                    setCashflowDraft((current) => ({
                      ...current,
                      growthMode: checked ? "assumption" : "none",
                    }));
                  }}
                />
                <Text size="xs" c="dimmed">
                  {t("ledgerEventIncomeGrowthHint")}
                </Text>
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
                  <MonthField
                    label={t("ledgerEventStartMonth")}
                    value={cashflowDraft.startMonth}
                    onChange={(value) =>
                      setCashflowDraft((current) => ({
                        ...current,
                        startMonth: value,
                      }))
                    }
                    error={errors.startMonth}
                  />
                )}
                <MonthField
                  label={t("ledgerEventEndMonth")}
                  value={cashflowDraft.endMonth}
                  onChange={(value) =>
                    setCashflowDraft((current) => ({
                      ...current,
                      endMonth: value,
                    }))
                  }
                  error={errors.endMonth}
                />
              </>
            )}

            <Text size="xs" c="dimmed">
              {cashflowDraft.cadence === "yearly"
                ? t("ledgerEventMonthHintYearly")
                : t("ledgerEventMonthHint")}
            </Text>
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
