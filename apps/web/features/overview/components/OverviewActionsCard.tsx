import { Button, Card, Stack, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import { scenarioPeoplePath } from "../../../lib/routes/canonicalRoutes";
import { type Locale } from "../../../src/i18n/routing";
import { buildScenarioUrl } from "../../../src/utils/scenarioContext";
import { Link } from "../../../src/i18n/navigation";

interface OverviewActionsCardProps {
  caseId: string;
  locale: Locale;
  scenarioId: string;
}

export default function OverviewActionsCard({ caseId, locale, scenarioId }: OverviewActionsCardProps) {
  const t = useTranslations("overview");
  const peopleHref = scenarioPeoplePath(caseId, scenarioId, locale);

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Title order={4}>{t("actionsTitle")}</Title>
        <Button
          component={Link}
          href={`${buildScenarioUrl("/money", scenarioId)}&tab=timeline`}
        >
          {t("actionsTimeline")}
        </Button>
        <Button
          component={Link}
          href={buildScenarioUrl("/stress", scenarioId)}
          variant="light"
        >
          {t("actionsStress")}
        </Button>
        <Button component={Link} href={peopleHref} variant="subtle">
          {t("actionsSettings")}
        </Button>
      </Stack>
    </Card>
  );
}
