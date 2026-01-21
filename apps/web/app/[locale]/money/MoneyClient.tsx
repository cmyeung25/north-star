"use client";

import { Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Link } from "../../../src/i18n/navigation";
import {
  getScenarioById,
  resolveScenarioIdFromQuery,
  useScenarioStore,
} from "../../../src/store/scenarioStore";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";

type MoneyClientProps = {
  scenarioId?: string;
};

export default function MoneyClient({ scenarioId }: MoneyClientProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const scenarios = useScenarioStore((state) => state.scenarios);
  const activeScenarioId = useScenarioStore((state) => state.activeScenarioId);
  const resolvedScenarioId = useMemo(
    () => resolveScenarioIdFromQuery(scenarioId ?? null, activeScenarioId, scenarios),
    [activeScenarioId, scenarioId, scenarios]
  );
  const scenario = getScenarioById(scenarios, resolvedScenarioId);
  const scenarioIdValue = scenario?.id;

  const timelineHref = scenarioIdValue
    ? buildScenarioUrl("/timeline", scenarioIdValue)
    : "/timeline";
  const peopleBudgetHref = scenarioIdValue
    ? buildScenarioUrl("/people", scenarioIdValue)
    : "/people";

  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>{t("title")}</Title>
        <Text size="sm" c="dimmed">
          {t("subtitle")}
        </Text>
      </Stack>

      <Card withBorder radius="md" padding="md">
        <Stack gap="xs">
          <Text fw={600}>{t("orderTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("orderHint")}
          </Text>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Card withBorder radius="md" padding="md">
          <Stack gap="xs">
            <Text fw={600}>{t("incomeTitle")}</Text>
            <Text size="sm" c="dimmed">
              {t("incomeDescription")}
            </Text>
            <Group>
              <Button component={Link} href={timelineHref} size="xs">
                {common("openTimeline")}
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="md">
          <Stack gap="xs">
            <Text fw={600}>{t("expensesTitle")}</Text>
            <Text size="sm" c="dimmed">
              {t("expensesDescription")}
            </Text>
            <Group>
              <Button component={Link} href={`${peopleBudgetHref}#budget`} size="xs">
                {t("expensesBudgetCta")}
              </Button>
              <Button component={Link} href={timelineHref} size="xs" variant="light">
                {t("expensesEventsCta")}
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="md">
          <Stack gap="xs">
            <Text fw={600}>{t("assetsTitle")}</Text>
            <Text size="sm" c="dimmed">
              {t("assetsDescription")}
            </Text>
            <Group>
              <Button component={Link} href={timelineHref} size="xs">
                {t("assetsCta")}
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="md">
          <Stack gap="xs">
            <Text fw={600}>{t("liabilitiesTitle")}</Text>
            <Text size="sm" c="dimmed">
              {t("liabilitiesDescription")}
            </Text>
            <Group>
              <Button component={Link} href={timelineHref} size="xs">
                {t("liabilitiesCta")}
              </Button>
            </Group>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
