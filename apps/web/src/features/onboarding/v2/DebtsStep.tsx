"use client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useMemo } from "react";
import MonthField from "../../../../components/MonthField";
import type {
  OnboardingV2DraftDebt,
  OnboardingV2DraftDebtType,
} from "../../../domain/onboarding/v2/draftTypes";
import { monthsBetween } from "../../../domain/members/age";
import { calcAmortizedPaymentMonthly } from "../../../domain/positions/calculations";
import { isValidMonthKey } from "../../../utils/monthKey";

export type DebtsErrors = {
  debts: Record<
    string,
    Partial<{
      label: string;
      principalOutstanding: string;
      interestRatePct: string;
      termYears: string;
      maturityMonth: string;
      startMonth: string;
      monthlyPayment: string;
      purchasePrice: string;
      downPaymentPercent: string;
      downPaymentAmount: string;
    }>
  >;
};

type DebtsStepProps = {
  debts: OnboardingV2DraftDebt[];
  baseMonth: string;
  errors: DebtsErrors;
  onChange: (next: OnboardingV2DraftDebt[]) => void;
  t: (key: string, values?: Record<string, number>) => string;
};

const toNumber = (value: number | string) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const toOptionalNumber = (value: number | string) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const resolveTermMonths = (
  debt: OnboardingV2DraftDebt,
  fallbackMonth: string
) => {
  const startMonth = isValidMonthKey(debt.startMonth ?? "")
    ? debt.startMonth ?? fallbackMonth
    : fallbackMonth;
  const maturityMonth = isValidMonthKey(debt.maturityMonth ?? "")
    ? debt.maturityMonth ?? null
    : null;

  if (startMonth && maturityMonth) {
    return Math.max(1, monthsBetween(startMonth, maturityMonth) + 1);
  }

  if (debt.termYears !== null && debt.termYears !== undefined) {
    if (!Number.isFinite(debt.termYears) || debt.termYears <= 0) {
      return null;
    }
    return Math.max(1, Math.round(debt.termYears * 12));
  }

  return null;
};

const estimateMonthlyPayment = (
  debt: OnboardingV2DraftDebt,
  fallbackMonth: string
) => {
  const principal = toNumber(debt.principalOutstanding);
  if (principal <= 0) {
    return null;
  }
  if (
    debt.interestRatePct === null ||
    debt.interestRatePct === undefined ||
    !Number.isFinite(debt.interestRatePct) ||
    debt.interestRatePct < 0
  ) {
    return null;
  }
  const termMonths = resolveTermMonths(debt, fallbackMonth);
  if (!termMonths || termMonths <= 0) {
    return null;
  }
  return calcAmortizedPaymentMonthly(
    principal,
    debt.interestRatePct ?? 0,
    termMonths
  );
};

const computeCarLoanAmounts = (debt: OnboardingV2DraftDebt) => {
  const purchasePrice = toNumber(debt.purchasePrice ?? 0);
  const downPaymentPercent =
    debt.downPaymentMode === "amount"
      ? purchasePrice > 0
        ? (toNumber(debt.downPaymentAmount ?? 0) / purchasePrice) * 100
        : 0
      : toNumber(debt.downPaymentPercent ?? 0);
  const downPaymentAmount =
    debt.downPaymentMode === "amount"
      ? toNumber(debt.downPaymentAmount ?? 0)
      : (purchasePrice * downPaymentPercent) / 100;
  const loanAmount = Math.max(0, purchasePrice - downPaymentAmount);

  return {
    purchasePrice,
    downPaymentPercent,
    downPaymentAmount,
    loanAmount,
  };
};

const debtTypeOptions: { value: OnboardingV2DraftDebtType; labelKey: string }[] = [
  { value: "carLoan", labelKey: "debtsTypeCarLoan" },
  { value: "personalLoan", labelKey: "debtsTypePersonalLoan" },
  { value: "creditCard", labelKey: "debtsTypeCreditCard" },
  { value: "other", labelKey: "debtsTypeOther" },
];

