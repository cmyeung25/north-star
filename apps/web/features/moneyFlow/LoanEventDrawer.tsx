"use client";

import {
  Button,
  Divider,
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import MonthField from "../../components/MonthField";
import type { LoanEvent } from "../../src/domain/scenarioV2/events";
import { isValidMonthKey } from "../../src/utils/monthKey";
import { computeMonthlyPayment } from "../../src/domain/positions/calculations";

export type LoanEventDraft = {
  id?: string;
  label: string;
  loanKind: LoanEvent["loanKind"];
  startMonth: string;
  principal: string;
  annualInterestRatePct: string;
  termYears: string;
  monthlyPayment: string;
  paymentMethod: "amortization" | "manual";
  paymentIsEstimated: boolean;
  purchasePrice: string;
  downPaymentMode: "percent" | "amount";
  downPaymentPercent: string;
  downPaymentAmount: string;
  liabilityId: string;
  memberId: string;
};

type LoanEventDrawerProps = {
  opened: boolean;
  mode: "create" | "edit";
  baseCurrency: string;
  event: LoanEvent | null;
  onClose: () => void;
  onSave: (draft: LoanEventDraft) => void;
};

const buildDraft = (event: LoanEvent | null): LoanEventDraft => {
  if (!event) {
    return {
      id: undefined,
      label: "",
      loanKind: "personal",
      startMonth: "",
      principal: "",
      annualInterestRatePct: "",
      termYears: "",
      monthlyPayment: "",
      paymentMethod: "amortization",
      paymentIsEstimated: false,
      purchasePrice: "",
      downPaymentMode: "percent",
      downPaymentPercent: "",
      downPaymentAmount: "",
      liabilityId: `liability_loan_${nanoid(8)}`,
      memberId: "",
    };
  }

  return {
    id: event.id,
    label: event.label ?? "",
    loanKind: event.loanKind,
    startMonth: event.startMonth ?? "",
    principal: Number.isFinite(event.principal) ? String(event.principal) : "",
    annualInterestRatePct: Number.isFinite(event.annualInterestRatePct)
      ? String(event.annualInterestRatePct)
      : "",
    termYears: Number.isFinite(event.termYears) ? String(event.termYears) : "",
    monthlyPayment: Number.isFinite(event.monthlyPayment)
      ? String(event.monthlyPayment)
      : "",
    paymentMethod: event.paymentMethod ?? "amortization",
    paymentIsEstimated: event.paymentIsEstimated ?? false,
    purchasePrice: Number.isFinite(event.purchasePrice)
      ? String(event.purchasePrice)
      : "",
    downPaymentMode: event.downPaymentMode ?? "percent",
    downPaymentPercent: Number.isFinite(event.downPaymentPercent)
      ? String(event.downPaymentPercent)
      : "",
    downPaymentAmount: Number.isFinite(event.downPaymentAmount)
      ? String(event.downPaymentAmount)
      : "",
    liabilityId: event.liabilityId ?? `liability_loan_${nanoid(8)}`,
    memberId: event.memberId ?? "",
  };
};

export default function LoanEventDrawer({
  opened,
  mode,
  baseCurrency,
  event,
  onClose,
  onSave,
}: LoanEventDrawerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [draft, setDraft] = useState<LoanEventDraft>(() => buildDraft(event));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!opened) {
      return;
    }
    setDraft(buildDraft(event));
    setErrors({});
  }, [event, opened]);

  const purchasePrice = Number(draft.purchasePrice) || 0;
  const downPaymentPercent = Number(draft.downPaymentPercent) || 0;
  const downPaymentAmount = Number(draft.downPaymentAmount) || 0;
  const resolvedDownPayment =
    draft.downPaymentMode === "percent"
      ? (purchasePrice * downPaymentPercent) / 100
      : downPaymentAmount;
  const resolvedDownPaymentPercent =
    purchasePrice > 0 ? (resolvedDownPayment / purchasePrice) * 100 : 0;
  const principal = draft.loanKind === "car"
    ? Math.max(0, purchasePrice - resolvedDownPayment)
    : Number(draft.principal) || 0;
  const termMonths = Math.max(0, Math.round(Number(draft.termYears) * 12));
  const annualRateDecimal = Number(draft.annualInterestRatePct) / 100 || 0;
  const estimatedPayment = computeMonthlyPayment(
    principal,
    annualRateDecimal,
    termMonths
  );

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!isValidMonthKey(draft.startMonth)) {
      nextErrors.startMonth = t("ledgerEventStartRequired");
    }
    if (!draft.liabilityId) {
      nextErrors.liabilityId = t("ledgerEventAmountRequired");
    }

    if (draft.loanKind === "car") {
      if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
        nextErrors.purchasePrice = t("ledgerEventAmountRequired");
      }
    } else if (!Number.isFinite(principal) || principal <= 0) {
      nextErrors.principal = t("ledgerEventAmountRequired");
    }

    if (!Number.isFinite(annualRateDecimal) || annualRateDecimal < 0) {
      nextErrors.annualInterestRatePct = t("ledgerEventAmountRequired");
    }
    if (!Number.isFinite(termMonths) || termMonths <= 0) {
      nextErrors.termYears = t("ledgerEventAmountRequired");
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) {
      return;
    }
    const paymentValue = draft.monthlyPayment
      ? Number(draft.monthlyPayment)
      : estimatedPayment;
    onSave({
      ...draft,
      label: draft.label.trim(),
      principal: String(principal),
      downPaymentPercent:
        draft.downPaymentMode === "percent"
          ? draft.downPaymentPercent
          : String(resolvedDownPaymentPercent),
      downPaymentAmount:
        draft.downPaymentMode === "amount"
          ? draft.downPaymentAmount
          : String(resolvedDownPayment),
      monthlyPayment: Number.isFinite(paymentValue) ? String(paymentValue) : "",
      paymentIsEstimated: !draft.monthlyPayment,
    });
  };

  const loanKindOptions = useMemo(
    () => [
      { value: "car", label: t("loanKindCar") },
      { value: "personal", label: t("loanKindPersonal") },
      { value: "credit", label: t("loanKindCredit") },
      { value: "other", label: t("loanKindOther") },
    ],
    [t]
  );

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={
        mode === "edit"
          ? t("ledgerEventEditTitle")
          : t("ledgerEventCreateTitle")
      }
    >
      <Stack gap="md">
        <TextInput
          label={t("ledgerEventLabel")}
          value={draft.label}
          onChange={(eventValue) =>
            setDraft((current) => ({ ...current, label: eventValue.currentTarget.value }))
          }
        />
        <Select
          label={t("loanKindLabel")}
          data={loanKindOptions}
          value={draft.loanKind}
          onChange={(value) =>
            setDraft((current) => ({ ...current, loanKind: (value ?? "personal") as LoanEvent["loanKind"] }))
          }
        />
        <MonthField
          label={t("ledgerEventStartMonth")}
          value={draft.startMonth}
          error={errors.startMonth}
          onChange={(value) => setDraft((current) => ({ ...current, startMonth: value }))}
        />

        {draft.loanKind === "car" ? (
          <>
            <NumberInput
              label={t("liabilityFormPurchasePriceLabel")}
              value={draft.purchasePrice ? Number(draft.purchasePrice) : ""}
              error={errors.purchasePrice}
              min={0}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  purchasePrice: value === "" ? "" : String(value),
                }))
              }
            />
            <SegmentedControl
              data={[
                { value: "percent", label: "%" },
                { value: "amount", label: baseCurrency },
              ]}
              value={draft.downPaymentMode}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  downPaymentMode: value as "percent" | "amount",
                }))
              }
            />
            <Group grow>
              <NumberInput
                label={t("housingDownPaymentLabel")}
                value={
                  draft.downPaymentMode === "percent"
                    ? draft.downPaymentPercent
                      ? Number(draft.downPaymentPercent)
                      : ""
                    : draft.downPaymentAmount
                    ? Number(draft.downPaymentAmount)
                    : ""
                }
                min={0}
                onChange={(value) =>
                  setDraft((current) =>
                    current.downPaymentMode === "percent"
                      ? {
                          ...current,
                          downPaymentPercent: value === "" ? "" : String(value),
                        }
                      : {
                          ...current,
                          downPaymentAmount: value === "" ? "" : String(value),
                        }
                  )
                }
              />
              <NumberInput
                label={t("housingLoanAmountLabel")}
                value={Number.isFinite(principal) ? principal : 0}
                disabled
              />
            </Group>
          </>
        ) : (
          <NumberInput
            label={t("loanPrincipalLabel")}
            value={draft.principal ? Number(draft.principal) : ""}
            error={errors.principal}
            min={0}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                principal: value === "" ? "" : String(value),
              }))
            }
          />
        )}

        <Group grow>
          <NumberInput
            label={t("loanRateLabel")}
            value={draft.annualInterestRatePct ? Number(draft.annualInterestRatePct) : ""}
            error={errors.annualInterestRatePct}
            min={0}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                annualInterestRatePct: value === "" ? "" : String(value),
              }))
            }
          />
          <NumberInput
            label={t("loanTermLabel")}
            value={draft.termYears ? Number(draft.termYears) : ""}
            error={errors.termYears}
            min={0}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                termYears: value === "" ? "" : String(value),
              }))
            }
          />
        </Group>

        <Divider label={t("housingMonthlyPaymentLabel")} />
        <NumberInput
          label={t("housingMonthlyPaymentLabel")}
          value={draft.monthlyPayment ? Number(draft.monthlyPayment) : ""}
          min={0}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              monthlyPayment: value === "" ? "" : String(value),
            }))
          }
        />
        <Text size="sm" c="dimmed">
          {t("housingEstimatedPaymentLabel", { amount: estimatedPayment.toFixed(2) })}
        </Text>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            {common("actionCancel")}
          </Button>
          <Button onClick={handleSave}>
            {common("actionSave")}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
