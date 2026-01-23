"use client";

import {
  Accordion,
  Badge,
  Button,
  Group,
  Modal,
  Notification,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../lib/i18n";
import type { CashflowItem } from "../src/domain/ledger/types";
import type { LedgerMonthSummary } from "../src/domain/ledger/ledgerUtils";
import type { NetWorthBreakdown } from "../src/domain/netWorth/buildNetWorthBreakdown";
import { useJumpToSource } from "../src/hooks/useJumpToSource";
import { isInvestmentCashflow } from "../src/domain/ledger/cashflowFilters";

type ProjectionDetailsModalProps = {
  opened: boolean;
  onClose: () => void;
  months: string[];
  currentMonth?: string;
  onMonthChange: (value: string) => void;
  ledgerByMonth: Record<string, CashflowItem[]>;
  summaryByMonth: Record<string, LedgerMonthSummary>;
  positionCashflowsByMonth?: Record<string, CashflowItem[]>;
  projectionNetCashflowByMonth?: Record<string, number>;
  projectionNetCashflowMode?: "netCashflow" | "cashDelta";
  netWorthByMonth?: Record<string, number>;
  netWorthBreakdownByMonth?: Record<string, NetWorthBreakdown>;
  currency: string;
  memberLookup?: Record<string, string>;
  initialTab?: "cashflow" | "netWorth";
};

const buildEmptySummary = (): LedgerMonthSummary => ({
  total: 0,
  bySource: {
    budget: 0,
    event: 0,
    other: 0,
  },
  byCategory: {},
});

const normalizeKey = (value?: string) =>
  value ? value.toLowerCase().replace(/\s+/g, " ").trim() : "";

const hasDoubleCountingWarning = (items: CashflowItem[]) => {
  const budgetItems = items.filter((item) => item.source === "budget");
  const eventItems = items.filter((item) => item.source === "event");
  if (budgetItems.length === 0 || eventItems.length === 0) {
    return false;
  }

  const budgetKeys = new Set<string>();
  const eventKeys = new Set<string>();

  budgetItems.forEach((item) => {
    const categoryKey = normalizeKey(item.category);
    const labelKey = normalizeKey(item.label);
    if (categoryKey) {
      budgetKeys.add(categoryKey);
    }
    if (labelKey) {
      budgetKeys.add(labelKey);
    }
  });

  eventItems.forEach((item) => {
    const categoryKey = normalizeKey(item.category);
    const labelKey = normalizeKey(item.label);
    if (categoryKey) {
      eventKeys.add(categoryKey);
    }
    if (labelKey) {
      eventKeys.add(labelKey);
    }
  });

  return Array.from(budgetKeys).some((key) => eventKeys.has(key));
};

export default function ProjectionDetailsModal({
  opened,
  onClose,
  months,
  currentMonth,
  onMonthChange,
  ledgerByMonth,
  summaryByMonth,
  positionCashflowsByMonth,
  projectionNetCashflowByMonth,
  projectionNetCashflowMode = "netCashflow",
  netWorthByMonth,
  netWorthBreakdownByMonth,
  currency,
  memberLookup,
  initialTab = "cashflow",
}: ProjectionDetailsModalProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const formatValue = (value: number) => formatCurrency(value, currency, locale);
  const [activeTab, setActiveTab] = useState<"cashflow" | "netWorth">(initialTab);

  useEffect(() => {
    if (opened) {
      setActiveTab(initialTab);
    }
  }, [initialTab, opened]);
  const resolvedMonth = currentMonth ?? months[0];
  const monthItems = resolvedMonth ? ledgerByMonth[resolvedMonth] ?? [] : [];
  const positionItems = resolvedMonth
    ? positionCashflowsByMonth?.[resolvedMonth] ?? []
    : [];
  const monthSummary = resolvedMonth
    ? summaryByMonth[resolvedMonth] ?? buildEmptySummary()
    : buildEmptySummary();
  const netCashflow = monthSummary.total;
  const operationalNetCashflow = monthItems.reduce(
    (total, item) => (isInvestmentCashflow(item) ? total : total + item.amount),
    0
  );
  const projectionNetCashflow = resolvedMonth
    ? projectionNetCashflowByMonth?.[resolvedMonth]
    : undefined;
  const netWorthBreakdown = resolvedMonth
    ? netWorthBreakdownByMonth?.[resolvedMonth]
    : undefined;
  const doubleCountingWarning = hasDoubleCountingWarning(monthItems);
  const sortedItems = [...monthItems].sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
  );
  const { jumpToSource, toast, clearToast } = useJumpToSource();
  const budgetItems = sortedItems.filter((item) => item.source === "budget");
  const eventItems = sortedItems.filter((item) => item.source === "event");
  const otherItems = sortedItems.filter(
    (item) => item.source !== "budget" && item.source !== "event"
  );
  const otherItemsAreSmartInvest =
    otherItems.length > 0 && otherItems.every((item) => item.source === "smartInvest");
  const positionItemsAreInvestments =
    positionItems.length > 0 &&
    positionItems.every((item) => item.sourceId?.startsWith("investment:"));
  const shouldMergeSmartInvest =
    otherItemsAreSmartInvest && positionItemsAreInvestments;
  const mergedPositionItems = shouldMergeSmartInvest
    ? [...positionItems, ...otherItems]
    : positionItems;
  const mergedPositionTotal = mergedPositionItems.reduce(
    (total, item) => total + item.amount,
    0
  );
  const sections = [
    {
      key: "budget",
      label: t("breakdownSectionBudget"),
      total: monthSummary.bySource.budget,
      items: budgetItems,
    },
    {
      key: "event",
      label: t("breakdownSectionEvents"),
      total: monthSummary.bySource.event,
      items: eventItems,
    },
    {
      key: "other",
      label: otherItemsAreSmartInvest
        ? t("breakdownSectionSmartInvest")
        : t("breakdownSectionOther"),
      total: monthSummary.bySource.other,
      items: otherItems,
      hidden: otherItems.length === 0 || shouldMergeSmartInvest,
    },
    {
      key: "position",
      label: t("breakdownSectionPosition"),
      total: mergedPositionTotal,
      items: mergedPositionItems,
      hidden: mergedPositionItems.length === 0,
    },
  ];
  const hasItems = monthItems.length > 0 || positionItems.length > 0;
  const defaultAccordionValues = sections
    .filter((section) => !section.hidden && section.items.length > 0)
    .map((section) => section.key);
  const netWorthItems = netWorthBreakdown?.items ?? [];
  const assetItems = netWorthItems.filter((item) => item.kind === "asset");
  const liabilityItems = netWorthItems.filter((item) => item.kind === "liability");
  const formatPct = (value: number) => `${value.toFixed(1)}%`;
  const labeledAssetItems = (() => {
    const counters = { home: 0, car: 0, investment: 0, insurance: 0 };
    return assetItems.map((item) => {
      if (item.key === "cash") {
        return { ...item, label: t("breakdownLabels.cash") };
      }
      if (item.key.startsWith("home:")) {
        counters.home += 1;
        return {
          ...item,
          label: t("breakdownLabels.home", { index: counters.home }),
        };
      }
      if (item.key.startsWith("car:")) {
        counters.car += 1;
        return {
          ...item,
          label: t("breakdownLabels.car", { index: counters.car }),
        };
      }
      if (item.key.startsWith("investment:")) {
        counters.investment += 1;
        return {
          ...item,
          label: t("breakdownLabels.investment", { index: counters.investment }),
        };
      }
      if (item.key.startsWith("insurance:")) {
        counters.insurance += 1;
        return {
          ...item,
          label: t("breakdownLabels.insurance", { index: counters.insurance }),
        };
      }
      return { ...item, label: item.key };
    });
  })();

  const labeledLiabilityItems = liabilityItems.map((item) => {
    if (item.key.startsWith("home:") && item.key.includes(":mortgage")) {
      return { ...item, label: t("breakdownLabels.mortgage") };
    }
    if (item.key.startsWith("car:") && item.key.includes(":loan")) {
      return { ...item, label: t("breakdownLabels.autoLoan") };
    }
    if (item.key.startsWith("loan:")) {
      return { ...item, label: t("breakdownLabels.loan") };
    }
    return { ...item, label: item.key };
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("breakdownTitle")}
      centered
      size="xl"
    >
      {!resolvedMonth ? (
        <Text size="sm" c="dimmed">
          {t("breakdownEmpty")}
        </Text>
      ) : (
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs">
              <Button
                variant="subtle"
                size="xs"
                onClick={() => {
                  const currentIndex = months.indexOf(resolvedMonth);
                  const previousMonth = months[currentIndex - 1];
                  if (previousMonth) {
                    onMonthChange(previousMonth);
                  }
                }}
                disabled={months.indexOf(resolvedMonth) <= 0}
              >
                {t("breakdownPrevMonth")}
              </Button>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => {
                  const currentIndex = months.indexOf(resolvedMonth);
                  const nextMonth = months[currentIndex + 1];
                  if (nextMonth) {
                    onMonthChange(nextMonth);
                  }
                }}
                disabled={months.indexOf(resolvedMonth) >= months.length - 1}
              >
                {t("breakdownNextMonth")}
              </Button>
            </Group>
            <Select
              data={months.map((month) => ({ value: month, label: month }))}
              value={resolvedMonth}
              onChange={(value) => {
                if (value) {
                  onMonthChange(value);
                }
              }}
              label={t("breakdownMonthLabel")}
              maw={200}
            />
          </Group>

          <Tabs
            value={activeTab}
            onChange={(value) => setActiveTab(value as "cashflow" | "netWorth")}
          >
            <Tabs.List>
              <Tabs.Tab value="cashflow">{t("breakdownTabCashflow")}</Tabs.Tab>
              <Tabs.Tab value="netWorth">{t("breakdownTabNetWorth")}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="cashflow" pt="md">
              {toast && (
                <Notification color={toast.color} onClose={clearToast}>
                  {toast.message}
                </Notification>
              )}
              <Stack gap="xs">
                <SimpleGrid cols={{ base: 1, sm: 6 }}>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t("breakdownTotalNet")}
                    </Text>
                    <Text fw={600}>{formatValue(netCashflow)}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t("breakdownOperationalNet")}
                    </Text>
                    <Text fw={600}>{formatValue(operationalNetCashflow)}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t("breakdownBudgetTotal")}
                    </Text>
                    <Text fw={600}>{formatValue(monthSummary.bySource.budget)}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t("breakdownEventTotal")}
                    </Text>
                    <Text fw={600}>{formatValue(monthSummary.bySource.event)}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t("breakdownPositionTotal")}
                    </Text>
                    <Text fw={600}>{formatValue(mergedPositionTotal)}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      {t("breakdownNetWorth")}
                    </Text>
                    <Text fw={600}>
                      {formatValue(netWorthByMonth?.[resolvedMonth] ?? 0)}
                    </Text>
                  </Stack>
                </SimpleGrid>
                {projectionNetCashflow !== undefined && (
                  <Text size="xs" c="dimmed">
                    {projectionNetCashflowMode === "cashDelta"
                      ? t("breakdownProjectionNetChange")
                      : t("breakdownProjectionNetFlow")}
                    {" "}
                    {formatValue(projectionNetCashflow)}
                  </Text>
                )}
                {doubleCountingWarning && (
                  <Badge color="yellow" variant="light">
                    {t("breakdownDoubleCounting")}
                  </Badge>
                )}
              </Stack>

              {!hasItems ? (
                <Text size="sm" c="dimmed">
                  {t("breakdownEmptyMonth")}
                </Text>
              ) : (
                <ScrollArea h={360}>
                  <Accordion
                    variant="separated"
                    chevronPosition="right"
                    multiple
                    defaultValue={defaultAccordionValues}
                  >
                    {sections
                      .filter((section) => !section.hidden)
                      .map((section) => (
                        <Accordion.Item key={section.key} value={section.key}>
                          <Accordion.Control>
                            <Group justify="space-between" wrap="nowrap">
                              <Text fw={600}>{section.label}</Text>
                              <Text size="sm">{formatValue(section.total)}</Text>
                            </Group>
                          </Accordion.Control>
                          <Accordion.Panel>
                            {section.items.length === 0 ? (
                              <Text size="sm" c="dimmed">
                                {t("breakdownNoItems")}
                              </Text>
                            ) : (
                              <Table striped withTableBorder>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>{t("breakdownItem")}</Table.Th>
                                    <Table.Th>{t("breakdownAmount")}</Table.Th>
                                    <Table.Th>{t("breakdownActions")}</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {section.items.map((item) => {
                                    const baseLabel =
                                      item.source === "position"
                                        ? t(
                                            `breakdownPositionLabels.${item.sourceId}`
                                          )
                                        : item.label ?? item.category ?? item.sourceId;
                                    const memberName = item.memberId
                                      ? memberLookup?.[item.memberId]
                                      : null;
                                    const label = memberName
                                      ? `${baseLabel} (${memberName})`
                                      : baseLabel;
                                    return (
                                      <Table.Tr
                                        key={`${section.key}-${item.sourceId}-${item.month}-${item.amount}`}
                                      >
                                        <Table.Td>{label}</Table.Td>
                                        <Table.Td>
                                          <Text
                                            c={item.amount < 0 ? "red" : "green"}
                                            fw={500}
                                          >
                                            {formatValue(item.amount)}
                                          </Text>
                                        </Table.Td>
                                        <Table.Td>
                                          <Button
                                            size="xs"
                                            variant="subtle"
                                            onClick={() => jumpToSource(item)}
                                          >
                                            {t("breakdownEditSource")}
                                          </Button>
                                        </Table.Td>
                                      </Table.Tr>
                                    );
                                  })}
                                </Table.Tbody>
                              </Table>
                            )}
                          </Accordion.Panel>
                        </Accordion.Item>
                      ))}
                  </Accordion>
                </ScrollArea>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="netWorth" pt="md">
              {!netWorthBreakdown ? (
                <Text size="sm" c="dimmed">
                  {t("breakdownNetWorthEmpty")}
                </Text>
              ) : (
                <Stack gap="md">
                  <SimpleGrid cols={{ base: 1, sm: 4 }}>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">
                        {t("breakdownNetWorthCash")}
                      </Text>
                      <Text fw={600}>{formatValue(netWorthBreakdown.cash)}</Text>
                    </Stack>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">
                        {t("breakdownNetWorthAssets")}
                      </Text>
                      <Text fw={600}>
                        {formatValue(netWorthBreakdown.assetsTotal)}
                      </Text>
                    </Stack>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">
                        {t("breakdownNetWorthLiabilities")}
                      </Text>
                      <Text fw={600}>
                        {formatValue(netWorthBreakdown.liabilitiesTotal)}
                      </Text>
                    </Stack>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">
                        {t("breakdownNetWorthNet")}
                      </Text>
                      <Text fw={600}>{formatValue(netWorthBreakdown.netWorth)}</Text>
                    </Stack>
                  </SimpleGrid>

                  <Stack gap="xs">
                    <Text fw={600}>{t("breakdownNetWorthAllocation")}</Text>
                    <Table striped withTableBorder>
                      <Table.Tbody>
                        <Table.Tr>
                          <Table.Td>{t("breakdownNetWorthCash")}</Table.Td>
                          <Table.Td>{formatPct(netWorthBreakdown.allocation.cashPct)}</Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>{t("breakdownNetWorthHousing")}</Table.Td>
                          <Table.Td>
                            {formatPct(netWorthBreakdown.allocation.housingPct)}
                          </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>{t("breakdownNetWorthInvestments")}</Table.Td>
                          <Table.Td>
                            {formatPct(netWorthBreakdown.allocation.investmentsPct)}
                          </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>{t("breakdownNetWorthCars")}</Table.Td>
                          <Table.Td>
                            {formatPct(netWorthBreakdown.allocation.carsPct)}
                          </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                          <Table.Td>{t("breakdownNetWorthInsurance")}</Table.Td>
                          <Table.Td>
                            {formatPct(netWorthBreakdown.allocation.insurancePct)}
                          </Table.Td>
                        </Table.Tr>
                      </Table.Tbody>
                    </Table>
                  </Stack>

                  <Stack gap="xs">
                    <Text fw={600}>{t("breakdownNetWorthAssets")}</Text>
                    {labeledAssetItems.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        {t("breakdownNoItems")}
                      </Text>
                    ) : (
                      <Table striped withTableBorder>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>{t("breakdownItem")}</Table.Th>
                            <Table.Th>{t("breakdownAmount")}</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {labeledAssetItems.map((item) => (
                            <Table.Tr key={`${item.key}-${item.amount}`}>
                              <Table.Td>{item.label}</Table.Td>
                              <Table.Td>{formatValue(item.amount)}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    )}
                  </Stack>

                  <Stack gap="xs">
                    <Text fw={600}>{t("breakdownNetWorthLiabilities")}</Text>
                    {labeledLiabilityItems.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        {t("breakdownNoItems")}
                      </Text>
                    ) : (
                      <Table striped withTableBorder>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>{t("breakdownItem")}</Table.Th>
                            <Table.Th>{t("breakdownAmount")}</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {labeledLiabilityItems.map((item) => (
                            <Table.Tr key={`${item.key}-${item.amount}`}>
                              <Table.Td>{item.label}</Table.Td>
                              <Table.Td>{formatValue(item.amount)}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    )}
                  </Stack>
                </Stack>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Modal>
  );
}
