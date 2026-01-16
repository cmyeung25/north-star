"use client";

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { findDuplicateClusters, listEventRuleDifferences } from "../../src/domain/events/mergeDuplicates";
import type { DuplicateCluster } from "../../src/domain/events/mergeDuplicates";
import type { Scenario } from "../../src/store/scenarioStore";
import type { EventDefinition, EventRule } from "./types";
import { formatCurrency, getEventGroupLabel, getEventLabel } from "./utils";

type MergeDuplicatesModalProps = {
  opened: boolean;
  onClose: () => void;
  scenarios: Scenario[];
  eventLibrary: EventDefinition[];
  onMerge: (cluster: DuplicateCluster, baseDefinitionId: string) => void;
};

type WizardStep = "select" | "review" | "confirm";

const buildScheduleSummary = (rule: EventRule) => {
  const entries = rule.schedule ?? [];
  const total = entries.reduce((sum, entry) => sum + Math.abs(entry.amount ?? 0), 0);
  const count = entries.length;
  const average = count > 0 ? total / count : 0;
  return { total, average, count };
};

export default function MergeDuplicatesModal({
  opened,
  onClose,
  scenarios,
  eventLibrary,
  onMerge,
}: MergeDuplicatesModalProps) {
  const t = useTranslations("timeline");
  const common = useTranslations("common");
  const locale = useLocale();
  const [step, setStep] = useState<WizardStep>("select");
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
  const [clusters, setClusters] = useState<DuplicateCluster[]>([]);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [baseDefinitionId, setBaseDefinitionId] = useState<string>("");

  useEffect(() => {
    if (!opened) {
      return;
    }
    setStep("select");
    setSelectedScenarioIds(scenarios.map((scenario) => scenario.id));
    setClusters([]);
    setActiveClusterId(null);
    setBaseDefinitionId("");
  }, [opened, scenarios]);

  const scenarioOptions = useMemo(
    () => scenarios.map((scenario) => ({ value: scenario.id, label: scenario.name })),
    [scenarios]
  );

  const activeCluster = useMemo(
    () => clusters.find((cluster) => cluster.id === activeClusterId) ?? null,
    [clusters, activeClusterId]
  );

  const baseDefinition = useMemo(() => {
    if (!activeCluster) {
      return null;
    }
    return (
      activeCluster.candidates.find(
        (candidate) => candidate.definition.id === baseDefinitionId
      )?.definition ?? activeCluster.candidates[0]?.definition ?? null
    );
  }, [activeCluster, baseDefinitionId]);

  const diffLabelMap: Record<string, string> = {
    startMonth: t("mergeDiffStartMonth"),
    endMonth: t("mergeDiffEndMonth"),
    monthlyAmount: t("mergeDiffMonthlyAmount"),
    oneTimeAmount: t("mergeDiffOneTimeAmount"),
    annualGrowthPct: t("mergeDiffAnnualGrowthPct"),
    mode: t("mergeDiffMode"),
    schedule: t("mergeDiffSchedule"),
  };

  const handleScan = () => {
    const nextClusters = findDuplicateClusters(
      scenarios,
      eventLibrary,
      selectedScenarioIds
    );
    setClusters(nextClusters);
    setStep("review");
  };

  const handleReviewCluster = (cluster: DuplicateCluster) => {
    setActiveClusterId(cluster.id);
    setBaseDefinitionId(cluster.candidates[0]?.definition.id ?? "");
    setStep("confirm");
  };

  const handleConfirmMerge = () => {
    if (!activeCluster || !baseDefinitionId) {
      return;
    }
    onMerge(activeCluster, baseDefinitionId);
    setClusters((current) => current.filter((cluster) => cluster.id !== activeCluster.id));
    setActiveClusterId(null);
    setBaseDefinitionId("");
    setStep("review");
  };

  const renderRuleSummary = (rule: EventRule, currency: string) => {
    if (rule.mode === "schedule") {
      const summary = buildScheduleSummary(rule);
      return t("mergeScheduleSummary", {
        avg: formatCurrency(summary.average, currency, locale),
        total: formatCurrency(summary.total, currency, locale),
        count: summary.count,
      });
    }
    return t("mergeParamsSummary", {
      monthly: formatCurrency(rule.monthlyAmount ?? 0, currency, locale),
      oneTime: formatCurrency(rule.oneTimeAmount ?? 0, currency, locale),
      growth: rule.annualGrowthPct ?? 0,
    });
  };

  const renderCandidateCard = (candidate: DuplicateCluster["candidates"][number]) => {
    const currency = candidate.definition.currency ?? candidate.scenarioBaseCurrency;
    return (
      <Card key={candidate.id} withBorder padding="sm" radius="md">
        <Stack gap={6}>
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={600}>{candidate.definition.title}</Text>
              <Text size="xs" c="dimmed">
                {getEventGroupLabel(t, candidate.definition.type)} ·{" "}
                {getEventLabel(t, candidate.definition.type)}
              </Text>
              <Text size="xs" c="dimmed">
                {t("mergeScenarioLabel", { name: candidate.scenarioName })}
              </Text>
            </Stack>
            <Badge variant="light">
              {candidate.effectiveRule.mode === "schedule"
                ? t("mergeModeSchedule")
                : t("mergeModeParams")}
            </Badge>
          </Group>
          <Text size="sm">{renderRuleSummary(candidate.effectiveRule, currency)}</Text>
        </Stack>
      </Card>
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t("mergeDuplicatesTitle")} size="lg">
      {step === "select" && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t("mergeSelectHint")}
          </Text>
          <Checkbox.Group
            value={selectedScenarioIds}
            onChange={(value) => setSelectedScenarioIds(value)}
          >
            <Stack gap={6}>
              {scenarioOptions.map((option) => (
                <Checkbox key={option.value} value={option.value} label={option.label} />
              ))}
            </Stack>
          </Checkbox.Group>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              {common("actionCancel")}
            </Button>
            <Button onClick={handleScan} disabled={selectedScenarioIds.length === 0}>
              {t("mergeScan")}
            </Button>
          </Group>
        </Stack>
      )}

      {step === "review" && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t("mergeReviewHint", { count: clusters.length })}
          </Text>
          {clusters.length === 0 ? (
            <Text size="sm">{t("mergeNoDuplicates")}</Text>
          ) : (
            <Stack gap="md">
              {clusters.map((cluster) => (
                <Card key={cluster.id} withBorder padding="md" radius="md">
                  <Stack gap="sm">
                    <Text fw={600}>
                      {t("mergeClusterTitle", { count: cluster.candidates.length })}
                    </Text>
                    <Stack gap="xs">
                      {cluster.candidates.map((candidate) => renderCandidateCard(candidate))}
                    </Stack>
                    <Group justify="flex-end">
                      <Button variant="light" onClick={() => handleReviewCluster(cluster)}>
                        {t("mergeReview")}
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setStep("select")}>
              {common("actionBack")}
            </Button>
            <Button variant="default" onClick={onClose}>
              {common("actionCancel")}
            </Button>
          </Group>
        </Stack>
      )}

      {step === "confirm" && activeCluster && baseDefinition && (
        <Stack gap="md">
          <Stack gap={6}>
            <Text fw={600}>{t("mergeConfirmTitle")}</Text>
            <Text size="sm" c="dimmed">
              {t("mergeImpact", {
                count: new Set(activeCluster.candidates.map((candidate) => candidate.scenarioId))
                  .size,
              })}
            </Text>
          </Stack>
          <Select
            label={t("mergeBaseLabel")}
            data={activeCluster.candidates.map((candidate) => ({
              value: candidate.definition.id,
              label: `${candidate.definition.title} · ${candidate.scenarioName}`,
            }))}
            value={baseDefinitionId}
            onChange={(value) => setBaseDefinitionId(value ?? baseDefinitionId)}
          />
          <Divider />
          <Stack gap="sm">
            {activeCluster.candidates.map((candidate) => {
              const diffs = listEventRuleDifferences(
                baseDefinition.rule,
                candidate.effectiveRule
              );
              const hasDiffs = diffs.length > 0;
              return (
                <Card key={candidate.id} withBorder padding="sm" radius="md">
                  <Stack gap={6}>
                    <Group justify="space-between" align="center">
                      <Text fw={600}>{candidate.definition.title}</Text>
                      <Badge variant="light">{candidate.scenarioName}</Badge>
                    </Group>
                    {hasDiffs ? (
                      <Group gap={6} wrap="wrap">
                        {diffs.map((diff) => (
                          <Badge key={diff} variant="outline" color="indigo">
                            {diffLabelMap[diff] ?? diff}
                          </Badge>
                        ))}
                      </Group>
                    ) : (
                      <Text size="sm" c="dimmed">
                        {t("mergeNoOverrides")}
                      </Text>
                    )}
                  </Stack>
                </Card>
              );
            })}
          </Stack>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setStep("review")}>
              {common("actionBack")}
            </Button>
            <Button onClick={handleConfirmMerge}>{t("mergeConfirm")}</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
