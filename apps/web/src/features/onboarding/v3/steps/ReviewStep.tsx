import React from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import type { OnboardingCompletenessSummary } from "../completeness";
import type { OnboardingGuardrailSummary } from "../guardrails";
import type { OnboardingAsset } from "../types";

type Summary = {
  scenarioSetup: { baseCurrency?: string; startMonth?: string; horizonMonths?: number; personaFocuses?: string[] };
  members: Array<{ id: string; name?: string }>;
  assets: OnboardingAsset[];
  derivedIncomeCount: number;
  derivedExpenseCount: number;
  manualIncomeCount: number;
  manualExpenseCount: number;
  totalAssetsAmount: number;
  monthlyIncomeAmount: number;
  monthlyExpenseAmount: number;
};

type Props = {
  summary: Summary;
  completenessSummary: OnboardingCompletenessSummary;
  guardrailSummary: OnboardingGuardrailSummary;
  onEditStep: (index: number) => void;
  onEditCompletenessGroup: (stepId: OnboardingCompletenessSummary["groups"][number]["stepId"]) => void;
  onFixGuardrail: (guardrailId: string) => void;
};

const COMPLETENESS_COLORS: Record<OnboardingCompletenessSummary["level"], string> = {
  ready: "teal",
  needs_attention: "yellow",
  incomplete: "red",
};

const GUARDRAIL_COLORS: Record<OnboardingGuardrailSummary["level"], string> = {
  clear: "teal",
  warning: "yellow",
  critical: "red",
};

const GUARDRAIL_SEVERITY_COLORS: Record<OnboardingGuardrailSummary["items"][number]["severity"], string> = {
  critical: "red",
  warning: "yellow",
  info: "blue",
};

