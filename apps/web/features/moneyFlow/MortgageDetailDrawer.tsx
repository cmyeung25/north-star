"use client";

import {
  Button,
  Drawer,
  Group,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
} from "@mantine/core";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../../lib/i18n";
import { monthsBetween } from "../../src/domain/members/age";
import {
  buildAmortizationSchedule,
  computeMonthlyPayment,
  type AmortizationRow,
} from "../../src/domain/positions/calculations";
import type { HousingEvent } from "../../src/domain/scenarioV2/events";
import type { ScenarioAsset, ScenarioLiability } from "../../src/store/scenarioStore";

export type MortgageDetailTab = "overview" | "liability" | "cashflow";

type MortgageDetailDrawerProps = {
  opened: boolean;
  onClose: () => void;
  onEdit?: () => void;
  event: HousingEvent | null;
  asset?: ScenarioAsset | null;
  liability?: ScenarioLiability | null;
  baseCurrency: string;
  locale: string;
  defaultTab?: MortgageDetailTab;
  currentMonth?: string | null;
};

const formatAmount = (
  value: number | null | undefined,
  baseCurrency: string,
  locale: string,
  fallback: string
) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return formatCurrency(value, baseCurrency, locale);
};

export default function MortgageDetailDrawer({
  opened,
  onClose,
  onEdit,
  event,
  asset,
  liability,
  baseCurrency,
  locale,
  defaultTab = "overview",
  currentMonth = null,
}: MortgageDetailDrawerProps) {
  const t = useTranslations("money");
  const common = useTranslations("common");
  const [activeTab, setActiveTab] = useState<MortgageDetailTab>(defaultTab);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setActiveTab(defaultTab);
  }, [defaultTab, opened]);

  const resolvedDownPayment = useMemo(() => {
    if (!event || typeof event.purchasePrice !== "number") {
      return 0;
    }
    if (event.downPaymentMode === "percent") {
      return (event.purchasePrice * (event.downPaymentPercent ?? 0)) / 100;
    }
    return event.downPaymentAmount ?? 0;
  }, [event]);

  const principal = useMemo(() => {
    if (liability?.principalOutstanding !== undefined) {
      return liability.principalOutstanding;
    }
    if (!event || typeof event.purchasePrice !== "number") {
      return 0;
    }
    return Math.max(0, event.purchasePrice - resolvedDownPayment);
  }, [event, liability?.principalOutstanding, resolvedDownPayment]);

  const termMonths = Math.round((event?.mortgageTermYears ?? 0) * 12);
  const annualRateDecimal = (event?.mortgageRatePct ?? 0) / 100;
  const monthlyPayment =
    event?.mortgagePayment ??
    computeMonthlyPayment(principal, annualRateDecimal, termMonths);

  const amortizationRows: AmortizationRow[] = useMemo(() => {
    if (!event) {
      return [];
    }
    return buildAmortizationSchedule({
      principal,
      annualRateDecimal,
      termMonths,
      startMonth: event.startMonth,
    });
  }, [annualRateDecimal, event, principal, termMonths]);

  const currentIndex = useMemo(() => {
    if (!event || !currentMonth || amortizationRows.length === 0) {
      return 0;
    }
    return Math.min(
      Math.max(monthsBetween(event.startMonth, currentMonth), 0),
      amortizationRows.length - 1
    );
  }, [amortizationRows.length, currentMonth, event]);

  const outstanding = amortizationRows[currentIndex]?.closingBalance ?? principal;
  const yearRows = amortizationRows.slice(currentIndex, currentIndex + 12);
  const annualInterest = yearRows.reduce((sum, row) => sum + row.interest, 0);
  const annualPrincipal = yearRows.reduce((sum, row) => sum + row.principal, 0);
  const totalInterest = amortizationRows.reduce((sum, row) => sum + row.interest, 0);

  const cashflowItems = useMemo(() => {
    if (!event) {
      return [];
    }
    const items: Array<{ label: string; amount: number | null | undefined }> = [];
    items.push({
      label: t("mortgageDetailMonthlyPayment"),
      amount: monthlyPayment,
    });
    if (event.rental?.enabled) {
      items.push({
        label: t("mortgageDetailRentalIncome"),
        amount: event.rental.rentMonthly,
      });
    }
    (event.ongoingCosts ?? []).forEach((cost) => {
      items.push({
        label: cost.label?.trim() || t("mortgageDetailOngoingCostFallback"),
        amount: cost.amount,
      });
    });
    return items;
  }, [event, monthlyPayment, t]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        <Group justify="space-between" w="100%" wrap="nowrap">
          <Text fw={600}>{t("mortgageDetailTitle")}</Text>
          <Button size="xs" variant="light" onClick={() => onEdit?.()} disabled={!onEdit}>
            {common("actionEdit")}
          </Button>
        </Group>
      }
    >
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value as MortgageDetailTab)}>
        <Tabs.List>
          <Tabs.Tab value="overview">{t("mortgageDetailTabOverview")}</Tabs.Tab>
          <Tabs.Tab value="liability">{t("mortgageDetailTabLiability")}</Tabs.Tab>
          <Tabs.Tab value="cashflow">{t("mortgageDetailTabCashflow")}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailStartMonth")}
                </Text>
                <Text>{event?.startMonth ?? "--"}</Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailPropertyValue")}
                </Text>
                <Text>
                  {formatAmount(
                    event?.purchasePrice,
                    baseCurrency,
                    locale,
                    t("amountUnset")
                  )}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailDownPayment")}
                </Text>
                <Text>
                  {formatAmount(
                    resolvedDownPayment,
                    baseCurrency,
                    locale,
                    t("amountUnset")
                  )}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailLoanAmount")}
                </Text>
                <Text>
                  {formatAmount(
                    principal,
                    baseCurrency,
                    locale,
                    t("amountUnset")
                  )}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailRate")}
                </Text>
                <Text>
                  {event?.mortgageRatePct ?? "--"}%
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailTerm")}
                </Text>
                <Text>
                  {event?.mortgageTermYears ?? "--"}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailMonthlyPayment")}
                </Text>
                <Text>
                  {formatAmount(monthlyPayment, baseCurrency, locale, t("amountUnset"))}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailAssetLabel")}
                </Text>
                <Text>{asset?.label ?? "--"}</Text>
              </Stack>
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="liability" pt="md">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailOutstanding")}
                </Text>
                <Text>
                  {formatAmount(outstanding, baseCurrency, locale, t("amountUnset"))}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailAnnualInterest")}
                </Text>
                <Text>
                  {formatAmount(annualInterest, baseCurrency, locale, t("amountUnset"))}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailAnnualPrincipal")}
                </Text>
                <Text>
                  {formatAmount(annualPrincipal, baseCurrency, locale, t("amountUnset"))}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailTotalInterest")}
                </Text>
                <Text>
                  {formatAmount(totalInterest, baseCurrency, locale, t("amountUnset"))}
                </Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailLiabilityLabel")}
                </Text>
                <Text>{liability?.label ?? "--"}</Text>
              </Stack>
            </SimpleGrid>

            <Stack gap="xs">
              <Text fw={600}>{t("mortgageDetailScheduleTitle")}</Text>
              {amortizationRows.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailScheduleEmpty")}
                </Text>
              ) : (
                <ScrollArea type="auto">
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t("mortgageDetailScheduleMonth")}</Table.Th>
                        <Table.Th>{t("mortgageDetailScheduleOpening")}</Table.Th>
                        <Table.Th>{t("mortgageDetailSchedulePrincipal")}</Table.Th>
                        <Table.Th>{t("mortgageDetailScheduleInterest")}</Table.Th>
                        <Table.Th>{t("mortgageDetailScheduleClosing")}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {amortizationRows.map((row) => (
                        <Table.Tr key={row.month}>
                          <Table.Td>{row.month}</Table.Td>
                          <Table.Td>
                            {formatCurrency(row.openingBalance, baseCurrency, locale)}
                          </Table.Td>
                          <Table.Td>
                            {formatCurrency(row.principal, baseCurrency, locale)}
                          </Table.Td>
                          <Table.Td>
                            {formatCurrency(row.interest, baseCurrency, locale)}
                          </Table.Td>
                          <Table.Td>
                            {formatCurrency(row.closingBalance, baseCurrency, locale)}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Stack>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="cashflow" pt="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("mortgageDetailCashflowHint")}
            </Text>
            <Stack gap="sm">
              {cashflowItems.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("mortgageDetailCashflowEmpty")}
                </Text>
              ) : (
                cashflowItems.map((item) => (
                  <Group
                    key={item.label}
                    justify="space-between"
                    align="center"
                    wrap="wrap"
                  >
                    <Text>{item.label}</Text>
                    <Text>
                      {formatAmount(
                        item.amount,
                        baseCurrency,
                        locale,
                        t("amountUnset")
                      )}
                    </Text>
                  </Group>
                ))
              )}
            </Stack>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Drawer>
  );
}
