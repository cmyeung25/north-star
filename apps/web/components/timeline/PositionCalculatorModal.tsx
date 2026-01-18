"use client";

import { Card, Modal, Stack, Table, Tabs, Text } from "@mantine/core";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "../../lib/i18n";
import type {
  AmortizationRow,
  ContributionRow,
  ValueRow,
} from "../../src/domain/positions/calculations";

type PositionCalculatorModalProps = {
  opened: boolean;
  onClose: () => void;
  title: string;
  currency: string;
  amortizationRows?: AmortizationRow[];
  valueRows?: ValueRow[];
  contributionRows?: ContributionRow[];
};

export default function PositionCalculatorModal({
  opened,
  onClose,
  title,
  currency,
  amortizationRows = [],
  valueRows = [],
  contributionRows = [],
}: PositionCalculatorModalProps) {
  const t = useTranslations("timeline");
  const locale = useLocale();

  const hasAmortization = amortizationRows.length > 0;
  const hasValue = valueRows.length > 0;
  const hasContribution = contributionRows.length > 0;

  const renderEmpty = () => (
    <Card withBorder padding="md" radius="md">
      <Text size="sm" c="dimmed">
        {t("positionCalculationEmpty")}
      </Text>
    </Card>
  );

  const content = () => {
    if (!hasAmortization && !hasValue && !hasContribution) {
      return renderEmpty();
    }

    if (hasAmortization && !hasValue && !hasContribution) {
      return (
        <Table striped withColumnBorders highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("calculatorMonth")}</Table.Th>
              <Table.Th>{t("calculatorOpeningBalance")}</Table.Th>
              <Table.Th>{t("calculatorPayment")}</Table.Th>
              <Table.Th>{t("calculatorInterest")}</Table.Th>
              <Table.Th>{t("calculatorPrincipal")}</Table.Th>
              <Table.Th>{t("calculatorClosingBalance")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {amortizationRows.map((row) => (
              <Table.Tr key={row.month}>
                <Table.Td>{row.month}</Table.Td>
                <Table.Td>{formatCurrency(row.openingBalance, currency, locale)}</Table.Td>
                <Table.Td>{formatCurrency(row.payment, currency, locale)}</Table.Td>
                <Table.Td>{formatCurrency(row.interest, currency, locale)}</Table.Td>
                <Table.Td>{formatCurrency(row.principal, currency, locale)}</Table.Td>
                <Table.Td>{formatCurrency(row.closingBalance, currency, locale)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      );
    }

    return (
      <Tabs defaultValue={hasAmortization ? "amortization" : hasValue ? "value" : "contribution"}>
        <Tabs.List>
          {hasAmortization && (
            <Tabs.Tab value="amortization">
              {t("calculatorTabAmortization")}
            </Tabs.Tab>
          )}
          {hasValue && (
            <Tabs.Tab value="value">{t("calculatorTabPropertyValue")}</Tabs.Tab>
          )}
          {hasContribution && (
            <Tabs.Tab value="contribution">{t("calculatorTabContribution")}</Tabs.Tab>
          )}
        </Tabs.List>
        {hasAmortization && (
          <Tabs.Panel value="amortization" pt="md">
            <Table striped withColumnBorders highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("calculatorMonth")}</Table.Th>
                  <Table.Th>{t("calculatorOpeningBalance")}</Table.Th>
                  <Table.Th>{t("calculatorPayment")}</Table.Th>
                  <Table.Th>{t("calculatorInterest")}</Table.Th>
                  <Table.Th>{t("calculatorPrincipal")}</Table.Th>
                  <Table.Th>{t("calculatorClosingBalance")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {amortizationRows.map((row) => (
                  <Table.Tr key={row.month}>
                    <Table.Td>{row.month}</Table.Td>
                    <Table.Td>
                      {formatCurrency(row.openingBalance, currency, locale)}
                    </Table.Td>
                    <Table.Td>{formatCurrency(row.payment, currency, locale)}</Table.Td>
                    <Table.Td>{formatCurrency(row.interest, currency, locale)}</Table.Td>
                    <Table.Td>
                      {formatCurrency(row.principal, currency, locale)}
                    </Table.Td>
                    <Table.Td>
                      {formatCurrency(row.closingBalance, currency, locale)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        )}
        {hasValue && (
          <Tabs.Panel value="value" pt="md">
            <Table striped withColumnBorders highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("calculatorMonth")}</Table.Th>
                  <Table.Th>{t("calculatorPropertyValue")}</Table.Th>
                  <Table.Th>{t("calculatorPropertyDelta")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {valueRows.map((row) => (
                  <Table.Tr key={row.month}>
                    <Table.Td>{row.month}</Table.Td>
                    <Table.Td>{formatCurrency(row.value, currency, locale)}</Table.Td>
                    <Table.Td>{formatCurrency(row.delta, currency, locale)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        )}
        {hasContribution && (
          <Tabs.Panel value="contribution" pt="md">
            <Table striped withColumnBorders highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t("calculatorMonth")}</Table.Th>
                  <Table.Th>{t("calculatorContribution")}</Table.Th>
                  <Table.Th>{t("calculatorContributionTotal")}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {contributionRows.map((row) => (
                  <Table.Tr key={row.month}>
                    <Table.Td>{row.month}</Table.Td>
                    <Table.Td>
                      {formatCurrency(row.contribution, currency, locale)}
                    </Table.Td>
                    <Table.Td>
                      {formatCurrency(row.cumulative, currency, locale)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        )}
      </Tabs>
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="xl" centered>
      <Stack gap="md">{content()}</Stack>
    </Modal>
  );
}
