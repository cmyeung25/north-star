"use client";

import {
  Badge,
  Button,
  Card,
  Group,
  List,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useLocale } from "next-intl";
import type { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useScenarioStore, type Scenario } from "../../../store/scenarioStore";
import { useProjectionWithLedger } from "../../../engine/useProjectionWithLedger";
import type {
  OnboardingV2Draft,
  OnboardingV2ScenarioChanges,
} from "../../../domain/onboarding/v2/mapOnboardingV2DraftToScenario";
import { buildScenarioUrl } from "../../../utils/scenarioContext";

type ReviewStepProps = {
  draft: OnboardingV2Draft;
  scenario: Scenario | null;
  scenarioId: string;
  baseMonth: string;
  horizonYears: number;
  scenarioChanges: OnboardingV2ScenarioChanges | null;
  onJumpToStep: (step: number) => void;
  onApplyDraft: () => void;
  onApplyLater: () => void;
  canApplyDraft: boolean;
  t: ReturnType<typeof useTranslations<"onboardingDraft">>;
};

type DataQualityFlag = {
  id: string;
  severity: "critical" | "warning";
  message: string;
  actionLabel: string;
  onAction: () => void;
};

const resolveHorizonMonths = (years: number) => {
  if (years === 3) {
    return 36;
  }
  if (years === 10) {
    return 120;
  }
  return 60;
};

const stepIndex = {
  profile: 0,
  household: 1,
  assumptions: 2,
  income: 3,
  livingSpend: 4,
  housing: 5,
  assets: 6,
  debts: 7,
  insurance: 8,
  review: 9,
} as const;

