"use client";

import {
  Button,
  Drawer,
  Group,
  NumberInput,
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

export type CashflowEventDraft = {
  id?: string;
  label: string;
  kind: CashflowEvent["kind"];
  cadence: CashflowEvent["cadence"];
  amount: string;
  startMonth: string;
  endMonth: string;
  occurrenceMonth: string;
  everyNMonths: string;
  memberId: string;
};

export type AdjustmentEventDraft = {
  id?: string;
  label: string;
  kind: AdjustmentEvent["kind"];
  amount: string;
  month: string;
  memberId: string;
};

export type ScenarioEventDraft =
  | ({ type: "cashflow" } & CashflowEventDraft)
  | ({ type: "adjustment" } & AdjustmentEventDraft);

type CashflowEventDrawerProps = {
  opened: boolean;
  mode: "create" | "edit";
  baseCurrency: string;
  members: ScenarioMember[];
  event: CashflowEvent | AdjustmentEvent | null;
  defaultKind?: CashflowEvent["kind"];
  onClose: () => void;
  onSave: (draft: ScenarioEventDraft) => void;
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
      startMonth: "",
      endMonth: "",
      occurrenceMonth: "",
      everyNMonths: "",
      memberId: "",
    };
  }

  return {
    id: event.id,
    label: event.label ?? "",
    kind: event.kind,
    cadence: event.cadence,
    amount: Number.isFinite(event.amount) ? String(event.amount) : "",
    startMonth: event.startMonth ?? "",
    endMonth: event.endMonth ?? "",
    occurrenceMonth: event.occurrenceMonth ?? "",
    everyNMonths: event.everyNMonths ? String(event.everyNMonths) : "",
    memberId: event.memberId ?? "",
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
    };
  }

  return {
    id: event.id,
    label: event.label ?? "",
    kind: event.kind,
    amount: Number.isFinite(event.amount) ? String(event.amount) : "",
    month: event.month ?? "",
    memberId: event.memberId ?? "",
  };
};

export default function CashflowEventDrawer({
  opened,
  mode,
  baseCurrency,
  members,
  event,
  defaultKind,
  onClose,
  onSave,
}: CashflowEventDrawerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [eventType, setEventType] = useState<"cashflow" | "adjustment">(
    event?.type === "adjustment" ? "adjustment" : "cashflow"
  );
  const [cashflowDraft, setCashflowDraft] = useState<CashflowEventDraft>(() =>
    buildCashflowDraft(event?.type === "cashflow" ? event : null, defaultKind)
  );
  const [adjustmentDraft, setAdjustmentDraft] = useState<AdjustmentEventDraft>(() =>
    buildAdjustmentDraft(event?.type === "adjustment" ? event : null)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setEventType(event?.type === "adjustment" ? "adjustment" : "cashflow");
    setCashflowDraft(
      buildCashflowDraft(event?.type === "cashflow" ? event : null, defaultKind)
    );
    setAdjustmentDraft(buildAdjustmentDraft(event?.type === "adjustment" ? event : null));
    setErrors({});
  }, [event, opened, defaultKind]);

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
              {t("ledgerEventMonthHint")}
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
