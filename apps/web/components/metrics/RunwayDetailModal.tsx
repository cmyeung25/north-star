"use client";

import { Badge, Group, Modal, Stack, Table, Text } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../../lib/i18n";
import type { RunwaySimulation } from "../../src/domain/metrics/runway";

type RunwayDetailModalProps = {
  opened: boolean;
  onClose: () => void;
  simulation: RunwaySimulation | null;
  currency: string;
};

export default function RunwayDetailModal({
  opened,
  onClose,
  simulation,
  currency,
}: RunwayDetailModalProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const formatValue = (value: number) => formatCurrency(value, currency, locale);

  return (
    <Modal opened={opened} onClose={onClose} title={t("runwayDetailTitle")} centered size="lg">
      <Stack gap="md">
        <Stack gap={4}>
          <Text size="sm">{t("runwayDetailDefinition")}</Text>
          <Text size="sm" c="dimmed">
            {t("runwayDetailFormula")}
          </Text>
        </Stack>

        {simulation?.months === null ? (
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              {t("runwayDetailUnavailableTitle")}
            </Text>
            <Text size="sm" c="dimmed">
              {t("runwayDetailUnavailableBody")}
            </Text>
          </Stack>
        ) : (
          <>
            <Group gap="xs">
              <Badge color="blue" variant="light">
                {t("runwayDetailStartResources", {
                  value: formatValue(simulation?.startingResources ?? 0),
                })}
              </Badge>
              {simulation?.isCapped ? (
                <Badge color="teal" variant="light">
                  {t("runwayDetailHorizonCap", { months: simulation.horizonMonths })}
                </Badge>
              ) : null}
            </Group>

            <Stack gap={6}>
              <Text size="sm" fw={600}>
                {t("runwayDetailTableTitle")}
              </Text>
              <Table striped withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t("runwayDetailTableMonth")}</Table.Th>
                    <Table.Th>{t("runwayDetailTableStart")}</Table.Th>
                    <Table.Th>{t("runwayDetailTableNet")}</Table.Th>
                    <Table.Th>{t("runwayDetailTableEnd")}</Table.Th>
                    <Table.Th>{t("runwayDetailTableNote")}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {simulation?.trace.map((row) => (
                    <Table.Tr key={row.month}>
                      <Table.Td>{row.month}</Table.Td>
                      <Table.Td>{formatValue(row.startingResources)}</Table.Td>
                      <Table.Td>{formatValue(row.netCashflow)}</Table.Td>
                      <Table.Td>{formatValue(row.endingResources)}</Table.Td>
                      <Table.Td>
                        {row.note === "surplus"
                          ? t("runwayDetailNoteSurplus")
                          : t("runwayDetailNoteBurn")}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </>
        )}

        <Stack gap={4}>
          <Text size="sm" fw={600}>
            {t("runwayDetailAssumptionsTitle")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("runwayDetailAssumptionsLine1")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("runwayDetailAssumptionsLine2")}
          </Text>
          <Text size="sm" c="dimmed">
            {t("runwayDetailAssumptionsLine3")}
          </Text>
        </Stack>
      </Stack>
    </Modal>
  );
}
