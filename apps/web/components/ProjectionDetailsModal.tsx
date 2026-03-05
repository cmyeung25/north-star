"use client";

import {
  Accordion,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  NativeScrollArea,
  Notification,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../lib/i18n";
import type { CashflowItem } from "../src/domain/ledger/types";
import type { LedgerMonthSummary } from "../src/domain/ledger/ledgerUtils";
import type { NetWorthBreakdown } from "../src/domain/netWorth/buildNetWorthBreakdown";
import { getMonthlyHighlights } from "../src/domain/timeline/getMonthlyHighlights";
import type { MilestoneEvent } from "../src/domain/milestoneEvents/types";
import type { ScenarioEventView } from "../src/domain/events/types";
import { useJumpToSource } from "../src/hooks/useJumpToSource";
import { isInvestmentCashflow } from "../src/domain/ledger/cashflowFilters";
import { resolveMonthInList } from "../src/utils/month";
import type { ScenarioMember } from "../src/store/scenarioStore";

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
  scenarioId?: string;
  baseMonth?: string | null;
  horizonMonths?: number;
  members?: ScenarioMember[];
  milestoneEvents?: MilestoneEvent[];
  eventViews?: ScenarioEventView[];
  isScenarioV2?: boolean;
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

const formatDelta = (value: number | null | undefined, formatter: (value: number) => string) => {
  if (value === null || value === undefined) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatter(value)}`;
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
  scenarioId,
  baseMonth,
  horizonMonths,
  members,
  milestoneEvents,
  eventViews,
  isScenarioV2 = false,
}: ProjectionDetailsModalProps) {
  const t = useTranslations("overview");
  const locale = useLocale();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const formatValue = (value: number) => formatCurrency(value, currency, locale);
  const resolvedMonth = resolveMonthInList(months, currentMonth);
  const { jumpToSource, toast, clearToast } = useJumpToSource();

  const monthIndex = resolvedMonth ? months.indexOf(resolvedMonth) : -1;
  const prevMonth = monthIndex > 0 ? months[monthIndex - 1] : undefined;

  const monthItems = resolvedMonth ? ledgerByMonth[resolvedMonth] ?? [] : [];
  const prevMonthItems = prevMonth ? ledgerByMonth[prevMonth] ?? [] : [];
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
  const prevNetWorthBreakdown = prevMonth
    ? netWorthBreakdownByMonth?.[prevMonth]
    : undefined;
  const currentNetWorth = resolvedMonth ? netWorthByMonth?.[resolvedMonth] : undefined;
  const previousNetWorth = prevMonth ? netWorthByMonth?.[prevMonth] : undefined;

  const totalIncome = [...monthItems, ...positionItems]
    .filter((item) => item.amount > 0)
    .reduce((total, item) => total + item.amount, 0);
  const totalExpense = Math.abs(
    [...monthItems, ...positionItems]
      .filter((item) => item.amount < 0)
      .reduce((total, item) => total + item.amount, 0)
  );
  const prevExpense = Math.abs(
    prevMonthItems.filter((item) => item.amount < 0).reduce((total, item) => total + item.amount, 0)
  );

  const endingCash = netWorthBreakdown?.cash;
  const momDeltaCash =
    endingCash !== undefined && prevNetWorthBreakdown?.cash !== undefined
      ? endingCash - prevNetWorthBreakdown.cash
      : null;
  const momDeltaNetWorth =
    currentNetWorth !== undefined && previousNetWorth !== undefined
      ? currentNetWorth - previousNetWorth
      : null;
  const residualNetWorth =
    momDeltaNetWorth !== null ? momDeltaNetWorth - netCashflow : null;

  const doubleCountingWarning = !isScenarioV2 && hasDoubleCountingWarning(monthItems);
  const sortedItems = [...monthItems].sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
  );
  const budgetItems = isScenarioV2
    ? []
    : sortedItems.filter((item) => item.source === "budget");
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
    ...(!isScenarioV2
      ? [
          {
            key: "budget",
            label: t("breakdownSectionBudget"),
            total: monthSummary.bySource.budget,
            items: budgetItems,
          },
        ]
      : []),
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

  const topMovers = useMemo(() => {
    if (!netWorthBreakdown || !prevNetWorthBreakdown) {
      return [] as Array<{ key: string; delta: number }>;
    }
    const previousByKey = new Map(prevNetWorthBreakdown.items.map((item) => [item.key, item.amount]));
    return netWorthBreakdown.items
      .map((item) => ({ key: item.key, delta: item.amount - (previousByKey.get(item.key) ?? 0) }))
      .filter((item) => item.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);
  }, [netWorthBreakdown, prevNetWorthBreakdown]);

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

  const highlights = useMemo(() => {
    if (!scenarioId || !members || !eventViews || !resolvedMonth) {
      return { milestones: [], events: [] };
    }
    return getMonthlyHighlights({
      scenarioId,
      baseMonth,
      horizonMonths,
      members,
      milestoneEvents,
      eventViews,
      targetMonth: resolvedMonth,
    });
  }, [baseMonth, eventViews, horizonMonths, members, milestoneEvents, resolvedMonth, scenarioId]);

  const hasHighlights =
    highlights.milestones.length > 0 || highlights.events.length > 0;

  const renderHighlightLabel = (label: string, memberName?: string) =>
    memberName ? `${memberName} · ${label}` : label;

  const expenseIncreasePct =
    prevExpense > 0 ? ((totalExpense - prevExpense) / prevExpense) * 100 : null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("breakdownTitle")}
      size={isMobile ? "100%" : 1120}
      fullScreen={Boolean(isMobile)}
      scrollAreaComponent={NativeScrollArea}
      styles={{
        content: {
          overflow: "hidden",
          maxHeight: "100dvh",
        },
        body: {
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        },
      }}
    >
      {!resolvedMonth ? (
        <Text size="sm" c="dimmed">
          {t("breakdownEmpty")}
        </Text>
      ) : (
        <Box
          style={{
            display: "flex",
            flexDirection: "column",
            height: isMobile ? "100%" : "85vh",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <Box pb="xs">
            <Group justify="space-between" align="end" wrap="wrap">
              <Group gap="xs">
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    if (prevMonth) {
                      onMonthChange(prevMonth);
                    }
                  }}
                  disabled={!prevMonth}
                >
                  {t("breakdownPrevMonth")}
                </Button>
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    const nextMonth = monthIndex >= 0 ? months[monthIndex + 1] : undefined;
                    if (nextMonth) {
                      onMonthChange(nextMonth);
                    }
                  }}
                  disabled={!resolvedMonth || monthIndex >= months.length - 1}
                >
                  {t("breakdownNextMonth")}
                </Button>
              </Group>
              <Select
                data={months.map((month) => ({ value: month, label: month }))}
                value={resolvedMonth ?? null}
                onChange={(value) => {
                  if (value) {
                    onMonthChange(value);
                  }
                }}
                label={t("breakdownMonthLabel")}
                maw={220}
              />
            </Group>
            <Text size="xs" c="dimmed" mt={6}>
              {t("breakdownSummaryDelta", {
                netWorth: formatDelta(momDeltaNetWorth, formatValue),
                cash: formatDelta(momDeltaCash, formatValue),
              })}
            </Text>
            <Divider mt="xs" />
          </Box>

          <Box
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              touchAction: "pan-y",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            }}
          >
            <Stack gap="md" pt="md" pr="xs">
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="xs" verticalSpacing="xs">
            <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownEndingCash")}</Text><Text fw={600}>{endingCash !== undefined ? formatValue(endingCash) : "—"}</Text></Stack>
            <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownTotalNet")}</Text><Text fw={600}>{formatValue(netCashflow)}</Text></Stack>
            <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownInflow")}</Text><Text fw={600}>{formatValue(totalIncome)}</Text></Stack>
            <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownOutflow")}</Text><Text fw={600}>{formatValue(totalExpense)}</Text></Stack>
            <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownNetWorth")}</Text><Text fw={600}>{currentNetWorth !== undefined ? formatValue(currentNetWorth) : "—"}</Text></Stack>
            <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownAssets")}</Text><Text fw={600}>{netWorthBreakdown ? formatValue(netWorthBreakdown.assetsTotal) : "—"}</Text></Stack>
            <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownLiabilities")}</Text><Text fw={600}>{netWorthBreakdown ? formatValue(netWorthBreakdown.liabilitiesTotal) : "—"}</Text></Stack>
            <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownKpiMoM")}</Text><Text fw={600}>{t("breakdownKpiMoMValue", { cash: formatDelta(momDeltaCash, formatValue), netWorth: formatDelta(momDeltaNetWorth, formatValue) })}</Text></Stack>
          </SimpleGrid>

          <Stack gap={4}>
            <Text fw={600}>{t("breakdownHighlightsAlerts")}</Text>
            {expenseIncreasePct !== null && expenseIncreasePct > 0 ? (
              <Text size="sm">{t("breakdownAlertExpenseUp", { pct: expenseIncreasePct.toFixed(1), value: formatValue(totalExpense - prevExpense) })}</Text>
            ) : (
              <Text size="sm" c="dimmed">{t("breakdownAlertStable")}</Text>
            )}
            <Text size="sm">{t("breakdownAlertLowestCash", { value: endingCash !== undefined ? formatValue(endingCash) : "—", month: resolvedMonth })}</Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" verticalSpacing="md">
            <Stack gap="sm">
              <Text fw={700}>{t("breakdownTabCashflow")}</Text>
              {toast && (
                <Notification color={toast.color} onClose={clearToast}>
                  {toast.message}
                </Notification>
              )}
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownOperationalNet")}</Text><Text fw={600}>{formatValue(operationalNetCashflow)}</Text></Stack>
                <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownEventTotal")}</Text><Text fw={600}>{formatValue(monthSummary.bySource.event)}</Text></Stack>
                <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownPositionTotal")}</Text><Text fw={600}>{formatValue(mergedPositionTotal)}</Text></Stack>
              </SimpleGrid>
              {projectionNetCashflow !== undefined && (
                <Text size="xs" c="dimmed">
                  {projectionNetCashflowMode === "cashDelta"
                    ? t("breakdownProjectionNetChange")
                    : t("breakdownProjectionNetFlow")}{" "}
                  {formatValue(projectionNetCashflow)}
                </Text>
              )}
              {doubleCountingWarning && (
                <Badge color="yellow" variant="light">
                  {t("breakdownDoubleCounting")}
                </Badge>
              )}

              {!hasItems ? (
                <Text size="sm" c="dimmed">{t("breakdownEmptyMonth")}</Text>
              ) : (
                <Accordion variant="separated" chevronPosition="right" multiple defaultValue={defaultAccordionValues}>
                  {sections.filter((section) => !section.hidden).map((section) => (
                    <Accordion.Item key={section.key} value={section.key}>
                      <Accordion.Control>
                        <Group justify="space-between" wrap="nowrap">
                          <Text fw={600}>{section.label}</Text>
                          <Text size="sm">{formatValue(section.total)}</Text>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        {section.items.length === 0 ? (
                          <Text size="sm" c="dimmed">{t("breakdownNoItems")}</Text>
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
                                    ? t(`breakdownPositionLabels.${item.sourceId}`)
                                    : item.label ?? item.category ?? item.sourceId;
                                const memberName = item.memberId
                                  ? memberLookup?.[item.memberId]
                                  : null;
                                const label = memberName
                                  ? `${baseLabel} (${memberName})`
                                  : baseLabel;
                                return (
                                  <Table.Tr key={`${section.key}-${item.sourceId}-${item.month}-${item.amount}`}>
                                    <Table.Td>{label}</Table.Td>
                                    <Table.Td><Text c={item.amount < 0 ? "red" : "green"} fw={500}>{formatValue(item.amount)}</Text></Table.Td>
                                    <Table.Td><Button size="xs" variant="subtle" onClick={() => jumpToSource(item)}>{t("breakdownEditSource")}</Button></Table.Td>
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
              )}

              <Stack gap={4}>
                <Text fw={600}>{t("breakdownHighlightsTitle")}</Text>
                {!hasHighlights ? (
                  <Text size="sm" c="dimmed">{t("breakdownHighlightsEmpty")}</Text>
                ) : (
                  <Stack gap={4}>
                    {highlights.milestones.map((item) => (
                      <Group key={`milestone-${item.id}`} gap="xs" wrap="nowrap">
                        <Badge size="sm" variant="light">{t("breakdownHighlightMilestone")}</Badge>
                        <Text size="sm">{renderHighlightLabel(item.label, item.memberName)}</Text>
                      </Group>
                    ))}
                    {highlights.events.map((item) => (
                      <Group key={`event-${item.id}`} gap="xs" wrap="nowrap">
                        <Badge size="sm" variant="light" color="grape">{t("breakdownHighlightEvent")}</Badge>
                        <Text size="sm">{renderHighlightLabel(item.label, item.memberName)}</Text>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Stack>

            <Stack gap="sm">
              <Text fw={700}>{t("breakdownTabNetWorth")}</Text>
              {!netWorthBreakdown ? (
                <Text size="sm" c="dimmed">{t("breakdownNetWorthEmpty")}</Text>
              ) : (
                <Stack gap="md">
                  {!isScenarioV2 && (
                    <Stack gap="xs">
                      <Text fw={600}>{t("breakdownNetWorthAllocation")}</Text>
                      <Table striped withTableBorder>
                        <Table.Tbody>
                          <Table.Tr><Table.Td>{t("breakdownNetWorthCash")}</Table.Td><Table.Td>{formatPct(netWorthBreakdown.allocation.cashPct)}</Table.Td></Table.Tr>
                          <Table.Tr><Table.Td>{t("breakdownNetWorthHousing")}</Table.Td><Table.Td>{formatPct(netWorthBreakdown.allocation.housingPct)}</Table.Td></Table.Tr>
                          <Table.Tr><Table.Td>{t("breakdownNetWorthInvestments")}</Table.Td><Table.Td>{formatPct(netWorthBreakdown.allocation.investmentsPct)}</Table.Td></Table.Tr>
                          <Table.Tr><Table.Td>{t("breakdownNetWorthCars")}</Table.Td><Table.Td>{formatPct(netWorthBreakdown.allocation.carsPct)}</Table.Td></Table.Tr>
                          <Table.Tr><Table.Td>{t("breakdownNetWorthInsurance")}</Table.Td><Table.Td>{formatPct(netWorthBreakdown.allocation.insurancePct)}</Table.Td></Table.Tr>
                        </Table.Tbody>
                      </Table>
                    </Stack>
                  )}

                  <Stack gap="xs">
                    <Text fw={600}>{t("breakdownNetWorthAssets")}</Text>
                    {labeledAssetItems.length === 0 ? (
                      <Text size="sm" c="dimmed">{t("breakdownNoItems")}</Text>
                    ) : (
                      <Table striped withTableBorder>
                        <Table.Thead><Table.Tr><Table.Th>{t("breakdownItem")}</Table.Th><Table.Th>{t("breakdownAmount")}</Table.Th></Table.Tr></Table.Thead>
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
                      <Text size="sm" c="dimmed">{t("breakdownNoItems")}</Text>
                    ) : (
                      <Table striped withTableBorder>
                        <Table.Thead><Table.Tr><Table.Th>{t("breakdownItem")}</Table.Th><Table.Th>{t("breakdownAmount")}</Table.Th></Table.Tr></Table.Thead>
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

                  <Stack gap="xs">
                    <Text fw={600}>{t("breakdownTopMovers")}</Text>
                    {topMovers.length === 0 ? (
                      <Text size="sm" c="dimmed">{t("breakdownNoItems")}</Text>
                    ) : (
                      <Stack gap={2}>
                        {topMovers.map((item) => (
                          <Group key={item.key} justify="space-between">
                            <Text size="sm">{item.key}</Text>
                            <Group gap={4}>
                              <Text size="sm" c={item.delta >= 0 ? "green" : "red"}>{item.delta >= 0 ? "↑" : "↓"}</Text>
                              <Text size="sm" fw={600}>{formatDelta(item.delta, formatValue)}</Text>
                            </Group>
                          </Group>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Stack>
              )}
            </Stack>
          </SimpleGrid>

          <Stack gap={4}>
            <Text fw={600}>{t("breakdownExplainabilityTitle")}</Text>
            <Text size="sm" c="dimmed">{t("breakdownExplainabilityFormula")}</Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownNetWorthDelta")}</Text><Text fw={600}>{formatDelta(momDeltaNetWorth, formatValue)}</Text></Stack>
              <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownTotalNet")}</Text><Text fw={600}>{formatValue(netCashflow)}</Text></Stack>
              <Stack gap={2}><Text size="xs" c="dimmed">{t("breakdownResidual")}</Text><Text fw={600}>{formatDelta(residualNetWorth, formatValue)}</Text></Stack>
            </SimpleGrid>
          </Stack>
            </Stack>
          </Box>
        </Box>
      )}
    </Modal>
  );
}
