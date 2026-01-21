"use client";

import { Button, Card, Group, Modal, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import { Link } from "../../src/i18n/navigation";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";

type AddMoneyItemModalProps = {
  opened: boolean;
  onClose: () => void;
  scenarioId?: string | null;
};

const buildHref = (path: string, params: Record<string, string | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
};

export default function AddMoneyItemModal({
  opened,
  onClose,
  scenarioId,
}: AddMoneyItemModalProps) {
  const t = useTranslations("money");
  const scenarioPath = (path: "/money" | "/people") =>
    scenarioId ? buildScenarioUrl(path, scenarioId) : path;

  const timelineHref = buildHref("/money", {
    scenarioId: scenarioId ?? undefined,
    tab: "timeline",
  });

  const budgetHref = buildHref("/people", {
    scenarioId: scenarioId ?? undefined,
    tab: "budget",
  });

  return (
    <Modal opened={opened} onClose={onClose} title={t("addModalTitle")} centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t("addModalSubtitle")}
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Card withBorder radius="md" padding="sm">
            <Stack gap="xs">
              <Title order={5}>{t("addIncomeTitle")}</Title>
              <Text size="sm" c="dimmed">
                {t("addIncomeHint")}
              </Text>
              <Button component={Link} href={timelineHref} size="xs" onClick={onClose}>
                {t("addIncomeCta")}
              </Button>
            </Stack>
          </Card>
          <Card withBorder radius="md" padding="sm">
            <Stack gap="xs">
              <Title order={5}>{t("addExpenseTitle")}</Title>
              <Text size="sm" c="dimmed">
                {t("addExpenseHint")}
              </Text>
              <Group>
                <Button component={Link} href={budgetHref} size="xs" onClick={onClose}>
                  {t("addExpenseRecurringCta")}
                </Button>
                <Button
                  component={Link}
                  href={timelineHref}
                  size="xs"
                  variant="light"
                  onClick={onClose}
                >
                  {t("addExpenseOneOffCta")}
                </Button>
              </Group>
            </Stack>
          </Card>
          <Card withBorder radius="md" padding="sm">
            <Stack gap="xs">
              <Title order={5}>{t("addAssetTitle")}</Title>
              <Text size="sm" c="dimmed">
                {t("addAssetHint")}
              </Text>
              <Button
                component={Link}
                href={buildHref("/money", {
                  scenarioId: scenarioId ?? undefined,
                  tab: "assets",
                })}
                size="xs"
                onClick={onClose}
              >
                {t("addAssetCta")}
              </Button>
            </Stack>
          </Card>
          <Card withBorder radius="md" padding="sm">
            <Stack gap="xs">
              <Title order={5}>{t("addLiabilityTitle")}</Title>
              <Text size="sm" c="dimmed">
                {t("addLiabilityHint")}
              </Text>
              <Button
                component={Link}
                href={buildHref("/money", {
                  scenarioId: scenarioId ?? undefined,
                  tab: "liabilities",
                })}
                size="xs"
                onClick={onClose}
              >
                {t("addLiabilityCta")}
              </Button>
            </Stack>
          </Card>
          <Card withBorder radius="md" padding="sm">
            <Stack gap="xs">
              <Title order={5}>{t("addTimelineTitle")}</Title>
              <Text size="sm" c="dimmed">
                {t("addTimelineHint")}
              </Text>
              <Button component={Link} href={timelineHref} size="xs" onClick={onClose}>
                {t("addTimelineCta")}
              </Button>
            </Stack>
          </Card>
        </SimpleGrid>
        <Button component={Link} href={scenarioPath("/money")} variant="subtle" onClick={onClose}>
          {t("addModalClose")}
        </Button>
      </Stack>
    </Modal>
  );
}
