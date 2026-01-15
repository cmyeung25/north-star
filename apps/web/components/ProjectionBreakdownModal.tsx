"use client";

import { Modal, ScrollArea, Table, Text } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../lib/i18n";
import type { ProjectionMonthlyRow } from "../src/engine/projectionSelectors";

type ProjectionBreakdownModalProps = {
  opened: boolean;
  onClose: () => void;
  rows: ProjectionMonthlyRow[];
  currency: string;
};

export default function ProjectionBreakdownModal({
  opened,
  onClose,
  rows,
  currency,
}: ProjectionBreakdownModalProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const showAssets = rows.some((row) => typeof row.assetsTotal === "number");
  const showLiabilities = rows.some(
    (row) => typeof row.liabilitiesTotal === "number"
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("breakdownTitle")}
      centered
      size="lg"
    >
      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("breakdownEmpty")}
        </Text>
      ) : (
        <ScrollArea h={360}>
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("breakdownMonth")}</Table.Th>
                <Table.Th>{t("breakdownCash")}</Table.Th>
                {showAssets && <Table.Th>{t("breakdownAssets")}</Table.Th>}
                {showLiabilities && <Table.Th>{t("breakdownLiabilities")}</Table.Th>}
                <Table.Th>{t("breakdownNetWorth")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.month}>
                  <Table.Td>{row.month}</Table.Td>
                  <Table.Td>
                    {formatCurrency(row.cash, currency, locale)}
                  </Table.Td>
                  {showAssets && (
                    <Table.Td>
                      {formatCurrency(row.assetsTotal ?? 0, currency, locale)}
                    </Table.Td>
                  )}
                  {showLiabilities && (
                    <Table.Td>
                      {formatCurrency(row.liabilitiesTotal ?? 0, currency, locale)}
                    </Table.Td>
                  )}
                  <Table.Td>
                    {formatCurrency(row.netWorth, currency, locale)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Modal>
  );
}
