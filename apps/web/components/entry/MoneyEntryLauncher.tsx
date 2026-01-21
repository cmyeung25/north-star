"use client";

import { Button, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { Link } from "../../src/i18n/navigation";
import { buildScenarioUrl } from "../../src/utils/scenarioContext";

type MoneyEntryLauncherProps = {
  scenarioId?: string | null;
};

type EntryPath = "/timeline" | "/people" | "/money" | "/overview" | "/settings" | "/stress";

export default function MoneyEntryLauncher({ scenarioId }: MoneyEntryLauncherProps) {
  const t = useTranslations("entryLauncher");
  const entryHref = (path: EntryPath) =>
    scenarioId ? buildScenarioUrl(path, scenarioId) : path;

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Stack gap={4}>
          <Text fw={600}>{t("title")}</Text>
          <Text size="sm" c="dimmed">
            {t("subtitle")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("sequenceHint")}
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Card withBorder radius="md" padding="sm">
            <Stack gap="xs">
              <Text fw={600}>{t("addIncome")}</Text>
              <Text size="sm" c="dimmed">
                {t("addIncomeHint")}
              </Text>
              <Group>
                <Button component={Link} href={`${entryHref("/timeline")}?tab=events`} size="xs">
                  {t("openEvents")}
                </Button>
              </Group>
            </Stack>
          </Card>
          <Card withBorder radius="md" padding="sm">
            <Stack gap="xs">
              <Text fw={600}>{t("addExpense")}</Text>
              <Text size="sm" c="dimmed">
                {t("addExpenseHint")}
              </Text>
              <Group>
                <Button component={Link} href={`${entryHref("/people")}#budget`} size="xs">
                  {t("openBudgetRules")}
                </Button>
              </Group>
            </Stack>
          </Card>
          <Card withBorder radius="md" padding="sm">
            <Stack gap="xs">
              <Text fw={600}>{t("addAsset")}</Text>
              <Text size="sm" c="dimmed">
                {t("addAssetHint")}
              </Text>
              <Group>
                <Button
                  component={Link}
                  href={`${entryHref("/timeline")}?tab=positions`}
                  size="xs"
                >
                  {t("openPositions")}
                </Button>
              </Group>
            </Stack>
          </Card>
          <Card withBorder radius="md" padding="sm">
            <Stack gap="xs">
              <Text fw={600}>{t("addEvent")}</Text>
              <Text size="sm" c="dimmed">
                {t("addEventHint")}
              </Text>
              <Group>
                <Button component={Link} href={`${entryHref("/timeline")}?tab=events`} size="xs">
                  {t("openEvents")}
                </Button>
              </Group>
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
