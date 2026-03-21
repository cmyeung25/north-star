"use client";

import { Badge, Button, Card, Group, Stack, Table, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { downloadTextFile } from "../../../../src/export/projectionExport";
import { readMarketEntryEvents } from "../../../../src/lib/analytics/marketEntry";
import { readOnboardingFunnelEvents } from "../../../../src/lib/analytics/onboardingFunnel";
import {
  buildWeeklyProductAnalyticsDashboard,
  formatWeeklyProductAnalyticsDashboardAsCsv,
  formatWeeklyProductAnalyticsDashboardForExport,
} from "../../../../src/lib/analytics/weeklyProductAnalyticsDashboard";

const statusColorMap: Record<string, string> = {
  ok: "green",
  observe: "yellow",
  needs_attention: "red",
  hold: "gray",
  fix_before_scale: "orange",
  ready_to_scale_traffic: "green",
};

const formatPct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);

export default function WeeklyProductAnalyticsDashboard() {
  const t = useTranslations("debug.weeklyReview");
  const exportT = useTranslations("export");
  const [refreshToken, setRefreshToken] = useState(0);

  const dashboard = useMemo(() => {
    void refreshToken;
    return buildWeeklyProductAnalyticsDashboard({
      onboardingEvents: readOnboardingFunnelEvents(),
      marketEntryEvents: readMarketEntryEvents(),
    });
  }, [refreshToken]);

  const exportJson = () => {
    downloadTextFile(
      `weekly-product-analytics-${dashboard.window.weekStart.slice(0, 10)}.json`,
      "application/json",
      JSON.stringify(formatWeeklyProductAnalyticsDashboardForExport(dashboard), null, 2),
    );
  };

  const exportCsv = () => {
    downloadTextFile(
      `weekly-product-analytics-${dashboard.window.weekStart.slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
      formatWeeklyProductAnalyticsDashboardAsCsv(dashboard),
    );
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="end">
        <div>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed">{t("subtitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("window", {
              weekStart: dashboard.window.weekStart.slice(0, 10),
              weekEnd: dashboard.window.weekEnd.slice(0, 10),
            })}
          </Text>
        </div>
        <Group>
          <Button variant="default" onClick={() => setRefreshToken((value) => value + 1)}>
            {t("refresh")}
          </Button>
          <Button variant="default" onClick={exportCsv}>{exportT("exportCsv")}</Button>
          <Button onClick={exportJson}>{exportT("exportJson")}</Button>
        </Group>
      </Group>

      <Card withBorder>
        <Group justify="space-between" align="start" mb="md">
          <div>
            <Text fw={700}>{t("onboarding.title")}</Text>
            <Text c="dimmed" size="sm">{t("onboarding.subtitle")}</Text>
          </div>
          <Badge color={statusColorMap[dashboard.onboarding.checks.reviewSampleSize.status]}>
            {t(`status.${dashboard.onboarding.checks.reviewSampleSize.status}` as const)}
          </Badge>
        </Group>
        <Group grow mb="md">
          <Card withBorder>
            <Text size="sm" c="dimmed">{t("onboarding.cards.reviewSessions")}</Text>
            <Text fw={700}>{dashboard.onboarding.aggregatePack.totals.reviewSessionCount}</Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">{t("onboarding.cards.reviewToCompletion")}</Text>
            <Text fw={700}>{formatPct(dashboard.onboarding.aggregatePack.totals.reviewToCompletedConversionRate)}</Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">{t("onboarding.cards.reviewWithoutCompletion")}</Text>
            <Text fw={700}>{formatPct(dashboard.onboarding.aggregatePack.totals.reviewWithoutCompletionRate)}</Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">{t("onboarding.cards.guardrailsShown")}</Text>
            <Text fw={700}>{dashboard.onboarding.aggregatePack.totals.severityMix.total}</Text>
          </Card>
        </Group>

        <Text size="sm" c="dimmed" mb="xs">{dashboard.onboarding.checks.localeBias.note}</Text>
        <Text size="sm" c="dimmed" mb="md">{dashboard.onboarding.checks.personaPresetJourneyBias.note}</Text>

        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("onboarding.table.guardrail")}</Table.Th>
              <Table.Th>{t("onboarding.table.shownReviews")}</Table.Th>
              <Table.Th>{t("onboarding.table.fixSuccess")}</Table.Th>
              <Table.Th>{t("onboarding.table.incompleteShare")}</Table.Th>
              <Table.Th>{t("onboarding.table.action")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {dashboard.onboarding.focusGuardrails.map((row) => (
              <Table.Tr key={row.guardrailId}>
                <Table.Td>{row.guardrailId}</Table.Td>
                <Table.Td>{row.shownReviewCount}</Table.Td>
                <Table.Td>{formatPct(row.fixSuccessRate)}</Table.Td>
                <Table.Td>{formatPct(row.incompleteShareOfShown)}</Table.Td>
                <Table.Td>{t(`onboarding.action.${row.recommendedAction}` as const)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder>
        <Group justify="space-between" align="start" mb="md">
          <div>
            <Text fw={700}>{t("marketEntry.title")}</Text>
            <Text c="dimmed" size="sm">{t("marketEntry.subtitle")}</Text>
          </div>
          <Badge color={statusColorMap[dashboard.marketEntry.decision.status]}>
            {t(`decision.${dashboard.marketEntry.decision.status}` as const)}
          </Badge>
        </Group>
        <Group grow mb="md">
          <Card withBorder>
            <Text size="sm" c="dimmed">{t("marketEntry.cards.landingViews")}</Text>
            <Text fw={700}>{dashboard.marketEntry.summary.totals.market_landing_view}</Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">{t("marketEntry.cards.journeyClicks")}</Text>
            <Text fw={700}>{dashboard.marketEntry.summary.totals.journey_cta_click}</Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">{t("marketEntry.cards.caseCreated")}</Text>
            <Text fw={700}>{dashboard.marketEntry.summary.totals.case_created}</Text>
          </Card>
          <Card withBorder>
            <Text size="sm" c="dimmed">{t("marketEntry.cards.onboardingCompleted")}</Text>
            <Text fw={700}>{dashboard.marketEntry.summary.totals.onboarding_completed}</Text>
          </Card>
        </Group>

        <Text size="sm" c="dimmed">{dashboard.marketEntry.checks.localeSkew.note}</Text>
        <Text size="sm" c="dimmed" mb="md">{dashboard.marketEntry.checks.experimentCoverage.note}</Text>

        <Table striped withTableBorder mb="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("marketEntry.kpiTable.kpi")}</Table.Th>
              <Table.Th>{t("marketEntry.kpiTable.current")}</Table.Th>
              <Table.Th>{t("marketEntry.kpiTable.previous")}</Table.Th>
              <Table.Th>{t("marketEntry.kpiTable.delta")}</Table.Th>
              <Table.Th>{t("marketEntry.kpiTable.threshold")}</Table.Th>
              <Table.Th>{t("marketEntry.kpiTable.status")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {dashboard.marketEntry.kpis.map((kpi) => (
              <Table.Tr key={kpi.id}>
                <Table.Td>{t(`marketEntry.kpi.${kpi.id}` as const)}</Table.Td>
                <Table.Td>{formatPct(kpi.valuePct)}</Table.Td>
                <Table.Td>{formatPct(kpi.previousValuePct)}</Table.Td>
                <Table.Td>{formatPct(kpi.deltaPctPoints)}</Table.Td>
                <Table.Td>{formatPct(kpi.thresholdPct)}</Table.Td>
                <Table.Td>
                  <Badge color={statusColorMap[kpi.status]}>
                    {t(`status.${kpi.status}` as const)}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("marketEntry.cohortTable.cohort")}</Table.Th>
              <Table.Th>{t("marketEntry.cohortTable.caseCreated")}</Table.Th>
              <Table.Th>{t("marketEntry.cohortTable.onboardingCompleted")}</Table.Th>
              <Table.Th>{t("marketEntry.cohortTable.drop")}</Table.Th>
              <Table.Th>{t("marketEntry.cohortTable.experiment")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {dashboard.marketEntry.topDropOffJourneyPresetPairs.map((row) => (
              <Table.Tr key={row.label}>
                <Table.Td>{row.label}</Table.Td>
                <Table.Td>{row.counts.case_created}</Table.Td>
                <Table.Td>{row.counts.onboarding_completed}</Table.Td>
                <Table.Td>{formatPct(row.rates.caseCreatedToOnboardingCompletedDropPct)}</Table.Td>
                <Table.Td>{row.experimentVariant ?? "—"}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
