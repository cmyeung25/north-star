"use client";

import { Card, Group, Modal, Stack, Table, Text } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../../lib/i18n";
import CashflowPreviewChart, {
  type CashflowPreviewPoint,
} from "../timeline/CashflowPreviewChart";
import type { PositionCashflowEntry } from "../../src/domain/positions/cashflowBreakdown";

type PositionCashflowModalProps = {
  opened: boolean;
  onClose: () => void;
  title: string;
  currency: string;
  entries: PositionCashflowEntry[];
  series: CashflowPreviewPoint[];
};

export default function PositionCashflowModal({
  opened,
  onClose,
  title,
  currency,
  entries,
  series,
}: PositionCashflowModalProps) {
  const t = useTranslations("timeline");
  const locale = useLocale();
  const rows = [...entries].sort((a, b) => (a.month < b.month ? -1 : 1));
  const showBucketColumn = rows.some((entry) => entry.bucketId || entry.bucketName);

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="xl" centered>
      <Stack gap="md">
        <CashflowPreviewChart series={series} currency={currency} />
        {rows.length === 0 ? (
          <Card withBorder padding="md" radius="md">
            <Text size="sm" c="dimmed">
              {t("positionCashflowEmpty")}
            </Text>
          </Card>
        ) : (
          <Table striped withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("positionCashflowMonth")}</Table.Th>
                <Table.Th>{t("positionCashflowItem")}</Table.Th>
                {showBucketColumn && (
                  <Table.Th>{t("positionCashflowBucket")}</Table.Th>
                )}
                <Table.Th>{t("positionCashflowAmount")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((entry, index) => (
                <Table.Tr key={`${entry.sourceId}-${entry.month}-${index}`}>
                  <Table.Td>{entry.month}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm">{t(`positionCashflowLabels.${entry.label}`)}</Text>
                    </Group>
                  </Table.Td>
                  {showBucketColumn && (
                    <Table.Td>
                      <Text size="sm">
                        {entry.bucketName ?? entry.bucketId ?? t("tablePlaceholder")}
                      </Text>
                    </Table.Td>
                  )}
                  <Table.Td>
                    {formatCurrency(entry.amount, currency, locale)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Modal>
  );
}
