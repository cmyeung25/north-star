import React from "react";
import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import type { OnboardingAsset } from "../types";

type ChecklistItem = {
  label: string;
  completed: boolean;
  warning?: string;
};

type Summary = {
  scenarioSetup: { baseCurrency?: string; startMonth?: string; horizonMonths?: number };
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
  items: ChecklistItem[];
  summary: Summary;
  onEditStep: (index: number) => void;
};

export default function ReviewStep({ items, summary, onEditStep }: Props) {
  const t = useTranslations("onboardingV3.steps");

  return (
    <Stack>
      <Text fw={600}>{t("review.title")}</Text>

      <Group grow align="stretch">
        <Card withBorder>
          <Stack gap={4}>
            <Group justify="space-between"><Text fw={600}>{t("review.sections.scenarioSetup")}</Text><Button variant="subtle" size="xs" onClick={() => onEditStep(0)}>{t("review.edit")}</Button></Group>
            <Text size="sm">{t("review.summary.baseCurrency", { value: summary.scenarioSetup.baseCurrency ?? "-" })}</Text>
            <Text size="sm">{t("review.summary.startMonth", { value: summary.scenarioSetup.startMonth ?? "-" })}</Text>
            <Text size="sm">{t("review.summary.horizonMonths", { value: summary.scenarioSetup.horizonMonths ?? 120 })}</Text>
          </Stack>
        </Card>
        <Card withBorder>
          <Stack gap={4}>
            <Group justify="space-between"><Text fw={600}>{t("review.sections.members")}</Text><Button variant="subtle" size="xs" onClick={() => onEditStep(1)}>{t("review.edit")}</Button></Group>
            {summary.members.map((member) => (
              <Text key={member.id} size="sm">{member.name?.trim() || member.id}</Text>
            ))}
          </Stack>
        </Card>
      </Group>

      <Group grow align="stretch">
        <Card withBorder>
          <Stack gap={4}>
            <Group justify="space-between"><Text fw={600}>{t("review.sections.assets")}</Text><Button variant="subtle" size="xs" onClick={() => onEditStep(2)}>{t("review.edit")}</Button></Group>
            <Text size="sm">{t("review.summary.assetCount", { value: summary.assets.length })}</Text>
            <Text size="sm">{summary.assets.map((asset) => asset.assetType).join(", ") || "-"}</Text>
            <Text size="sm">{t("review.summary.assetTotal", { value: summary.totalAssetsAmount.toLocaleString() })}</Text>
          </Stack>
        </Card>
        <Card withBorder>
          <Stack gap={4}>
            <Group justify="space-between"><Text fw={600}>{t("review.sections.cashflows")}</Text><Button variant="subtle" size="xs" onClick={() => onEditStep(3)}>{t("review.edit")}</Button></Group>
            <Text size="sm">{t("review.summary.derivedIncome", { value: summary.derivedIncomeCount })}</Text>
            <Text size="sm">{t("review.summary.derivedExpense", { value: summary.derivedExpenseCount })}</Text>
            <Text size="sm">{t("review.summary.manualIncome", { value: summary.manualIncomeCount })}</Text>
            <Text size="sm">{t("review.summary.manualExpense", { value: summary.manualExpenseCount })}</Text>
            <Text size="sm">{t("review.summary.monthlyIncomeTotal", { value: summary.monthlyIncomeAmount.toLocaleString() })}</Text>
            <Text size="sm">{t("review.summary.monthlyExpenseTotal", { value: summary.monthlyExpenseAmount.toLocaleString() })}</Text>
            <Text size="sm">{t("review.summary.monthlyNetTotal", { value: (summary.monthlyIncomeAmount - summary.monthlyExpenseAmount).toLocaleString() })}</Text>
          </Stack>
        </Card>
      </Group>

      <Card withBorder>
        <Stack gap="xs">
          <Text fw={600}>{t("review.checklistTitle")}</Text>
          <Stack component="ul" gap="xs" style={{ margin: 0, paddingInlineStart: "1.25rem" }}>
            {items.map((item) => (
              <Text component="li" key={item.label} size="sm" lh={1.5}>
                <Badge color={item.completed ? "green" : "yellow"} mr="xs">
                  {item.completed ? t("review.badge.ok") : t("review.badge.todo")}
                </Badge>
                {item.label}
                {!item.completed && item.warning ? ` · ${item.warning}` : ""}
              </Text>
            ))}
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
