import { Button, Card, Stack, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { Link } from "../../../src/i18n/navigation";

interface OverviewActionsCardProps {
  scenarioId: string;
}

export default function OverviewActionsCard({ scenarioId }: OverviewActionsCardProps) {
  const t = useTranslations("overview");
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Title order={4}>{t("actionsTitle")}</Title>
        <Button component={Link} href={buildScenarioUrl("/timeline", scenarioId)}>
          {t("actionsTimeline")}
        </Button>
        <Button
          component={Link}
          href={buildScenarioUrl("/stress", scenarioId)}
          variant="light"
        >
          {t("actionsStress")}
        </Button>
        <Button
          component={Link}
          href={buildScenarioUrl("/settings", scenarioId)}
          variant="subtle"
        >
          {t("actionsSettings")}
        </Button>
      </Stack>
    </Card>
  );
}
