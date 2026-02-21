"use client";

import {
  Badge,
  Button,
  Card,
  Group,
  List,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useLocale } from "next-intl";
import type { useTranslations } from "next-intl";
import { useMemo } from "react";
import { computeProjection } from "@north-star/engine";
import { useRouter } from "next/navigation";
import type { Scenario } from "../../../store/scenarioStore";
import { resolvePlanningHorizonMonths } from "../../../domain/assumptions/planningHorizon";
import {
  compileScenarioV2ToLedger,
  compileScenarioV2ProjectionBundle,
} from "../../../engine/scenarioV2Compiler";
import type {
  OnboardingV2Draft,
} from "../../../domain/onboarding/v2/draftTypes";

type ReviewStepProps = {
  draft: OnboardingV2Draft;
  scenario: Scenario | null;
  baseMonth: string;
  horizonYears: number;
  scenarioPreview: Scenario | null;
  scenarioIsV2: boolean;
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

const resolveHorizonMonths = (years: number) => resolvePlanningHorizonMonths(years);

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
  baseMonth,
  horizonYears,
  scenarioPreview,
  scenarioIsV2,
  onJumpToStep,
  onApplyDraft,
  onApplyLater,
  canApplyDraft,
  t,
}: ReviewStepProps) {
  const locale = useLocale();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 47.99em)");

  const horizonMonths = useMemo(() => resolveHorizonMonths(horizonYears), [horizonYears]);
  const scenarioForProjection = useMemo(() => {
    if (!scenarioPreview) {
      return null;
    }
    return {
      ...scenarioPreview,
      assumptions: {
        ...scenarioPreview.assumptions,
        baseMonth,
        horizonMonths,
      },
    };
  }, [baseMonth, horizonMonths, scenarioPreview]);

  const projectionBundle = useMemo(
    () =>
      scenarioForProjection
        ? compileScenarioV2ProjectionBundle(scenarioForProjection)
        : null,
    [scenarioForProjection]
  );

  const projectionResult = useMemo(() => {
    if (!scenarioForProjection) {
      return null;
    }
    return projectionBundle ? computeProjection(projectionBundle.input) : null;
  }, [projectionBundle, scenarioForProjection]);

  const projectionWarnings = useMemo(
    () => projectionBundle?.warnings ?? [],
    [projectionBundle]
  );

  const ledgerRows = useMemo(
    () => (scenarioForProjection ? compileScenarioV2ToLedger(scenarioForProjection) : []),
    [scenarioForProjection]
  );

  const formatCurrency = (value: number, currency?: string) => {
    const rounded = Math.round(value);
    const formatted = Math.abs(rounded).toLocaleString(locale, {
      maximumFractionDigits: 0,
    });
    const prefix = rounded < 0 ? "-" : "";
    const resolvedCurrency =
      currency ??
      scenarioPreview?.baseCurrency ??
      scenario?.baseCurrency ??
      draft.profile.baseCurrency ??
      "USD";
    return `${prefix}${resolvedCurrency} ${formatted}`;
  };

  const summary = useMemo(() => {
    const ledgerEntries = ledgerRows.filter((entry) => entry.month === baseMonth);
    const incomeTotal = ledgerEntries.reduce(
      (sum, entry) => (entry.amount > 0 ? sum + entry.amount : sum),
      0
    );
    const expenseTotal = ledgerEntries.reduce(
      (sum, entry) => (entry.amount < 0 ? sum + Math.abs(entry.amount) : sum),
      0
    );
    const netCashflow = incomeTotal - expenseTotal;
    const netWorthNow = projectionResult?.netWorth?.[0] ?? 0;
    const cashNow = projectionResult?.cashBalance?.[0] ?? 0;
    const cashBufferMonths = expenseTotal > 0 ? cashNow / expenseTotal : null;
    const netWorthSeries = projectionResult?.netWorth ?? [];
    const months = projectionResult?.months ?? [];
    const endNetWorth =
      netWorthSeries.length > 0 ? netWorthSeries[netWorthSeries.length - 1] : 0;
    const endCash =
      projectionResult?.cashBalance?.length
        ? projectionResult.cashBalance[projectionResult.cashBalance.length - 1] ?? 0
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
  }, [baseMonth, ledgerRows, projectionResult]);


  const dataQualityFlags = useMemo<DataQualityFlag[]>(() => {
    const flags: DataQualityFlag[] = [];
    if (!scenarioIsV2) {
      flags.push({
        id: "scenario-legacy",
        severity: "critical",
        message: t("flagScenarioV2Required"),
        actionLabel: t("flagScenarioV2RequiredAction"),
        onAction: () => router.push(`/${locale}/scenarios`),
      });
      return flags;
    }
    const own = draft.housing.own;
    const propertyMarketValue = Number(own.propertyMarketValue ?? 0);
    const mortgageBaseValue =
      own.mortgageBaseMode === "CUSTOM"
        ? Number(own.mortgageBaseValue ?? propertyMarketValue)
        : propertyMarketValue;
    const downPaymentPercent =
      own.downPaymentMode === "percent"
        ? Number(own.downPaymentPercent ?? 0)
        : propertyMarketValue > 0
          ? (Number(own.downPaymentAmount ?? 0) / propertyMarketValue) * 100
          : 0;
    const downPaymentAmount =
      own.downPaymentMode === "percent"
        ? (propertyMarketValue * downPaymentPercent) / 100
        : Number(own.downPaymentAmount ?? 0);
    const loanAmount = Math.max(0, mortgageBaseValue - downPaymentAmount);
    const mortgageRate = Number(own.mortgageRatePct ?? 0);
    const mortgageTerm = Number(own.mortgageTermYears ?? 0);

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

    projectionWarnings.forEach((warning, index) => {
      flags.push({
        id: `${warning.code}-${index}`,
        severity: "warning",
        message: warning.code,
        actionLabel: t("flagFixInStep", { step: t("step.housing") }),
        onAction: () => onJumpToStep(stepIndex.housing),
      });
    });

    return flags;
  }, [draft, locale, onJumpToStep, projectionWarnings, router, scenarioIsV2, summary, t]);

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
          <Text fw={600}>總覽</Text>
          {[
            { key: "profile", label: t("step.profile"), step: stepIndex.profile },
            { key: "household", label: t("step.household"), step: stepIndex.household },
            { key: "assumptions", label: t("step.assumptions"), step: stepIndex.assumptions },
            { key: "income", label: t("step.income"), step: stepIndex.income },
            { key: "living", label: t("step.livingSpend"), step: stepIndex.livingSpend },
            { key: "housing", label: t("step.housing"), step: stepIndex.housing },
            { key: "assets", label: t("step.assets"), step: stepIndex.assets },
            { key: "debts", label: t("step.debts"), step: stepIndex.debts },
            { key: "insurance", label: t("step.insurance"), step: stepIndex.insurance },
          ].map((entry) => (
            <Group key={entry.key} justify="space-between">
              <Text size="sm">{entry.label}</Text>
              <Button variant="subtle" size="compact-sm" onClick={() => onJumpToStep(entry.step)}>
                編輯
              </Button>
            </Group>
          ))}
        </Stack>
      </Card>

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
          {isMobile ? (
            <Paper
              withBorder
              radius="md"
              p="sm"
              style={{
                position: "sticky",
                bottom: 0,
                zIndex: 5,
                background: "var(--aur-card-0, #ffffff)",
                paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
              }}
            >
              <Stack gap="xs">
                <Button onClick={onApplyDraft} disabled={!canApplyDraft} fullWidth>
                  {t("saveCta")}
                </Button>
                <Button variant="default" onClick={onApplyLater} fullWidth>
                  {t("laterCta")}
                </Button>
              </Stack>
            </Paper>
          ) : (
            <Group align="center" wrap="wrap">
              <Button onClick={onApplyDraft} disabled={!canApplyDraft}>
                {t("saveCta")}
              </Button>
              <Button variant="default" onClick={onApplyLater}>
                {t("laterCta")}
              </Button>
            </Group>
          )}
          <Text size="xs" c="dimmed">
            {t("saveHint")}
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
