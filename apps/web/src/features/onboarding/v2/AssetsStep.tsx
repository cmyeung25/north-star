"use client";

import {
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { nanoid } from "nanoid";
import { useMemo } from "react";
import MonthField from "../../../../components/MonthField";
import type {
  OnboardingV2DraftAssets,
  OnboardingV2DraftInvestmentBreakdownType,
  OnboardingV2DraftMember,
} from "../../../domain/onboarding/v2/draftTypes";

export type AssetsErrors = {
  cash: Partial<{ amount: string; startMonth: string }>;
  investment: Partial<{ totalAmount: string; startMonth: string }>;
  breakdown: Record<string, Partial<{ value: string; customReturnPct: string }>>;
  contributions: Record<string, Partial<{ amount: string; startMonth: string; endMonth: string }>>;
  car: Partial<{ value: string; startMonth: string; depreciationPct: string }>;
};

type AssetsStepProps = {
  assets: OnboardingV2DraftAssets;
  baseMonth: string;
  members: OnboardingV2DraftMember[];
  errors: AssetsErrors;
  onChange: (next: OnboardingV2DraftAssets) => void;
  t: (key: string, values?: Record<string, number>) => string;
};

const investmentBreakdownTypes: {
  type: OnboardingV2DraftInvestmentBreakdownType;
  labelKey: string;
}[] = [
  { type: "stock", labelKey: "assetsInvestmentTypeStock" },
  { type: "etf", labelKey: "assetsInvestmentTypeEtf" },
  { type: "fund", labelKey: "assetsInvestmentTypeFund" },
  { type: "crypto", labelKey: "assetsInvestmentTypeCrypto" },
  { type: "other", labelKey: "assetsInvestmentTypeOther" },
];

export default function AssetsStep({
  assets,
  baseMonth,
  members,
  errors,
  onChange,
  t,
}: AssetsStepProps) {
  const memberOptions = useMemo(
    () => [
      { value: "", label: t("assetsMemberOptional") },
      ...members.map((member) => ({
        value: member.id,
        label: member.name?.trim() || member.id,
      })),
    ],
    [members, t]
  );

  const updateAssets = (patch: Partial<OnboardingV2DraftAssets>) => {
    onChange({
      ...assets,
      ...patch,
    });
  };

  const updateCash = (patch: Partial<OnboardingV2DraftAssets["cash"]>) => {
    updateAssets({
      cash: {
        ...assets.cash,
        ...patch,
      },
    });
  };

  const updateInvestment = (
    patch: Partial<OnboardingV2DraftAssets["investment"]>
  ) => {
    updateAssets({
      investment: {
        ...assets.investment,
        ...patch,
      },
    });
  };

  const updateBreakdown = (
    id: string,
    patch: Partial<OnboardingV2DraftAssets["investment"]["breakdown"][number]>
  ) => {
    updateInvestment({
      breakdown: assets.investment.breakdown.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry
      ),
    });
  };

  const updateContribution = (
    id: string,
    patch: Partial<OnboardingV2DraftAssets["contributions"][number]>
  ) => {
    updateAssets({
      contributions: assets.contributions.map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry
      ),
    });
  };

  const addContribution = () => {
    updateAssets({
      contributions: [
        ...assets.contributions,
        {
          id: nanoid(6),
          amount: 0,
          startMonth: baseMonth,
          endMonth: "",
          memberId: "",
        },
      ],
    });
  };

  const removeContribution = (id: string) => {
    updateAssets({
      contributions: assets.contributions.filter((entry) => entry.id !== id),
    });
  };

  const updateCar = (patch: Partial<OnboardingV2DraftAssets["car"]>) => {
    updateAssets({
      car: {
        ...assets.car,
        ...patch,
      },
    });
  };

  return (
    <Stack gap="md">
      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group align="center" justify="space-between">
            <Title order={4}>{t("assetsTitle")}</Title>
            <Badge variant="light">{t("assetsAdvancedBadge")}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("assetsHint")}
          </Text>
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Title order={5}>{t("assetsCashTitle")}</Title>
          <Text size="sm" c="dimmed">
            {t("assetsCashHint")}
          </Text>
          <Group grow align="flex-start">
            <NumberInput
              label={t("assetsCashAmount")}
              min={0}
              value={assets.cash.amount}
              error={errors.cash.amount}
              onChange={(value) =>
                updateCash({
                  amount: typeof value === "number" ? value : 0,
                })
              }
            />
            <MonthField
              label={t("assetsCashStartMonth")}
              placeholder={t("monthPlaceholder")}
              value={assets.cash.startMonth ?? ""}
              error={errors.cash.startMonth}
              onChange={(value) => updateCash({ startMonth: value })}
            />
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Title order={5}>{t("assetsInvestmentsTitle")}</Title>
          <Text size="sm" c="dimmed">
            {t("assetsInvestmentsHint")}
          </Text>
          <Group grow align="flex-start">
            <NumberInput
              label={t("assetsInvestmentTotalAmount")}
              min={0}
              value={assets.investment.totalAmount}
              error={errors.investment.totalAmount}
              onChange={(value) =>
                updateInvestment({
                  totalAmount: typeof value === "number" ? value : 0,
                })
              }
            />
            <MonthField
              label={t("assetsInvestmentStartMonth")}
              placeholder={t("monthPlaceholder")}
              value={assets.investment.startMonth ?? ""}
              error={errors.investment.startMonth}
              onChange={(value) => updateInvestment({ startMonth: value })}
            />
          </Group>
          <Divider />
          <Switch
            label={t("assetsInvestmentBreakdownToggle")}
            checked={assets.investment.breakdownEnabled}
            onChange={(event) =>
              updateInvestment({ breakdownEnabled: event.currentTarget.checked })
            }
          />
          {assets.investment.breakdownEnabled ? (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                {t("assetsInvestmentBreakdownHint")}
              </Text>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {investmentBreakdownTypes.map((entry) => {
                  const breakdown = assets.investment.breakdown.find(
                    (item) => item.type === entry.type
                  );
                  if (!breakdown) {
                    return null;
                  }
                  const breakdownErrors = errors.breakdown[breakdown.id];
                  return (
                    <Card key={breakdown.id} withBorder radius="md" padding="sm">
                      <Stack gap="xs">
                        <Text fw={600}>{t(entry.labelKey)}</Text>
                        <NumberInput
                          label={t("assetsInvestmentValue")}
                          min={0}
                          value={breakdown.value}
                          error={breakdownErrors?.value}
                          onChange={(value) =>
                            updateBreakdown(breakdown.id, {
                              value: typeof value === "number" ? value : 0,
                            })
                          }
                        />
                        <Switch
                          label={t("assetsInvestmentFollowReturn")}
                          checked={breakdown.followGlobalReturn}
                          onChange={(event) =>
                            updateBreakdown(breakdown.id, {
                              followGlobalReturn: event.currentTarget.checked,
                            })
                          }
                        />
                        {!breakdown.followGlobalReturn && (
                          <NumberInput
                            label={t("assetsInvestmentCustomReturn")}
                            min={0}
                            value={breakdown.customReturnPct ?? ""}
                            error={breakdownErrors?.customReturnPct}
                            onChange={(value) =>
                              updateBreakdown(breakdown.id, {
                                customReturnPct:
                                  typeof value === "number" ? value : null,
                              })
                            }
                          />
                        )}
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>
            </Stack>
          ) : null}
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group align="center" justify="space-between">
            <Title order={5}>{t("assetsContributionTitle")}</Title>
            <Badge variant="light">{t("assetsOptionalBadge")}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("assetsContributionHint")}
          </Text>
          <Button size="xs" onClick={addContribution}>
            {t("assetsContributionAdd")}
          </Button>
          {assets.contributions.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t("assetsContributionEmpty")}
            </Text>
          ) : (
            <Stack gap="sm">
              {assets.contributions.map((entry, index) => {
                const entryErrors = errors.contributions[entry.id];
                return (
                  <Card key={entry.id} withBorder radius="md" padding="sm">
                    <Stack gap="xs">
                      <Group justify="space-between" align="center">
                        <Text fw={600}>
                          {t("assetsContributionItem", { index: index + 1 })}
                        </Text>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => removeContribution(entry.id)}
                        >
                          {t("assetsContributionRemove")}
                        </Button>
                      </Group>
                      <Group grow align="flex-start">
                        <NumberInput
                          label={t("assetsContributionAmount")}
                          min={0}
                          value={entry.amount}
                          error={entryErrors?.amount}
                          onChange={(value) =>
                            updateContribution(entry.id, {
                              amount: typeof value === "number" ? value : 0,
                            })
                          }
                        />
                        <Select
                          label={t("assetsContributionMember")}
                          data={memberOptions}
                          value={entry.memberId ?? ""}
                          onChange={(value) =>
                            updateContribution(entry.id, {
                              memberId: value ?? "",
                            })
                          }
                        />
                      </Group>
                      <Group grow align="flex-start">
                        <MonthField
                          label={t("assetsContributionStartMonth")}
                          placeholder={t("monthPlaceholder")}
                          value={entry.startMonth ?? ""}
                          error={entryErrors?.startMonth}
                          onChange={(value) =>
                            updateContribution(entry.id, { startMonth: value })
                          }
                        />
                        <MonthField
                          label={t("assetsContributionEndMonth")}
                          placeholder={t("monthPlaceholder")}
                          value={entry.endMonth ?? ""}
                          error={entryErrors?.endMonth}
                          onChange={(value) =>
                            updateContribution(entry.id, { endMonth: value })
                          }
                        />
                      </Group>
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group align="center" justify="space-between">
            <Title order={5}>{t("assetsCarTitle")}</Title>
            <Badge variant="light">{t("assetsOptionalBadge")}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {t("assetsCarHint")}
          </Text>
          <Switch
            label={t("assetsCarToggle")}
            checked={assets.car.enabled}
            onChange={(event) => updateCar({ enabled: event.currentTarget.checked })}
          />
          {assets.car.enabled ? (
            <Group grow align="flex-start">
              <NumberInput
                label={t("assetsCarValue")}
                min={0}
                value={assets.car.value}
                error={errors.car.value}
                onChange={(value) =>
                  updateCar({ value: typeof value === "number" ? value : 0 })
                }
              />
              <MonthField
                label={t("assetsCarStartMonth")}
                placeholder={t("monthPlaceholder")}
                value={assets.car.startMonth ?? ""}
                error={errors.car.startMonth}
                onChange={(value) => updateCar({ startMonth: value })}
              />
              <NumberInput
                label={t("assetsCarDepreciation")}
                min={0}
                value={assets.car.depreciationPct ?? ""}
                error={errors.car.depreciationPct}
                onChange={(value) =>
                  updateCar({
                    depreciationPct: typeof value === "number" ? value : null,
                  })
                }
              />
            </Group>
          ) : null}
        </Stack>
      </Card>

    </Stack>
  );
}
