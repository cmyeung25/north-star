"use client";

import {
  Accordion,
  Badge,
  Button,
  Group,
  Modal,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../lib/i18n";
import type { CashflowItem } from "../src/domain/ledger/types";
import type { LedgerMonthSummary } from "../src/domain/ledger/ledgerUtils";

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
  currency: string;
  memberLookup?: Record<string, string>;
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
  currency,
  memberLookup,
}: ProjectionDetailsModalProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const formatValue = (value: number) => formatCurrency(value, currency, locale);
  const resolvedMonth = currentMonth ?? months[0];
  const monthItems = resolvedMonth ? ledgerByMonth[resolvedMonth] ?? [] : [];
  const positionItems = resolvedMonth
    ? positionCashflowsByMonth?.[resolvedMonth] ?? []
    : [];
  const monthSummary = resolvedMonth
    ? summaryByMonth[resolvedMonth] ?? buildEmptySummary()
    : buildEmptySummary();
  const netCashflow = monthSummary.total;
  const projectionNetCashflow = resolvedMonth
    ? projectionNetCashflowByMonth?.[resolvedMonth]
    : undefined;
  const positionCashflow = positionItems.reduce(
    (total, item) => total + item.amount,
    0
  );
  const doubleCountingWarning = hasDoubleCountingWarning(monthItems);
  const sortedItems = [...monthItems].sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
  );
  const budgetItems = sortedItems.filter((item) => item.source === "budget");
  const eventItems = sortedItems.filter((item) => item.source === "event");
  const otherItems = sortedItems.filter(
    (item) => item.source !== "budget" && item.source !== "event"
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
      label: t("breakdownSectionOther"),
      total: monthSummary.bySource.other,
      items: otherItems,
      hidden: otherItems.length === 0,
    },
    {
      key: "position",
      label: t("breakdownSectionPosition"),
      total: positionCashflow,
      items: positionItems,
      hidden: positionItems.length === 0,
    },
  ];
  const hasItems = monthItems.length > 0 || positionItems.length > 0;
  const defaultAccordionValues = sections
    .filter((section) => !section.hidden && section.items.length > 0)
    .map((section) => section.key);

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

          <Stack gap="xs">
            <SimpleGrid cols={{ base: 1, sm: 5 }}>
              <Stack gap={2}>
                <Text size="xs" c="dimmed">
                  {t("breakdownTotalNet")}
                </Text>
                <Text fw={600}>{formatValue(netCashflow)}</Text>
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
                <Text fw={600}>{formatValue(positionCashflow)}</Text>
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
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {section.items.map((item) => {
                                const baseLabel =
                                  item.source === "position"
                                    ? t(`breakdownPositionLabels.${item.sourceId}`)
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
        </Stack>
      )}
    </Modal>
  );
}
