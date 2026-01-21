import {
  Button,
  Card,
  Group,
  List,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import type {
  OnboardingBudgetRuleDraft,
  OnboardingMemberDraft,
  OnboardingTimelineEventDraft,
} from "../../../domain/onboarding/applyDraft";
import type { OverlapWarning } from "../../../domain/onboarding/overlapDetector";
import { getMemberAgeYears } from "../../../domain/members/age";
import type { useTranslations } from "next-intl";

interface StepReviewConfirmProps {
  members: OnboardingMemberDraft[];
  baseMonth: string;
  budgetRules: OnboardingBudgetRuleDraft[];
  events: OnboardingTimelineEventDraft[];
  incomeMonthlyTotal: number;
  budgetMonthlyTotal: number;
  assetsSummary: string[];
  warnings: OverlapWarning[];
  onDisableBudgetRule: (id: string) => void;
  onRemoveEvent: (id: string) => void;
  onFinish: () => void;
  t: ReturnType<typeof useTranslations>;
}

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function StepReviewConfirm({
  members,
  baseMonth,
  budgetRules,
  events,
  incomeMonthlyTotal,
  budgetMonthlyTotal,
  assetsSummary,
  warnings,
  onDisableBudgetRule,
  onRemoveEvent,
  onFinish,
  t,
}: StepReviewConfirmProps) {
  const budgetRuleLookup = new Map(
    budgetRules.map((rule) => [rule.id, rule])
  );
  const eventLookup = new Map(events.map((event) => [event.id, event]));

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={4}>{t("reviewTitle")}</Title>
        <Text size="sm" c="dimmed">
          {t("reviewDescription")}
        </Text>
      </Stack>

      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Text fw={600}>{t("reviewMembers")}</Text>
          <List spacing="xs">
            {members.map((member) => {
              const age = member.birthMonth
                ? getMemberAgeYears(
                    {
                      id: member.id,
                      name: member.name,
                      kind: member.kind,
                      birthMonth: member.birthMonth,
                      ageAtBaseMonth: member.ageAtBaseMonth,
                    },
                    baseMonth,
                    baseMonth
                  )
                : member.ageAtBaseMonth ?? 0;
              return (
                <List.Item key={member.id}>
                  {member.name} · {t("ageLabel", { age: Math.max(age, 0) })}
                </List.Item>
              );
            })}
          </List>
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Text fw={600}>{t("reviewCashflow")}</Text>
          <Text>{t("reviewIncome", { value: formatCurrency(incomeMonthlyTotal) })}</Text>
          <Text>{t("reviewBudget", { value: formatCurrency(budgetMonthlyTotal) })}</Text>
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Text fw={600}>{t("reviewAssets")}</Text>
          <List spacing="xs">
            {assetsSummary.map((item) => (
              <List.Item key={item}>{item}</List.Item>
            ))}
          </List>
        </Stack>
      </Card>

      <Stack gap="sm">
        <Text fw={600}>{t("reviewWarnings")}</Text>
        {warnings.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("reviewNoWarnings")}
          </Text>
        ) : (
          <Stack gap="sm">
            {warnings.map((warning) => {
              const rule = warning.budgetRuleId
                ? budgetRuleLookup.get(warning.budgetRuleId)
                : null;
              const event = eventLookup.get(warning.eventId);
              return (
                <Card key={warning.id} withBorder radius="md" padding="sm">
                  <Stack gap="xs">
                    <Text size="sm">{t(warning.messageKey)}</Text>
                    <Text size="xs" c="dimmed">
                      {event?.title}
                      {rule ? ` · ${rule.name}` : ""}
                    </Text>
                    <Group justify="flex-end">
                      {rule && (
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => onDisableBudgetRule(rule.id)}
                        >
                          {t("disableBudgetRule")}
                        </Button>
                      )}
                      {event && (
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          onClick={() => onRemoveEvent(event.id)}
                        >
                          {t("removeEvent")}
                        </Button>
                      )}
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </Stack>

      <Group justify="flex-end">
        <Button onClick={onFinish}>{t("confirm")}</Button>
      </Group>
    </Stack>
  );
}