export default function ReviewStep({
  draft,
  scenario,
  scenarioId,
  baseMonth,
  horizonYears,
  scenarioChanges,
  onJumpToStep,
  onApplyDraft,
  onApplyLater,
  canApplyDraft,
  t,
}: ReviewStepProps) {
  const locale = useLocale();
  const router = useRouter();
  const eventLibrary = useScenarioStore((state) => state.eventLibrary);
  const members = useScenarioStore((state) => state.members);
  const budgetRules = useScenarioStore((state) => state.budgetRules);

  const horizonMonths = useMemo(() => resolveHorizonMonths(horizonYears), [horizonYears]);
  const assumptionsPatch = useMemo(
    () => scenarioChanges?.assumptionsPatch ?? {},
    [scenarioChanges]
  );

  const scenarioForProjection = useMemo(() => {
    if (!scenario) {
      return null;
    }
    const baseCurrency = scenario.baseCurrency;
    return {
      ...scenario,
      baseCurrency,
      assumptions: {
        ...scenario.assumptions,
        ...assumptionsPatch,
        baseMonth,
        horizonMonths,
        initialCash:
          typeof assumptionsPatch.initialCash === "number"
            ? assumptionsPatch.initialCash
            : scenario.assumptions.initialCash,
      },
    };
  }, [assumptionsPatch, baseMonth, horizonMonths, scenario]);

  const projectionBundle = useProjectionWithLedger(
    scenarioForProjection,
    eventLibrary,
    {
      members,
      budgetRules,
    }
  );

  const formatCurrency = (value: number, currency?: string) => {
    const rounded = Math.round(value);
    const formatted = Math.abs(rounded).toLocaleString(locale, {
      maximumFractionDigits: 0,
    });
    const prefix = rounded < 0 ? "-" : "";
    const resolvedCurrency =
      currency ?? scenario?.baseCurrency ?? draft.profile.baseCurrency ?? "USD";
    return `${prefix}${resolvedCurrency} ${formatted}`;
  };

  const summary = useMemo(() => {
    const ledgerEntries = projectionBundle.ledgerByMonth[baseMonth] ?? [];
    const incomeTotal = ledgerEntries.reduce(
      (sum, entry) => (entry.amount > 0 ? sum + entry.amount : sum),
      0
    );
    const expenseTotal = ledgerEntries.reduce(
      (sum, entry) => (entry.amount < 0 ? sum + Math.abs(entry.amount) : sum),
      0
    );
    const netCashflow = incomeTotal - expenseTotal;
    const netWorthNow = projectionBundle.projection?.netWorth?.[0] ?? 0;
    const cashNow = projectionBundle.projection?.cashBalance?.[0] ?? 0;
    const cashBufferMonths = expenseTotal > 0 ? cashNow / expenseTotal : null;
    const netWorthSeries = projectionBundle.projection?.netWorth ?? [];
    const months = projectionBundle.months ?? [];
    const endNetWorth =
      netWorthSeries.length > 0 ? netWorthSeries[netWorthSeries.length - 1] : 0;
    const endCash =
      projectionBundle.projection?.cashBalance?.length
        ? projectionBundle.projection.cashBalance[
            projectionBundle.projection.cashBalance.length - 1
          ] ?? 0
        : 0;
    const baseNetWorth = netWorthSeries[0] ?? 0;
    const targets = [100000, 500000, 1000000];
    const timeToTargets = targets.map((target) => {
      const targetValue = baseNetWorth + target;
      const achievedIndex = netWorthSeries.findIndex(
        (value) => value >= targetValue
      );
      const achievedMonth = achievedIndex >= 0 ? months[achievedIndex] : null;
      return { target, achievedMonth };
    });

    return {
      incomeTotal,
      expenseTotal,
      netCashflow,
      netWorthNow,
      cashNow,
      cashBufferMonths,
      timeToTargets,
      endNetWorth,
      endCash,
    };
  }, [baseMonth, projectionBundle]);

  const goToMoneyTab = useCallback(
    (tab: "income" | "expenses" | "assets" | "liabilities") => {
      if (!scenarioId) {
        return;
      }
      const baseUrl = buildScenarioUrl("/money", scenarioId);
      router.push(`/${locale}${baseUrl}&tab=${tab}`);
    },
    [locale, router, scenarioId]
  );

  const dataQualityFlags = useMemo<DataQualityFlag[]>(() => {
    const flags: DataQualityFlag[] = [];
    const own = draft.housing.own;
    const propertyValue = Number(own.propertyValue ?? 0);
    const downPaymentPercent =
      own.downPaymentMode === "percent"
        ? Number(own.downPaymentPercent ?? 0)
        : propertyValue > 0
          ? (Number(own.downPaymentAmount ?? 0) / propertyValue) * 100
          : 0;
    const downPaymentAmount =
      own.downPaymentMode === "percent"
        ? (propertyValue * downPaymentPercent) / 100
        : Number(own.downPaymentAmount ?? 0);
    const loanAmount = Math.max(0, propertyValue - downPaymentAmount);
    const mortgageRate = Number(own.mortgageRatePct ?? 0);
    const mortgageTerm = Number(own.mortgageTermMonths ?? 0);

    if (
      draft.housing.mode === "own" &&
      own.mortgageEnabled &&
      (loanAmount <= 0 || mortgageRate <= 0 || mortgageTerm <= 0)
    ) {
      flags.push({
        id: "mortgage-missing-details",
        severity: "warning",
        message: t("flagMortgageMissingDetails"),
        actionLabel: t("flagFixInStep", { step: t("step.housing") }),
        onAction: () => onJumpToStep(stepIndex.housing),
      });
    }

    if (
      draft.housing.mode === "own" &&
      own.mortgagePayment &&
      own.mortgagePayment > 0 &&
      (!own.mortgageEnabled || loanAmount <= 0)
    ) {
      flags.push({
        id: "mortgage-payment-unlinked",
        severity: "warning",
        message: t("flagMortgagePaymentUnlinked"),
        actionLabel: t("flagFixInMoney", { tab: t("moneyTab.liabilities") }),
        onAction: () => goToMoneyTab("liabilities"),
      });
    }

    draft.debts.forEach((debt) => {
      const principal = Number(debt.principalOutstanding ?? 0);
      const interestRate = debt.interestRatePct;
      const termYears = debt.termYears;
      if (principal <= 0 || interestRate === null || termYears === null) {
        flags.push({
          id: `loan-missing-${debt.id}`,
          severity: "warning",
          message: t("flagLoanMissingDetails", {
            label: debt.label || t("flagLoanMissingDetailsFallback"),
          }),
          actionLabel: t("flagFixInStep", { step: t("step.debts") }),
          onAction: () => onJumpToStep(stepIndex.debts),
        });
      }
      if (debt.monthlyPayment && debt.monthlyPayment > 0 && principal <= 0) {
        flags.push({
          id: `loan-payment-unlinked-${debt.id}`,
          severity: "warning",
          message: t("flagLoanPaymentUnlinked", {
            label: debt.label || t("flagLoanMissingDetailsFallback"),
          }),
          actionLabel: t("flagFixInMoney", { tab: t("moneyTab.liabilities") }),
          onAction: () => goToMoneyTab("liabilities"),
        });
      }
    });

    const savingsPoliciesMissingValue = draft.insurance.policies.filter(
      (policy) =>
        policy.type === "savings" &&
        policy.cashValueKnown &&
        (!policy.cashValue || policy.cashValue <= 0)
    );
    if (savingsPoliciesMissingValue.length > 0) {
      flags.push({
        id: "savings-missing-cash-value",
        severity: "warning",
        message: t("flagSavingsMissingCashValue", {
          count: savingsPoliciesMissingValue.length,
        }),
        actionLabel: t("flagFixInStep", { step: t("step.insurance") }),
        onAction: () => onJumpToStep(stepIndex.insurance),
      });
    }

    if (summary.incomeTotal <= 0 && summary.expenseTotal > 0) {
      flags.push({
        id: "income-zero",
        severity: "critical",
        message: t("flagIncomeZero"),
        actionLabel: t("flagFixInStep", { step: t("step.income") }),
        onAction: () => onJumpToStep(stepIndex.income),
      });
    }

    if (draft.assets.cash.amount <= 0 && summary.expenseTotal > 0) {
      flags.push({
        id: "cash-zero",
        severity: "critical",
        message: t("flagCashZero"),
        actionLabel: t("flagFixInStep", { step: t("step.assets") }),
        onAction: () => onJumpToStep(stepIndex.assets),
      });
    }

    const breakdownTotal = draft.assets.investment.breakdown.reduce(
      (sum, entry) => sum + (entry.value ?? 0),
      0
    );
    if (
      draft.assets.investment.breakdownEnabled &&
      draft.assets.investment.totalAmount > 0 &&
      breakdownTotal <= 0
    ) {
      flags.push({
        id: "investment-breakdown-empty",
        severity: "warning",
        message: t("flagInvestmentBreakdownEmpty"),
        actionLabel: t("flagFixInStep", { step: t("step.assets") }),
        onAction: () => onJumpToStep(stepIndex.assets),
      });
    }

    return flags;
  }, [draft, goToMoneyTab, onJumpToStep, summary, t]);

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={4}>{t("reviewTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("reviewHint")}
        </Text>
      </Stack>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={600}>{t("summaryTitle")}</Text>
              <Text size="sm" c="dimmed">
                {t("summaryHint", { month: baseMonth })}
              </Text>
            </Stack>
            <Badge color="blue" variant="light">
              {t("summaryLive")}
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Card withBorder radius="md" padding="sm">
              <Stack gap={4}>
                <Text size="xs" c="dimmed">
                  {t("summaryMonthlyIncome")}
                </Text>
                <Text fw={600}>{formatCurrency(summary.incomeTotal)}</Text>
              </Stack>
            </Card>
            <Card withBorder radius="md" padding="sm">
              <Stack gap={4}>
                <Text size="xs" c="dimmed">
                  {t("summaryMonthlyExpense")}
                </Text>
                <Text fw={600}>{formatCurrency(summary.expenseTotal)}</Text>
              </Stack>
            </Card>
            <Card withBorder radius="md" padding="sm">
              <Stack gap={4}>
                <Text size="xs" c="dimmed">
                  {t("summaryNetCashflow")}
                </Text>
                <Text fw={600}>{formatCurrency(summary.netCashflow)}</Text>
              </Stack>
            </Card>
            <Card withBorder radius="md" padding="sm">
              <Stack gap={4}>
                <Text size="xs" c="dimmed">
                  {t("summaryNetWorthNow")}
                </Text>
                <Text fw={600}>{formatCurrency(summary.netWorthNow)}</Text>
              </Stack>
            </Card>
            <Card withBorder radius="md" padding="sm">
              <Stack gap={4}>
                <Text size="xs" c="dimmed">
                  {t("summaryCashBuffer")}
                </Text>
                <Text fw={600}>
                  {summary.cashBufferMonths === null
                    ? t("summaryValueNa")
                    : t("summaryCashBufferValue", {
                        months: summary.cashBufferMonths.toFixed(1),
                      })}
                </Text>
              </Stack>
            </Card>
            <Card withBorder radius="md" padding="sm">
              <Stack gap={4}>
                <Text size="xs" c="dimmed">
                  {t("summaryHorizonNetWorth", { years: horizonYears })}
                </Text>
                <Text fw={600}>{formatCurrency(summary.endNetWorth)}</Text>
                <Text size="xs" c="dimmed">
                  {t("summaryHorizonCash", { years: horizonYears })}{" "}
                  {formatCurrency(summary.endCash)}
                </Text>
              </Stack>
            </Card>
          </SimpleGrid>
          <Card withBorder radius="md" padding="sm">
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                {t("summaryTimeTo")}
              </Text>
              <List spacing="xs">
                {summary.timeToTargets.map((target) => (
                  <List.Item key={target.target}>
                    {t("summaryTimeToTarget", {
                      target: formatCurrency(target.target),
                      month: target.achievedMonth ?? t("summaryNotReached"),
                    })}
                  </List.Item>
                ))}
              </List>
            </Stack>
          </Card>
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Text fw={600}>{t("reviewFlagsTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("reviewFlagsHint")}
          </Text>
          {dataQualityFlags.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("reviewFlagsEmpty")}
            </Text>
          ) : (
            <Stack gap="sm">
              {dataQualityFlags.map((flag) => (
                <Card key={flag.id} withBorder radius="md" padding="sm">
                  <Group align="flex-start" justify="space-between">
                    <Stack gap={4}>
                      <Group gap="xs">
                        <Badge
                          color={flag.severity === "critical" ? "red" : "orange"}
                          variant="light"
                        >
                          {flag.severity === "critical"
                            ? t("flagCritical")
                            : t("flagWarning")}
                        </Badge>
                        <Text size="sm">{flag.message}</Text>
                      </Group>
                    </Stack>
                    <Button size="xs" variant="light" onClick={flag.onAction}>
                      {flag.actionLabel}
                    </Button>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="md">
          <Title order={5}>{t("resultTitle")}</Title>
          <Text size="sm" c="dimmed">
            {t("resultHint")}
          </Text>
          <Group align="center" wrap="wrap">
            <Button onClick={onApplyDraft} disabled={!canApplyDraft}>
              {t("saveCta")}
            </Button>
            <Button variant="default" onClick={onApplyLater}>
              {t("laterCta")}
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            {t("saveHint")}
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