export default function ReviewStep({
  summary,
  completenessSummary,
  guardrailSummary,
  onEditStep,
  onEditCompletenessGroup,
  onFixGuardrail,
}: Props) {
  const t = useTranslations("onboardingV3.steps");
  const completenessT = useTranslations("onboardingV3");
  const guardrailsT = useTranslations("onboardingV3");
  const propertyAsset = summary.assets.find((asset): asset is Extract<OnboardingAsset, { assetType: "property" }> => asset.assetType === "property");
  const propertyUsage = propertyAsset?.usage ?? null;
  const hasMortgage = (propertyAsset?.mortgagePrincipalOutstanding ?? 0) > 0;
  const hasRentalIncome = propertyUsage === "rent" && (propertyAsset?.rentMonthly ?? 0) > 0;
  const propertyStatusLabel = propertyUsage
    ? t(`review.propertyStatus.${propertyUsage}`)
    : t("review.propertyStatus.none");
  const mortgageStatusLabel = propertyUsage
    ? hasMortgage
      ? t("review.mortgageStatus.withMortgage")
      : t("review.mortgageStatus.noMortgage")
    : t("review.mortgageStatus.notApplicable");

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Text fw={700} size="lg">
          {t("review.title")}
        </Text>
        <Text size="sm" c="dimmed">
          {t("review.description")}
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <Card withBorder radius="md" padding="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text fw={600}>{completenessT("completeness.title")}</Text>
                <Text size="sm" c="dimmed">
                  {t("review.completenessHint")}
                </Text>
              </Stack>
              <Badge color={COMPLETENESS_COLORS[completenessSummary.level]} variant="light">
                {completenessT(completenessSummary.levelKey)}
              </Badge>
            </Group>

            <div>
              <Group justify="space-between" mb={6}>
                <Text size="sm" fw={600}>
                  {t("review.completenessScore")}
                </Text>
                <Text size="sm" fw={700}>
                  {completenessSummary.scorePct}%
                </Text>
              </Group>
              <Progress
                value={completenessSummary.scorePct}
                color={COMPLETENESS_COLORS[completenessSummary.level]}
                radius="xl"
                size="lg"
              />
            </div>

            <Stack gap="sm">
              {completenessSummary.groups.map((group) => (
                <Card key={group.key} withBorder radius="md" padding="sm">
                  <Group justify="space-between" align="flex-start" gap="sm">
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Group gap="xs" wrap="wrap">
                        <Text fw={600} size="sm">
                          {completenessT(group.titleKey)}
                        </Text>
                        <Badge
                          size="sm"
                          color={
                            group.status === "complete"
                              ? "teal"
                              : group.status === "needs_attention"
                                ? "yellow"
                                : "red"
                          }
                          variant="light"
                        >
                          {t(`review.groupStatus.${group.status}`)}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        {completenessT(group.summaryKey)}
                      </Text>
                    </Stack>
                    <Button
                      variant="subtle"
                      size="xs"
                      rightSection="→"
                      onClick={() => onEditCompletenessGroup(group.stepId)}
                    >
                      {t("review.returnToStep")}
                    </Button>
                  </Group>
                </Card>
              ))}
            </Stack>
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text fw={600}>{guardrailsT("guardrails.title")}</Text>
                <Text size="sm" c="dimmed">
                  {t("review.guardrailsHint")}
                </Text>
              </Stack>
              <Badge color={GUARDRAIL_COLORS[guardrailSummary.level]} variant="light">
                {guardrailsT(guardrailSummary.levelKey)}
              </Badge>
            </Group>

            {guardrailSummary.items.length === 0 ? (
              <Alert
                color="teal"
                variant="light"
                icon={
                    <ThemeIcon color="teal" variant="light" radius="xl" size="lg">
                    ✓
                  </ThemeIcon>
                }
              >
                <Stack gap={4}>
                  <Text fw={600}>{t("review.guardrailsClearTitle")}</Text>
                  <Text size="sm">{t("review.guardrailsClearBody")}</Text>
                </Stack>
              </Alert>
            ) : (
              <Stack gap="sm">
                <Group gap="xs" wrap="wrap">
                  <Badge color="red" variant="light">
                    {guardrailsT("guardrails.summary.critical", { count: guardrailSummary.counts.critical })}
                  </Badge>
                  <Badge color="yellow" variant="light">
                    {guardrailsT("guardrails.summary.warning", { count: guardrailSummary.counts.warning })}
                  </Badge>
                  <Badge color="blue" variant="light">
                    {guardrailsT("guardrails.summary.info", { count: guardrailSummary.counts.info })}
                  </Badge>
                </Group>

                {guardrailSummary.items.map((item) => (
                  <Card key={item.id} withBorder radius="md" padding="sm">
                    <Group justify="space-between" align="flex-start" gap="sm">
                      <Group align="flex-start" gap="sm" wrap="nowrap" style={{ flex: 1 }}>
                        <ThemeIcon
                          color={GUARDRAIL_SEVERITY_COLORS[item.severity]}
                          variant="light"
                          radius="xl"
                          size="lg"
                        >
                          {item.severity === "info" ? "i" : "!"}
                        </ThemeIcon>
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="xs" wrap="wrap">
                            <Badge color={GUARDRAIL_SEVERITY_COLORS[item.severity]} variant="light">
                              {guardrailsT(`guardrails.severity.${item.severity}`)}
                            </Badge>
                            <Badge variant="outline">
                              {t(`review.stepNames.${item.target.stepId}`)}
                            </Badge>
                          </Group>
                          <Text fw={600} size="sm">
                            {guardrailsT(item.messageKey)}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {guardrailsT(item.actionHintKey)}
                          </Text>
                        </Stack>
                      </Group>
                      <Button
                        variant="subtle"
                        size="xs"
                        rightSection="→"
                        onClick={() => onFixGuardrail(item.id)}
                      >
                        {t("review.fixNow")}
                      </Button>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
        <Card withBorder>
          <Stack gap={4}>
            <Group justify="space-between">
              <Text fw={600}>{t("review.sections.scenarioSetup")}</Text>
              <Button variant="subtle" size="xs" onClick={() => onEditStep(0)}>
                {t("review.edit")}
              </Button>
            </Group>
            <Text size="sm">{t("review.summary.baseCurrency", { value: summary.scenarioSetup.baseCurrency ?? "-" })}</Text>
            <Text size="sm">{t("review.summary.startMonth", { value: summary.scenarioSetup.startMonth ?? "-" })}</Text>
            <Text size="sm">{t("review.summary.horizonMonths", { value: summary.scenarioSetup.horizonMonths ?? 120 })}</Text>
            <Text size="sm">
              {t("review.summary.personaFocuses", {
                value:
                  (summary.scenarioSetup.personaFocuses ?? []).length > 0
                    ? (summary.scenarioSetup.personaFocuses ?? [])
                        .map((focus) => t(`scenarioSetup.personaFocus.${focus}`))
                        .join("、")
                    : t("review.summary.personaFocusesEmpty"),
              })}
            </Text>
          </Stack>
        </Card>

        <Card withBorder>
          <Stack gap={4}>
            <Group justify="space-between">
              <Text fw={600}>{t("review.sections.members")}</Text>
              <Button variant="subtle" size="xs" onClick={() => onEditStep(1)}>
                {t("review.edit")}
              </Button>
            </Group>
            {summary.members.map((member) => (
              <Text key={member.id} size="sm">
                {member.name?.trim() || member.id}
              </Text>
            ))}
          </Stack>
        </Card>

        <Card withBorder>
          <Stack gap={4}>
            <Group justify="space-between">
              <Text fw={600}>{t("review.sections.assets")}</Text>
              <Button variant="subtle" size="xs" onClick={() => onEditStep(2)}>
                {t("review.edit")}
              </Button>
            </Group>
            <Text size="sm">{t("review.summary.assetCount", { value: summary.assets.length })}</Text>
            <Text size="sm">{summary.assets.map((asset) => asset.assetType).join(", ") || "-"}</Text>
            <Text size="sm">{t("review.summary.assetTotal", { value: summary.totalAssetsAmount.toLocaleString() })}</Text>
            <Text size="sm">{t("review.summary.propertyStatus", { value: propertyStatusLabel })}</Text>
            <Text size="sm">{t("review.summary.mortgageStatus", { value: mortgageStatusLabel })}</Text>
            {propertyUsage ? (
              <Text size="sm">
                {t("review.summary.propertyValue", {
                  value: (propertyAsset?.currentValue ?? 0).toLocaleString(),
                })}
              </Text>
            ) : null}
            {propertyUsage ? (
              <Text size="sm">
                {t("review.summary.holdingCost", {
                  value: (propertyAsset?.holdingCostMonthly ?? 0).toLocaleString(),
                })}
              </Text>
            ) : null}
            {hasRentalIncome ? (
              <Text size="sm">
                {t("review.summary.rentMonthly", {
                  value: (propertyAsset?.rentMonthly ?? 0).toLocaleString(),
                })}
              </Text>
            ) : null}
          </Stack>
        </Card>

        <Card withBorder>
          <Stack gap={4}>
            <Group justify="space-between">
              <Text fw={600}>{t("review.sections.cashflows")}</Text>
              <Button variant="subtle" size="xs" onClick={() => onEditStep(3)}>
                {t("review.edit")}
              </Button>
            </Group>
            <Text size="sm">{t("review.summary.derivedIncome", { value: summary.derivedIncomeCount })}</Text>
            <Text size="sm">{t("review.summary.derivedExpense", { value: summary.derivedExpenseCount })}</Text>
            <Text size="sm">{t("review.summary.manualIncome", { value: summary.manualIncomeCount })}</Text>
            <Text size="sm">{t("review.summary.manualExpense", { value: summary.manualExpenseCount })}</Text>
            <Text size="sm">{t("review.summary.monthlyIncomeTotal", { value: summary.monthlyIncomeAmount.toLocaleString() })}</Text>
            <Text size="sm">{t("review.summary.monthlyExpenseTotal", { value: summary.monthlyExpenseAmount.toLocaleString() })}</Text>
            <Text size="sm">{t("review.summary.monthlyNetTotal", { value: (summary.monthlyIncomeAmount - summary.monthlyExpenseAmount).toLocaleString() })}</Text>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
