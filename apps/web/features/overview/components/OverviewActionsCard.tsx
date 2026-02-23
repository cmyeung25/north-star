import { Button, Card, Stack, Title } from "@mantine/core";
import { useTranslations } from "next-intl";
import { scenarioPeoplePath } from "../../../lib/routes/canonicalRoutes";
import { scenarioMoneyPath, scenarioPath } from "../../../lib/routes/appRoutes";
import { type Locale } from "../../../src/i18n/routing";
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
          href={`${scenarioMoneyPath(caseId, scenarioId)}?tab=timeline`}
        >
          {t("actionsTimeline")}
        </Button>
        <Button
          component={Link}
          href={scenarioPath(caseId, scenarioId, "stress")}
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
