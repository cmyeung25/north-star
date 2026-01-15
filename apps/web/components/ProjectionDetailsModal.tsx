"use client";

import {
  Accordion,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
} from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../lib/i18n";
import type {
  AssetBreakdownRow,
  CashflowBreakdownRow,
} from "../src/engine/projectionSelectors";

type ProjectionDetailsModalProps = {
  opened: boolean;
  onClose: () => void;
  cashflowRows: CashflowBreakdownRow[];
  assetRows: AssetBreakdownRow[];
  currency: string;
};

export default function ProjectionDetailsModal({
  opened,
  onClose,
  cashflowRows,
  assetRows,
  currency,
}: ProjectionDetailsModalProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const hasRows = cashflowRows.length > 0 || assetRows.length > 0;

  const formatValue = (value: number) => formatCurrency(value, currency, locale);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("breakdownTitle")}
      centered
      size="xl"
    >
      {!hasRows ? (
        <Text size="sm" c="dimmed">
          {t("breakdownEmpty")}
        </Text>
      ) : (
        <Tabs defaultValue="cashflow">
          <Tabs.List>
            <Tabs.Tab value="cashflow">{t("breakdownTabs.cashflow")}</Tabs.Tab>
            <Tabs.Tab value="assets">{t("breakdownTabs.assets")}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="cashflow" pt="sm">
            <ScrollArea h={360}>
              <Accordion variant="separated" chevronPosition="right">
                {cashflowRows.map((row) => (
                  <Accordion.Item key={row.month} value={row.month}>
                    <Accordion.Control>
                      <Group justify="space-between" wrap="nowrap">
                        <Text fw={600}>{row.month}</Text>
                        <Group gap="md" wrap="nowrap">
                          <Text size="sm">
                            {t("breakdownNet")}: {formatValue(row.net)}
                          </Text>
                          <Text size="sm">
                            {t("breakdownInflow")}: {formatValue(row.inflow)}
                          </Text>
                          <Text size="sm">
                            {t("breakdownOutflow")}: {formatValue(row.outflow)}
                          </Text>
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      {row.items.length === 0 ? (
                        <Text size="sm" c="dimmed">
                          {t("breakdownNoItems")}
                        </Text>
                      ) : (
                        <ScrollArea h={240}>
                          <Table striped withTableBorder>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>{t("breakdownItem")}</Table.Th>
                                <Table.Th>{t("breakdownAmount")}</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {row.items.map((item) => (
                                <Table.Tr key={item.key}>
                                  <Table.Td>{item.label}</Table.Td>
                                  <Table.Td>{formatValue(item.value)}</Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        </ScrollArea>
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="assets" pt="sm">
            <ScrollArea h={360}>
              <Accordion variant="separated" chevronPosition="right">
                {assetRows.map((row) => (
                  <Accordion.Item key={row.month} value={row.month}>
                    <Accordion.Control>
                      <Group justify="space-between" wrap="nowrap">
                        <Text fw={600}>{row.month}</Text>
                        <Group gap="md" wrap="nowrap">
                          <Text size="sm">
                            {t("breakdownCash")}: {formatValue(row.cash)}
                          </Text>
                          <Text size="sm">
                            {t("breakdownAssets")}: {formatValue(row.assetsTotal)}
                          </Text>
                          <Text size="sm">
                            {t("breakdownLiabilities")}:
                            {" "}
                            {formatValue(row.liabilitiesTotal)}
                          </Text>
                          <Text size="sm">
                            {t("breakdownNetWorth")}: {formatValue(row.netWorth)}
                          </Text>
                        </Group>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <div>
                          <Text fw={600} size="sm">
                            {t("breakdownAssets")}
                          </Text>
                          {row.assets.length === 0 ? (
                            <Text size="sm" c="dimmed">
                              {t("breakdownNoItems")}
                            </Text>
                          ) : (
                            <ScrollArea h={200}>
                              <Table striped withTableBorder>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>{t("breakdownItem")}</Table.Th>
                                    <Table.Th>{t("breakdownAmount")}</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {row.assets.map((item) => (
                                    <Table.Tr key={item.key}>
                                      <Table.Td>{item.label}</Table.Td>
                                      <Table.Td>{formatValue(item.value)}</Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            </ScrollArea>
                          )}
                        </div>
                        <div>
                          <Text fw={600} size="sm">
                            {t("breakdownLiabilities")}
                          </Text>
                          {row.liabilities.length === 0 ? (
                            <Text size="sm" c="dimmed">
                              {t("breakdownNoItems")}
                            </Text>
                          ) : (
                            <ScrollArea h={200}>
                              <Table striped withTableBorder>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>{t("breakdownItem")}</Table.Th>
                                    <Table.Th>{t("breakdownAmount")}</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {row.liabilities.map((item) => (
                                    <Table.Tr key={item.key}>
                                      <Table.Td>{item.label}</Table.Td>
                                      <Table.Td>{formatValue(item.value)}</Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            </ScrollArea>
                          )}
                        </div>
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </ScrollArea>
          </Tabs.Panel>
        </Tabs>
      )}
    </Modal>
  );
}
