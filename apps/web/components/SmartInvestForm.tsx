"use client";

import {
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useTranslations } from "next-intl";
import type { SmartInvestPolicy } from "../src/domain/smartInvest/types";

type SmartInvestFormProps = {
  policy: SmartInvestPolicy;
  onChange: (policy: SmartInvestPolicy) => void;
};

export default function SmartInvestForm({ policy, onChange }: SmartInvestFormProps) {
  const t = useTranslations("assumptions");
  const common = useTranslations("common");

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Text fw={600}>{t("smartInvestSettingsTitle")}</Text>
        <Switch
          label={t("smartInvestEnabled")}
          checked={policy.enabled}
          onChange={(event) =>
            onChange({
              ...policy,
              enabled: event.currentTarget.checked,
            })
          }
        />
      </Group>
      <Divider />
      <Stack gap="xs">
        <Text fw={500}>{t("smartInvestReserveTitle")}</Text>
        <SegmentedControl
          data={[
            { value: "fixed", label: t("smartInvestReserveFixed") },
            { value: "monthsOfOutflow", label: t("smartInvestReserveMonths") },
          ]}
          value={policy.reserve.mode}
          onChange={(value) => {
            const nextReserve =
              value === "fixed"
                ? {
                    mode: "fixed" as const,
                    amount:
                      policy.reserve.mode === "fixed" ? policy.reserve.amount : 0,
                  }
                : {
                    mode: "monthsOfOutflow" as const,
                    months:
                      policy.reserve.mode === "monthsOfOutflow"
                        ? policy.reserve.months
                        : 3,
                  };
            onChange({
              ...policy,
              reserve: nextReserve,
            });
          }}
        />
        {policy.reserve.mode === "fixed" ? (
          <NumberInput
            label={t("smartInvestReserveAmount")}
            value={policy.reserve.amount ?? 0}
            min={0}
            thousandSeparator=","
            onChange={(value) =>
              onChange({
                ...policy,
                reserve: {
                  mode: "fixed",
                  amount: typeof value === "number" ? value : 0,
                },
              })
            }
          />
        ) : (
          <NumberInput
            label={t("smartInvestReserveMonthsCount")}
            value={policy.reserve.months ?? 0}
            min={0}
            onChange={(value) =>
              onChange({
                ...policy,
                reserve: {
                  mode: "monthsOfOutflow",
                  months: typeof value === "number" ? value : 0,
                },
              })
            }
          />
        )}
      </Stack>
      <Divider />
      <Stack gap="xs">
        <Text fw={500}>{t("smartInvestContributionTitle")}</Text>
        <SegmentedControl
          data={[
            {
              value: "percentOfIncome",
              label: t("smartInvestContributionIncome"),
            },
            {
              value: "percentOfSurplus",
              label: t("smartInvestContributionSurplus"),
            },
            {
              value: "rebalance",
              label: t("smartInvestContributionRebalance"),
            },
          ]}
          value={policy.contribution.mode}
          onChange={(value) => {
            const nextContribution =
              value === "percentOfIncome"
                ? {
                    mode: "percentOfIncome" as const,
                    pct:
                      policy.contribution.mode === "percentOfIncome"
                        ? policy.contribution.pct
                        : 0,
                  }
                : value === "percentOfSurplus"
                  ? {
                      mode: "percentOfSurplus" as const,
                      pct:
                        policy.contribution.mode === "percentOfSurplus"
                          ? policy.contribution.pct
                          : 0,
                    }
                  : {
                      mode: "rebalance" as const,
                    };
            onChange({
              ...policy,
              contribution: nextContribution,
            });
          }}
        />
        {policy.contribution.mode !== "rebalance" && (
          <NumberInput
            label={t("smartInvestContributionPct")}
            value={policy.contribution.pct ?? 0}
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
            onChange={(value) =>
              onChange({
                ...policy,
                contribution: {
                  ...policy.contribution,
                  pct: typeof value === "number" ? value : 0,
                },
              })
            }
          />
        )}
      </Stack>
      <Divider />
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text fw={500}>{t("smartInvestAllocationTitle")}</Text>
          <Button
            size="xs"
            variant="light"
            onClick={() =>
              onChange({
                ...policy,
                allocation: [
                  ...policy.allocation,
                  {
                    id: nanoid(6),
                    name: t("smartInvestAllocationNew"),
                    targetPct: 0,
                    assumedAnnualReturnPct: 0,
                  },
                ],
              })
            }
          >
            {t("smartInvestAllocationAdd")}
          </Button>
        </Group>
        <Stack gap="sm">
          {policy.allocation.map((item) => (
            <Card key={item.id} withBorder radius="sm" padding="sm">
              <Stack gap="xs">
                <Group grow>
                  <TextInput
                    label={t("smartInvestAllocationName")}
                    value={item.name}
                    onChange={(event) => {
                      const next = policy.allocation.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, name: event.currentTarget.value }
                          : entry
                      );
                      onChange({
                        ...policy,
                        allocation: next,
                      });
                    }}
                  />
                  <NumberInput
                    label={t("smartInvestAllocationTargetPct")}
                    value={item.targetPct}
                    min={0}
                    max={100}
                    decimalScale={2}
                    suffix="%"
                    onChange={(value) => {
                      const next = policy.allocation.map((entry) =>
                        entry.id === item.id
                          ? {
                              ...entry,
                              targetPct: typeof value === "number" ? value : 0,
                            }
                          : entry
                      );
                      onChange({
                        ...policy,
                        allocation: next,
                      });
                    }}
                  />
                  <NumberInput
                    label={t("smartInvestAllocationReturnPct")}
                    value={item.assumedAnnualReturnPct}
                    min={-100}
                    max={100}
                    decimalScale={2}
                    suffix="%"
                    onChange={(value) => {
                      const next = policy.allocation.map((entry) =>
                        entry.id === item.id
                          ? {
                              ...entry,
                              assumedAnnualReturnPct:
                                typeof value === "number" ? value : 0,
                            }
                          : entry
                      );
                      onChange({
                        ...policy,
                        allocation: next,
                      });
                    }}
                  />
                </Group>
                <Group justify="flex-end">
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    disabled={policy.allocation.length <= 1}
                    onClick={() =>
                      onChange({
                        ...policy,
                        allocation: policy.allocation.filter(
                          (entry) => entry.id !== item.id
                        ),
                      })
                    }
                  >
                    {common("actionRemove")}
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
        </Stack>
      </Stack>
      <Divider />
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text fw={500}>{t("smartInvestWithdrawalTitle")}</Text>
          <Switch
            label={t("smartInvestWithdrawalEnabled")}
            checked={policy.withdrawal.enabled}
            onChange={(event) =>
              onChange({
                ...policy,
                withdrawal: {
                  ...policy.withdrawal,
                  enabled: event.currentTarget.checked,
                },
              })
            }
          />
        </Group>
        <Text size="sm" c="dimmed">
          {t("smartInvestWithdrawalHint")}
        </Text>
      </Stack>
    </Stack>
  );
}
