import {
  Badge,
  Button,
  Card,
  Collapse,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Center,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const translate = useCallback(
    (key: string, fallback: string) => (t.has(key) ? t(key) : fallback),
    [t]
  );

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

  const statusBadge = useMemo(() => {
    if (result.flags.belowZero) {
      return { color: "red", label: t("planLabCashRiskAlert") };
    }
    if (result.flags.belowBuffer) {
      return { color: "yellow", label: t("planLabCashRiskWarning") };
    }
    return { color: "green", label: t("planLabCashRiskHealthy") };
  }, [result.flags.belowBuffer, result.flags.belowZero, t]);

  const minCashAmount = result.minCash?.amount ?? null;
  const shouldDefaultOpen = typeof minCashAmount === "number" && minCashAmount < 0;
  const [detailOpen, setDetailOpen] = useState(shouldDefaultOpen);

  useEffect(() => {
    if (shouldDefaultOpen) {
      setDetailOpen(true);
    }
  }, [shouldDefaultOpen]);

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

  return (
    <Card withBorder radius="xs" padding="xs">
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="wrap">
          <Text fw={600}>{t("planLabCashRiskTitle")}</Text>
          <Badge color={statusBadge.color} variant="light" size="sm">
            {statusBadge.label}
          </Badge>
        </Group>
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="sm" c="dimmed">
            {translate("planLabCashRiskDetailCta", "查看風險明細")}
          </Text>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setDetailOpen((current) => !current)}
          >
            {detailOpen
              ? translate("planLabCashRiskDetailCollapse", "收起")
              : translate("planLabCashRiskDetailExpand", "展開")}
          </Button>
        </Group>
        <Collapse in={detailOpen}>
          <Stack gap="sm">
            <Group align="flex-start" gap="sm">
              {severeFlagContent}
            </Group>
            <Group gap="xs" wrap="wrap">
              <Text size="xs" c="dimmed">
                {t("planLabCashRiskMinimum")}
              </Text>
              <Text size="sm" fw={600}>
                {formatCurrency(result.minCash.amount, baseCurrency, locale)}
              </Text>
              <Text size="xs" c="dimmed">
                {t("planLabCashRiskMonth", { month: result.minCash.month })}
              </Text>
            </Group>
            {result.worst3.length > 0 && (
              <>
                <Text size="sm" fw={600} mt="sm">
                  {t("planLabCashRiskWorst3")}
                </Text>
                <SimpleGrid cols={1} spacing="xs">
                  {result.worst3.map(
                    (entry: typeof result.worst3[0], idx: number) => (
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
                    )
                  )}
                </SimpleGrid>
              </>
            )}
          </Stack>
        </Collapse>
      </Stack>
    </Card>
  );
};
