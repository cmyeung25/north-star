"use client";

import { Button, Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import { Link } from "../../src/i18n/navigation";
import { scenarioDashboardPath, scenarioMoneyPath, scenarioPath, scenarioPeoplePath, scenarioSettingsPath } from "../../lib/routes/appRoutes";
import { useScenarioContext } from "../../src/hooks/useScenarioContext";

type MoneyEntryLauncherProps = {
  scenarioId?: string | null;
};

type EntryPath = "/timeline" | "/people" | "/money" | "/overview" | "/dashboard" | "/settings" | "/stress";

export default function MoneyEntryLauncher({ scenarioId }: MoneyEntryLauncherProps) {
  const t = useTranslations("entryLauncher");
  const scenarioContext = useScenarioContext();
  const caseId = scenarioContext?.caseId ?? "";
  const entryHref = (path: EntryPath) => {
    if (!scenarioId || !caseId) return path;
    switch (path) {
      case "/money":
        return scenarioMoneyPath(caseId, scenarioId);
      case "/people":
        return scenarioPeoplePath(caseId, scenarioId);
      case "/settings":
        return scenarioSettingsPath(caseId, scenarioId);
      case "/overview":
      case "/dashboard":
        return scenarioDashboardPath(caseId, scenarioId);
      case "/timeline":
        return `${scenarioMoneyPath(caseId, scenarioId)}?tab=timeline`;
      case "/stress":
        return scenarioPath(caseId, scenarioId, "stress");
    }
  };

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
                <Button
                  component={Link}
                  href={`${entryHref("/money")}?tab=expenses&add=oneOffExpense`}
                  size="xs"
                >
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
                <Button component={Link} href={`${entryHref("/people")}?tab=budget`} size="xs">
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
                  href={`${entryHref("/money")}?tab=assets`}
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
                <Button component={Link} href={`${entryHref("/money")}?tab=timeline`} size="xs">
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
