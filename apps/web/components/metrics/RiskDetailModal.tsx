"use client";

import { Badge, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useTranslations } from "next-intl";
import type { RiskAssessment } from "../../src/domain/metrics/risk";
import type { RiskLevel } from "../../features/overview/types";

type RiskDetailModalProps = {
  opened: boolean;
  onClose: () => void;
  assessment: RiskAssessment | null;
  onOpenRunwayDetails?: () => void;
};

const riskColorMap: Record<RiskLevel, string> = {
  Low: "green",
  Medium: "yellow",
  High: "red",
};

export default function RiskDetailModal({
  opened,
  onClose,
  assessment,
  onOpenRunwayDetails,
}: RiskDetailModalProps) {
  const t = useTranslations("overview");
  const common = useTranslations("common");

  return (
    <Modal opened={opened} onClose={onClose} title={t("riskDetailTitle")} centered size="lg">
      <Stack gap="md">
        <Stack gap={4}>
          <Text size="sm">{t("riskDetailDefinition")}</Text>
          <Text size="sm" c="dimmed">
            {t("riskDetailFormula")}
          </Text>
        </Stack>

        <Group gap="xs">
          <Badge
            color={riskColorMap[assessment?.level ?? "Medium"]}
            variant="light"
          >
            {common(`risk${assessment?.level ?? "Medium"}`)}
          </Badge>
          {assessment?.bumpedByDebt ? (
            <Badge color="orange" variant="light">
              {t("riskDetailDebtBump")}
            </Badge>
          ) : null}
        </Group>

        <Stack gap={6}>
          <Text size="sm" fw={600}>
            {t("riskDetailComponentsTitle")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("riskDetailRunway", {
              months:
                assessment?.runwayMonths !== null
                  ? assessment?.runwayMonths ?? 0
                  : "—",
            })}
          </Text>
          <Text size="sm" c="dimmed">
            {t("riskDetailRunwayBuckets")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("riskDetailDebtRatio", {
              ratio:
                assessment?.debtRatio !== null
                  ? `${Math.round((assessment?.debtRatio ?? 0) * 100)}%`
                  : "—",
              threshold: `${Math.round((assessment?.debtRatioThreshold ?? 0) * 100)}%`,
            })}
          </Text>
        </Stack>

        <Stack gap={6}>
          <Text size="sm" fw={600}>
            {t("riskDetailRunwayLinkTitle")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("riskDetailRunwayLinkBody")}
          </Text>
          {onOpenRunwayDetails && (
            <Button size="xs" variant="light" onClick={onOpenRunwayDetails}>
              {t("riskDetailRunwayLinkCta")}
            </Button>
          )}
        </Stack>
      </Stack>
    </Modal>
  );
}
