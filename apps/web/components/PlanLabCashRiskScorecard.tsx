import {
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Center,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { formatCurrency } from "../lib/i18n";
import type { CashRiskScorecardResult } from "../src/domain/planLab/scorecard/cashRisk";

type PlanLabCashRiskScorecardProps = {
  result: CashRiskScorecardResult;
  baseCurrency: string;
  locale: string;
};

/**
 * Displays the cash risk scorecard for Plan Lab timeline.
 * Shows minimum cash balance with month and worst 3 months.
 * Displays warnings for negative cash or below-buffer conditions.
 */
export const PlanLabCashRiskScorecard = ({
  result,
  baseCurrency,
  locale,
}: PlanLabCashRiskScorecardProps) => {
  const t = useTranslations("overview");

  if (!result.minCash) {
    return (
      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Text fw={600}>{t("planLabCashRiskTitle")}</Text>
          <Text size="sm" c="dimmed">
            {t("planLabCashRiskUnavailable")}
          </Text>
        </Stack>
      </Card>
    );
  }

  const severeFlagContent = result.flags.belowZero ? (
    <>
      <ThemeIcon color="red" variant="light" size="sm" radius="md">
        <Center style={{ width: "100%", height: "100%" }}>⚠</Center>
      </ThemeIcon>
      <Stack gap={4}>
        <Text size="xs" fw={600} c="red">
          {t("planLabCashRiskSevere")}
        </Text>
        <Text size="xs" c="dimmed">
          {t("planLabCashRiskSevereDesc")}
        </Text>
      </Stack>
    </>
  ) : result.flags.belowBuffer ? (
    <>
      <ThemeIcon color="yellow" variant="light" size="sm" radius="md">
        <Center style={{ width: "100%", height: "100%" }}>⚠</Center>
      </ThemeIcon>
      <Stack gap={4}>
        <Text size="xs" fw={600} c="yellow">
          {t("planLabCashRiskWarning")}
        </Text>
        <Text size="xs" c="dimmed">
          {t("planLabCashRiskWarningDesc")}
        </Text>
      </Stack>
    </>
  ) : (
    <>
      <ThemeIcon color="green" variant="light" size="sm" radius="md">
        <Center style={{ width: "100%", height: "100%" }}>✓</Center>
      </ThemeIcon>
      <Stack gap={4}>
        <Text size="xs" fw={600} c="green">
          {t("planLabCashRiskHealthy")}
        </Text>
        <Text size="xs" c="dimmed">
          {t("planLabCashRiskHealthyDesc")}
        </Text>
      </Stack>
    </>
  );

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Text fw={600}>{t("planLabCashRiskTitle")}</Text>

        {/* Minimum cash balance card */}
        <Card
          withBorder
          radius="md"
          padding="sm"
          bg={result.flags.belowZero ? "rgba(255, 0, 0, 0.05)" : undefined}
        >
          <Stack gap="xs">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text size="sm" fw={600}>
                  {t("planLabCashRiskMinimum")}
                </Text>
                <Text size="lg" fw={700}>
                  {formatCurrency(result.minCash.amount, baseCurrency, locale)}
                </Text>
              </Stack>
              {result.flags.belowZero && (
                <Badge color="red" variant="light" size="sm">
                  {t("planLabCashRiskAlert")}
                </Badge>
              )}
            </Group>
            <Text size="sm" c="dimmed">
              {t("planLabCashRiskMonth", { month: result.minCash.month })}
            </Text>
          </Stack>
        </Card>

        {/* Warning/status indicator */}
        <Group align="flex-start" gap="sm">
          {severeFlagContent}
        </Group>

        {/* Worst 3 months */}
        {result.worst3.length > 0 && (
          <>
            <Text size="sm" fw={600} mt="sm">
              {t("planLabCashRiskWorst3")}
            </Text>
            <SimpleGrid cols={1} spacing="xs">
              {result.worst3.map((entry: typeof result.worst3[0], idx: number) => (
                <Card
                  key={`${entry.month}-${idx}`}
                  withBorder
                  radius="md"
                  padding="xs"
                  bg={entry.amount < 0 ? "rgba(255, 0, 0, 0.03)" : undefined}
                >
                  <Group justify="space-between" align="center">
                    <Text size="sm">{entry.month}</Text>
                    <Text
                      size="sm"
                      fw={600}
                      c={entry.amount < 0 ? "red" : "dimmed"}
                    >
                      {formatCurrency(entry.amount, baseCurrency, locale)}
                    </Text>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          </>
        )}
      </Stack>
    </Card>
  );
};