export default function DebtsStep({
  debts,
  baseMonth,
  errors,
  onChange,
  t,
}: DebtsStepProps) {
  const options = useMemo(
    () =>
      debtTypeOptions.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t]
  );

  const updateDebt = (
    id: string,
    patch: Partial<OnboardingV2DraftDebt>,
    options?: { recalcPrincipal?: boolean; paymentSource?: "manual" | "reset" }
  ) => {
    onChange(
      debts.map((debt) => {
        if (debt.id !== id) {
          return debt;
        }
        let next: OnboardingV2DraftDebt = { ...debt, ...patch };

        if (options?.recalcPrincipal && next.type === "carLoan") {
          const amounts = computeCarLoanAmounts(next);
          next = {
            ...next,
            downPaymentPercent: amounts.downPaymentPercent,
            downPaymentAmount: amounts.downPaymentAmount,
            principalOutstanding: amounts.loanAmount,
          };
        }

        if (options?.paymentSource === "manual") {
          next = { ...next, monthlyPaymentSource: "manual" };
        }
        if (options?.paymentSource === "reset") {
          next = { ...next, monthlyPaymentSource: undefined };
        }

        const estimatedPayment = estimateMonthlyPayment(next, baseMonth);
        if (
          next.monthlyPaymentSource !== "manual" &&
          estimatedPayment !== null &&
          (next.monthlyPayment === null ||
            next.monthlyPayment === undefined ||
            next.monthlyPaymentSource === "estimated")
        ) {
          next = {
            ...next,
            monthlyPayment: Math.round(estimatedPayment * 100) / 100,
            monthlyPaymentSource: "estimated",
          };
        }

        return next;
      })
    );
  };

  const addDebt = () => {
    onChange([
      ...debts,
      {
        id: nanoid(6),
        type: "personalLoan",
        label: "",
        principalOutstanding: 0,
        interestRatePct: null,
        termYears: null,
        maturityMonth: "",
        startMonth: baseMonth,
        monthlyPayment: null,
        monthlyPaymentSource: undefined,
        purchasePrice: 0,
        downPaymentMode: "percent",
        downPaymentPercent: 0,
        downPaymentAmount: 0,
      },
    ]);
  };

  const removeDebt = (id: string) => {
    onChange(debts.filter((debt) => debt.id !== id));
  };

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group align="center" justify="space-between">
            <Title order={4}>{t("debtsTitle")}</Title>
            <Badge variant="light">{t("debtsBadge")}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("debtsHint")}
          </Text>
          <Button onClick={addDebt} variant="default">
            {t("debtsAdd")}
          </Button>
        </Stack>
      </Card>

      {debts.length === 0 ? (
        <Card withBorder radius="md" padding="md">
          <Text size="sm" c="dimmed">
            {t("debtsEmpty")}
          </Text>
        </Card>
      ) : null}

      {debts.map((debt) => {
        const entryErrors = errors.debts[debt.id] ?? {};
        const estimatedPayment = estimateMonthlyPayment(debt, baseMonth);
        const paymentDiff =
          estimatedPayment && debt.monthlyPayment
            ? debt.monthlyPayment - estimatedPayment
            : null;
        const carLoanAmounts =
          debt.type === "carLoan" ? computeCarLoanAmounts(debt) : null;

        return (
          <Card key={debt.id} withBorder radius="md" padding="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Title order={5}>{t("debtsItemTitle")}</Title>
                <Button
                  variant="subtle"
                  color="red"
                  onClick={() => removeDebt(debt.id)}
                >
                  {t("debtsRemove")}
                </Button>
              </Group>

              <Group grow align="flex-start">
                <Select
                  label={t("debtsTypeLabel")}
                  data={options}
                  value={debt.type}
                  onChange={(value) =>
                    updateDebt(debt.id, {
                      type: (value ?? "personalLoan") as OnboardingV2DraftDebtType,
                    })
                  }
                />
                <TextInput
                  label={t("debtsNameLabel")}
                  placeholder={t("debtsNamePlaceholder")}
                  value={debt.label}
                  error={entryErrors.label}
                  onChange={(event) =>
                    updateDebt(debt.id, { label: event.currentTarget.value })
                  }
                />
              </Group>

              {debt.type === "carLoan" && (
                <>
                  <Divider />
                  <Stack gap="xs">
                    <Text size="sm" fw={600}>
                      {t("debtsCarLoanTitle")}
                    </Text>
                    <Group grow align="flex-start">
                      <NumberInput
                        label={t("debtsCarPurchasePrice")}
                        min={0}
                        value={debt.purchasePrice ?? 0}
                        error={entryErrors.purchasePrice}
                        onChange={(value) =>
                          updateDebt(
                            debt.id,
                            { purchasePrice: toNumber(value) },
                            { recalcPrincipal: true }
                          )
                        }
                      />
                      <SegmentedControl
                        value={debt.downPaymentMode ?? "percent"}
                        onChange={(value) =>
                          updateDebt(
                            debt.id,
                            {
                              downPaymentMode:
                                value === "amount" ? "amount" : "percent",
                            },
                            { recalcPrincipal: true }
                          )
                        }
                        data={[
                          {
                            label: t("debtsCarDownPaymentPercent"),
                            value: "percent",
                          },
                          { label: t("debtsCarDownPaymentAmount"), value: "amount" },
                        ]}
                      />
                    </Group>
                    {debt.downPaymentMode === "amount" ? (
                      <NumberInput
                        label={t("debtsCarDownPaymentAmount")}
                        min={0}
                        value={debt.downPaymentAmount ?? 0}
                        error={entryErrors.downPaymentAmount}
                        onChange={(value) =>
                          updateDebt(
                            debt.id,
                            { downPaymentAmount: toOptionalNumber(value) },
                            { recalcPrincipal: true }
                          )
                        }
                      />
                    ) : (
                      <NumberInput
                        label={t("debtsCarDownPaymentPercent")}
                        min={0}
                        max={100}
                        value={debt.downPaymentPercent ?? 0}
                        error={entryErrors.downPaymentPercent}
                        onChange={(value) =>
                          updateDebt(
                            debt.id,
                            { downPaymentPercent: toOptionalNumber(value) },
                            { recalcPrincipal: true }
                          )
                        }
                      />
                    )}
                    {carLoanAmounts && (
                      <Text size="xs" c="dimmed">
                        {t("debtsCarDownPaymentSummary", {
                          downPayment: Number(
                            carLoanAmounts.downPaymentAmount.toFixed(0)
                          ),
                          loanAmount: Number(carLoanAmounts.loanAmount.toFixed(0)),
                        })}
                      </Text>
                    )}
                  </Stack>
                </>
              )}

              <Divider />

              <Group grow align="flex-start">
                <NumberInput
                  label={t("debtsPrincipal")}
                  min={0}
                  value={debt.principalOutstanding}
                  error={entryErrors.principalOutstanding}
                  onChange={(value) =>
                    updateDebt(debt.id, { principalOutstanding: toNumber(value) })
                  }
                />
                <NumberInput
                  label={t("debtsInterestRate")}
                  min={0}
                  value={debt.interestRatePct ?? ""}
                  error={entryErrors.interestRatePct}
                  onChange={(value) =>
                    updateDebt(debt.id, { interestRatePct: toOptionalNumber(value) })
                  }
                />
              </Group>

              <Group grow align="flex-start">
                <NumberInput
                  label={t("debtsTermYears")}
                  min={0}
                  value={debt.termYears ?? ""}
                  error={entryErrors.termYears}
                  onChange={(value) =>
                    updateDebt(debt.id, { termYears: toOptionalNumber(value) })
                  }
                />
                <MonthField
                  label={t("debtsMaturityMonth")}
                  placeholder={t("monthPlaceholder")}
                  value={debt.maturityMonth ?? ""}
                  error={entryErrors.maturityMonth}
                  onChange={(value) => updateDebt(debt.id, { maturityMonth: value })}
                />
              </Group>

              <Group grow align="flex-start">
                <MonthField
                  label={t("debtsStartMonth")}
                  placeholder={t("monthPlaceholder")}
                  value={debt.startMonth ?? ""}
                  error={entryErrors.startMonth}
                  onChange={(value) => updateDebt(debt.id, { startMonth: value })}
                />
                <NumberInput
                  label={t("debtsMonthlyPayment")}
                  min={0}
                  value={debt.monthlyPayment ?? ""}
                  error={entryErrors.monthlyPayment}
                  onChange={(value) =>
                    updateDebt(
                      debt.id,
                      { monthlyPayment: toOptionalNumber(value) },
                      {
                        paymentSource:
                          typeof value === "number" ? "manual" : "reset",
                      }
                    )
                  }
                />
              </Group>

              {estimatedPayment !== null && (
                <Stack gap={4}>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      {t("debtsPaymentEstimate", {
                        amount: Number(estimatedPayment.toFixed(0)),
                      })}
                    </Text>
                    {debt.monthlyPaymentSource === "estimated" && (
                      <Badge size="xs" variant="light">
                        {t("debtsEstimatedBadge")}
                      </Badge>
                    )}
                  </Group>
                  {paymentDiff !== null && paymentDiff !== 0 && (
                    <Text size="xs" c="dimmed">
                      {paymentDiff > 0
                        ? t("debtsPaymentDiffHigher", {
                            amount: Number(Math.abs(paymentDiff).toFixed(0)),
                          })
                        : t("debtsPaymentDiffLower", {
                            amount: Number(Math.abs(paymentDiff).toFixed(0)),
                          })}
                    </Text>
                  )}
                </Stack>
              )}
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
